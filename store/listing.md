# Chrome Web Store listing: My Subtitles for YouTube

Working name. Not uploaded yet (docs/publishing.md, "First release").

## Summary (from package.json `description`, ≤132 chars)

Only the subtitle languages you actually use: pick your few languages once, then switch YouTube captions in one click.

## Description

YouTube offers every video's subtitles in 150+ languages. You need three or four.

My Subtitles for YouTube adds a small arrow next to the player's CC button. Click it and you get a short
list with only your languages, and next to each one how this video can show it:

• Subtitles: uploaded by the creator
• Auto-generated: YouTube's speech recognition
• Auto-translated: YouTube translates another track for you
• Not on this video

One click shows them. No digging through Settings → Subtitles → Auto-translate → a list of 150
languages.

YOUR LANGUAGES, YOUR ORDER
• Starts with your browser's languages.
• "Edit languages": search any language by its own name, its name in your language or in English
(type "deutsch" or "german"), then reorder or remove.
• Saved in your browser. Works the same on every video.

STAYS OUT OF THE WAY
• YouTube's own CC button and the C shortcut work as always.
• Works in fullscreen and theater mode, and with the keyboard (arrow keys, Enter, Escape).
• No account, no tracking, no network requests: it only talks to the YouTube player on the page.

Free and open source: https://github.com/ultrox/youtube-cc

Not affiliated with YouTube or Google.

## Category

Accessibility (alt: Productivity)

## Single purpose (for review)

Lets the user pick YouTube subtitles from a short list of languages they chose, next to the player's
CC button.

## Permission justifications

- `storage`: saves the user's list of subtitle languages on their device.
- Content scripts on `https://www.youtube.com/*`: add the language picker next to the video player's CC
  button and switch the player's subtitle track when the user picks a language.

No remote code. Nothing is sent anywhere.

## Data

Collects nothing. The only stored data is the list of language codes the user picked
(chrome.storage.local, on the device).

## Screenshots to make (1280×800)

1. Panel open over a video: Off, Deutsch (Subtitles ✓), English, Bosanski (Auto-translated).
2. Edit languages with a search ("srp") and results.
3. Before/after: YouTube's Settings → Subtitles → Auto-translate list next to the short panel.
