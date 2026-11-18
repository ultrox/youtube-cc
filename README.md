# My Subtitles for YouTube

YouTube offers every video's subtitles in 150+ languages; most people need three or four. This Chrome
extension puts a small chevron next to the player's CC button. It opens a short list of _your_
languages, each showing how the current video can display it (uploaded subtitles, auto-generated,
auto-translated, or not at all). One click switches.

- Your languages start as your browser's languages; **Edit languages** searches all of YouTube's
  subtitle languages by their own name, your language's name for them or the English one, and lets
  you reorder or remove them. They're saved in `chrome.storage.local`.
- YouTube's own CC button and the <kbd>C</kbd> shortcut keep working; the extension never hides or
  replaces them.
- No account, no network requests, no tracking ([store/privacy.md](store/privacy.md)).

(Working name. It started as a Tampermonkey script with five hard-coded languages.)

## Develop

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm dev        # opens Chrome with the extension loaded, hot reload
pnpm build      # .output/chrome-mv3: load it unpacked in chrome://extensions
pnpm test       # unit tests (language matching, track choice)
pnpm e2e        # built extension in real Chromium, against a YouTube-shaped fixture page
pnpm e2e:live   # the same against the real youtube.com (network; not in CI)
pnpm check      # lint, typecheck, test, build, e2e
pnpm icons      # assets/icon.svg → public/icon/*.png
```

## How it works

Two content scripts on `www.youtube.com`:

- `entrypoints/player.content.ts` runs in the page's **main world**, where YouTube's player API
  lives: `getOption('captions', 'tracklist' | 'translationLanguages' | 'track')` and
  `setOption('captions', 'track', …)` on `#movie_player`. It doesn't open YouTube's settings menu, so
  it works in any YouTube interface language.
- `entrypoints/content/` runs in the **isolated world** (storage, UI): it mounts the chevron after
  `.ytp-subtitles-button` and the panel inside the player (so it works in fullscreen), both in shadow
  roots. The two talk over DOM events with JSON payloads (`src/bridge/`).

Picking a language (`src/tracks.ts`): uploaded subtitles in that language, then another variant of it
(`pt-PT` for Portuguese), then auto-generated ones, then YouTube's auto-translate from the
best source track (uploaded subtitles in the spoken language, else the auto-generated track).

## Release

Changesets + a manual Release workflow that uploads to the Chrome Web Store, the same as
Search Like a Native: [docs/publishing.md](docs/publishing.md). In short, add a changeset with every
user-facing change (`pnpm changeset`), merge the "Version packages" PR, then run _Actions → Release_.

## License

[MIT](LICENSE)
