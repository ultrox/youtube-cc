// Publish the extension if its current version hasn't been released yet.
//
// "Released" at a version means the git tag `<name>@<version>` exists. If it doesn't: build the zip,
// upload + submit it to the Chrome Web Store, tag the commit, and attach the exact zip that was
// uploaded to a GitHub release, with that version's CHANGELOG section as notes.
//
// Usage: pnpm release            (the Release workflow, on main, after a "Version packages" merge)
//        pnpm release --dry-run  (anywhere: shows what would happen, uploads nothing)
//        pnpm release --dry-run --include-released
//                                (rehearsal: also runs an already-tagged version through the store's
//                                 dry run, so credentials + item ID are checked end to end)
//
// Store credentials come from env (.env.example); the item ID from `webStore.chrome` in package.json.
// Same flow as the Search Like a Native repo, for a repo with one extension at its root.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAccessToken, missingCredentials } from './cws-auth.mjs';

const dryRun = process.argv.includes('--dry-run');
const includeReleased = process.argv.includes('--include-released');
if (includeReleased && !dryRun) {
  console.error('--include-released only works with --dry-run');
  process.exit(1);
}
// `wxt submit` rejects v1.1-style OAuth fields under API v2, so it only gets the access token.
const { CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN, ...submitEnv } = process.env;

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
const tagExists = (tag) => {
  try {
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/** The section for `version` from a Changesets CHANGELOG.md. */
function changelogSection(version) {
  if (!existsSync('CHANGELOG.md')) return '';
  const text = readFileSync('CHANGELOG.md', 'utf8');
  const start = text.indexOf(`## ${version}\n`);
  if (start === -1) return '';
  const rest = text.slice(start + `## ${version}\n`.length);
  const end = rest.search(/^## /m);
  return (end === -1 ? rest : rest.slice(0, end)).trim();
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tag = `${pkg.name}@${pkg.version}`;
const extensionId = pkg.webStore?.chrome;

if (tagExists(tag)) {
  console.log(`= ${tag} already released${includeReleased ? ' (rehearsing anyway)' : ''}`);
  if (!includeReleased) process.exit(0);
}
if (!extensionId) {
  console.log(
    `! ${tag}: no webStore.chrome ID in package.json. The first upload of a new item is manual ` +
      '(docs/publishing.md); after that, add the ID and the Release workflow takes over.',
  );
  process.exit(0);
}
const missing = missingCredentials();
if (!dryRun && missing.length) {
  console.error(
    `x ${tag}: missing Chrome Web Store credentials: ${missing.join(', ')}. See docs/publishing.md.`,
  );
  process.exit(1);
}

console.log(`> ${tag}: building zip`);
run('pnpm', ['zip']);
const zip = resolve('.output', `${pkg.name}-${pkg.version}-chrome.zip`);
if (!existsSync(zip)) throw new Error(`Expected ${zip} after zipping`);

if (dryRun && missing.length) {
  console.log(`  (dry run, no credentials) would submit ${zip} to item ${extensionId}, then tag ${tag}`);
  process.exit(0);
}

try {
  const accessToken = await getAccessToken();
  console.log(`> ${tag}: submitting to the Chrome Web Store${dryRun ? ' (dry run)' : ''}`);
  run('pnpm', ['exec', 'wxt', 'submit', '--chrome-zip', zip, ...(dryRun ? ['--dry-run'] : [])], {
    env: {
      ...submitEnv,
      CHROME_SERVICE_ACCOUNT_ACCESS_TOKEN: accessToken,
      CHROME_EXTENSION_ID: extensionId,
      CHROME_API_VERSION: 'v2',
    },
  });
} catch (e) {
  if (e instanceof Error && !('status' in e)) console.error(e.message);
  console.error(`x ${tag}: submission failed; not tagging. Fix and re-run the workflow.`);
  process.exit(1);
}
if (dryRun) process.exit(0);

run('git', ['tag', tag]);
run('git', ['push', 'origin', `refs/tags/${tag}`]);
const notes = changelogSection(pkg.version) || `Submitted ${pkg.version} to the Chrome Web Store.`;
run('gh', ['release', 'create', tag, zip, '--title', tag, '--notes', notes]);
console.log(`✓ ${tag}: submitted for review, tagged, zip attached to the GitHub release`);
