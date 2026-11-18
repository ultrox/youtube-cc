# Changesets

Every change a user would notice gets a changeset: `pnpm changeset`, pick patch/minor/major, write one
line for the changelog. CI fails a pull request that changes the extension without one.

Merging to `main` refreshes the "Version packages" pull request; merging that one bumps `package.json`
and writes CHANGELOG.md. Nothing is published until you run the Release workflow by hand
(docs/publishing.md).
