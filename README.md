# Skip Sponsors

A Chrome extension (Manifest V3) that automatically skips sponsored segments in YouTube videos.

## How it works

When you open a video, the extension finds ad segments in up to three ways:

1. **SponsorBlock.** It asks the crowdsourced [SponsorBlock](https://sponsor.ajay.app) database for
   segments, sending only the first 4 characters of the SHA-256 hash of the video ID so the server
   never learns exactly which video you're watching.
2. **Chapter titles.** If SponsorBlock has no sponsor data (common on niche channels), it reads the
   video's chapters from the description and flags ones titled like "Sponsor", "Ad", "A word from…",
   "Merch", "Patreon", and equivalents in several languages.
3. **Transcript analysis.** It downloads the video's captions and looks for ad reads:
   - With an API key (Gemini, OpenAI, or Anthropic, configured in the extension's settings page), a
     language model reads the transcript, description, and chapters and returns ad segments. This
     works in any language and catches ads with no "sponsored by" phrase.
   - Without a key, it falls back to keyword matching ("sponsored by", promo codes, "link in the
     description", "back to the video", …). This is deliberately conservative and only catches
     obvious ad reads.

Analysis results are cached per video, so each video is analyzed (and billed) once.

While the video plays, it jumps to the end of a segment as soon as playback enters it. A small toast
shows what was skipped and why, with an **Undo** button. Seeking manually into the middle of a segment
does not trigger a skip, and nothing is skipped while a YouTube ad is playing. If detection finishes
after playback is already inside an ad, it skips the rest immediately.

Detected segments, with the model's reasoning, are logged to the YouTube tab's DevTools console under
`[Skip Sponsors]`.

### Privacy

With an AI provider configured, the title, description, and transcript of videos you watch (only ones
SponsorBlock doesn't cover) are sent to that provider. The API key is stored locally and is not synced.

## Install (developer mode)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Open any YouTube video. Click the extension icon to choose which segment types to skip.
5. Optional but recommended: click **AI settings** in the popup, pick a provider, and paste an API key.
   The default Gemini model, `gemini-3.5-flash-lite`, is free on Gemini's free tier (10 requests per
   minute, 500 per day), which is plenty since each video is analyzed once. Note that Google may use
   free-tier requests to improve its products. The model name can be changed if the default is retired.

After editing code, click the reload icon on the extension's card and refresh the YouTube tab.

## Project layout

```
manifest.json        Extension manifest
src/background.js    Service worker; SponsorBlock lookups and message routing
src/analysis.js      Chapter classification, keyword heuristics, LLM calls, and caching
src/youtube.js       Runs on youtube.com; fetches description, chapters, and transcript
src/content.js       Runs on youtube.com; orchestrates detection and performs skips
src/defaults.js      Shared categories, providers, and default settings
popup/               Popup (toggles, categories, stats)
options/             Settings page (AI provider, API key, model, cache)
```

## Credits

Segment data is provided by SponsorBlock under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
