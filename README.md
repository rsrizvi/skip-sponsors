# Skip Sponsors

A Chrome extension (Manifest V3) that automatically skips sponsored segments in YouTube videos.

## How it works

Sponsor timestamps come from [SponsorBlock](https://sponsor.ajay.app), a crowdsourced database of
segments submitted and voted on by viewers. When you open a video, the extension:

1. Reads the video ID from the URL.
2. Asks the SponsorBlock API for segments using only the first 4 characters of the SHA-256 hash of
   the video ID, so the server never learns exactly which video you're watching.
3. Watches the player's playback position and jumps to the end of a segment as soon as playback enters it.
   A small toast appears with an **Undo** button if you want to watch it anyway.

Seeking manually into the middle of a segment does not trigger a skip, and nothing is skipped while a
YouTube ad is playing.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Open any YouTube video. Click the extension icon to choose which segment types to skip.

After editing code, click the reload icon on the extension's card and refresh the YouTube tab.

## Project layout

```
manifest.json        Extension manifest
src/background.js    Service worker; fetches segments from the SponsorBlock API
src/content.js       Runs on youtube.com; detects the video and performs skips
src/defaults.js      Shared category list and default settings
popup/               Settings popup (toggle, categories, stats)
```

## Credits

Segment data is provided by SponsorBlock under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
