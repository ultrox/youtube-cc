// Show the extension's Chrome Web Store status. Doubles as a credentials check: it fails if the
// OAuth client, refresh token, publisher ID or item ID is wrong.
//
// Usage: pnpm store-status   (reads .env; in CI: the "Store status" workflow, run from the Actions tab)
import { readFileSync } from 'node:fs';
import { getAccessToken, missingCredentials } from './cws-auth.mjs';

const { CHROME_PUBLISHER_ID } = process.env;
if (missingCredentials().length) {
  console.error(`Missing ${missingCredentials().join(', ')} (see .env.example)`);
  process.exit(1);
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const id = pkg.webStore?.chrome;

let accessToken;
try {
  accessToken = await getAccessToken();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
console.log('✓ OAuth credentials work');
if (!id) {
  console.log(
    '! No webStore.chrome ID in package.json yet: upload the first version by hand (docs/publishing.md).',
  );
  process.exit(0);
}

const url = `https://chromewebstore.googleapis.com/v2/publishers/${CHROME_PUBLISHER_ID}/items/${id}:fetchStatus`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`x ${pkg.name} (${id}): ${res.status} ${body.error?.message ?? ''}`);
  process.exit(1);
}
const channel = (rev) => rev?.distributionChannels?.[0];
const published = body.publishedItemRevisionStatus;
const submitted = body.submittedItemRevisionStatus;
console.log(`✓ ${pkg.name} (local ${pkg.version})`);
console.log(`    published: ${channel(published)?.crxVersion ?? '—'} ${published?.state ?? ''}`);
if (submitted)
  console.log(`    submitted: ${channel(submitted)?.crxVersion ?? '—'} ${submitted.state ?? ''}`);
