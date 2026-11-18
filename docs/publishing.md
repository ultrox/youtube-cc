# Publishing to the Chrome Web Store

The same flow as the Search Like a Native repo. Releases are driven by versions, and publishing is
always a manual step:

```
PR with a changeset ──merge──▶ main ──CI──▶ "Version packages" PR ──merge──▶ main (version bumped, nothing published)
                                            (bumps package.json,
                                             writes CHANGELOG.md)

When you decide to release:  Actions → Release → Run workflow (on main)
                             → zip → upload → submit for review → git tag youtube-cc@version
                               → GitHub release with the zip
```

- Merging feature PRs and the Version packages PR never publishes. Changes pile up on `main` until you
  run the Release workflow by hand. Everything on `main` ships in that release.
- Every store submission goes through Google's review, so batch changes instead of submitting each
  small fix.
- `scripts/release.mjs` submits the current version if its `youtube-cc@version` tag doesn't exist
  yet. A failed upload doesn't tag, so re-running the workflow retries it.
- The zip attached to each GitHub release is byte-for-byte what was uploaded.
- `pnpm release --dry-run` shows what would be published (CI runs it on every PR).
- Before a release, run `pnpm build && pnpm e2e:live` locally: it drives the real youtube.com.

## One-time setup

The store API needs four values. They're the same for every extension under your publisher account,
so reuse the ones from Search Like a Native (its walkthrough: Google Cloud project with the Chrome Web
Store API, an OAuth client, a refresh token from the OAuth Playground, the publisher ID from the
Developer Dashboard).

1. **Store them in GitHub**, in an environment called `chrome-web-store` (the publish job uses it; add
   yourself as a required reviewer there if you want to approve each submission):

   ```bash
   gh api -X PUT repos/{owner}/{repo}/environments/chrome-web-store
   for k in CHROME_CLIENT_ID CHROME_CLIENT_SECRET CHROME_REFRESH_TOKEN CHROME_PUBLISHER_ID; do
     gh secret set "$k" --env chrome-web-store
   done
   ```

2. **Allow the Version PR.** Repo _Settings → Actions → General → Workflow permissions_ → tick
   _Allow GitHub Actions to create and approve pull requests_ (or
   `gh api -X PUT repos/{owner}/{repo}/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=true`).

For local runs, copy `.env.example` to `.env` (gitignored): `pnpm store-status`, or
`node --env-file=.env scripts/release.mjs --dry-run`.

## First release (manual, once)

The API can update an item but can't create one, and the listing (screenshots, description, privacy
answers) is filled in by hand.

1. `pnpm zip`, then upload `.output/youtube-cc-<version>-chrome.zip` via _Developer Dashboard → New item_.
2. Fill in the listing from `store/listing.md` (text, category, single purpose, permission
   justification, privacy answers) and add screenshots (1280×800). Privacy policy URL: `store/privacy.md`
   on GitHub, or its page on searchlikeanative.com once that exists.
3. Submit for review.
4. Copy the item ID from the dashboard URL into `package.json` → `"webStore": { "chrome": "<id>" }`.
5. Tag what you uploaded so the Release workflow doesn't upload it again:
   `git tag youtube-cc@<version> && git push origin --tags`.

From then on: merge the Version packages PR and run the Release workflow to ship.
