# Chrome Web Store listing: My Subtitles for YouTube

Item `lekdckmokddhnlkdkbfihcfpplcomkok`: https://chromewebstore.google.com/detail/lekdckmokddhnlkdkbfihcfpplcomkok
0.1.0 uploaded by hand and submitted for review on 2026-11-18 (resubmitted the same day with screenshot 2). Screenshot: `store/screenshots/`.

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

TWO LANGUAGES AT ONCE
• "Dual subtitles": one switch, and the video shows two of your languages, one above the other.
Good for learning a language, or watching with someone who reads another one.
• The language you pick in the list is the top line; choose the second line right below the switch.
Pick the second line's language in the list and the two swap.

NO SURPRISE DUBBING
• YouTube now plays many videos dubbed into your language. "Original audio" (on by default) starts
every video in the language it was made in. Turn it off in the panel, or pick a dub in YouTube's
settings whenever you want one.

STAYS OUT OF THE WAY
• YouTube's own CC button and the C shortcut work as always.
• Works with the keyboard (arrow keys, Enter, Escape).
• No account, no tracking, no server: it only talks to YouTube, on the page you are watching.

Free and open source: https://github.com/ultrox/youtube-cc

Not affiliated with YouTube or Google.

## Category

Accessibility (alt: Productivity)

## Single purpose (for review)

Lets the user pick YouTube subtitles from a short list of languages they chose, next to the player's
CC button.

## Permission justifications

- `storage`: saves the user's list of subtitle languages, the "Original audio" and "Dual subtitles"
  settings and the pair of languages for dual subtitles on their device.
- Content scripts on `https://www.youtube.com/*`: add the language picker next to the video player's CC
  button, switch the player's subtitle track when the user picks a language, and (if "Original audio"
  is on) switch a dubbed audio track to the video's original one. With "Dual subtitles" on, the script
  requests the second language's subtitles of the playing video from www.youtube.com (the request
  YouTube's player makes for the first) and draws both lines in the player.

No remote code. Nothing is sent anywhere but that request to YouTube.

## Data

Collects nothing. The only stored data is the list of language codes the user picked, two on/off
settings and the pair of languages for dual subtitles (chrome.storage.local, on the device).

## Screenshots (1280×800)

1. `store/screenshots/1-panel.jpg`: the panel over a TED talk, Bosanski auto-translated ✓, Original audio on.
2. `store/screenshots/2-compare.jpg`: YouTube's own menu (50 tracks → Auto-translate, 156 more) next to
   ours (4 languages, 2 clicks).
