// Fetches video metadata, chapters, and transcript. Must run on a youtube.com page:
// YouTube rejects these requests when they come from an extension origin.
const SkipSponsorsYouTube = (() => {
  // The ANDROID client returns caption URLs that download without a proof-of-origin token.
  const CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34, hl: "en" };
  const TIMESTAMP = String.raw`(?:\d{1,2}:)?\d{1,2}:\d{2}`;
  const LEADING_TS = new RegExp(String.raw`^\s*[\[(]?(${TIMESTAMP})[\])]?\s*[-–—:|.)]*\s*(.+?)\s*$`);
  const TRAILING_TS = new RegExp(String.raw`^\s*(.+?)\s*[-–—:|]*\s*[\[(]?(${TIMESTAMP})[\])]?\s*$`);

  function parseTimestamp(ts) {
    return ts.split(":").reduce((acc, part) => acc * 60 + Number(part), 0);
  }

  async function fetchPlayerResponse(videoId) {
    const res = await fetch(`${location.origin}/youtubei/v1/player?prettyPrint=false`, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: { client: CLIENT }, videoId }),
    });
    if (!res.ok) throw new Error(`YouTube player API returned ${res.status}`);
    return res.json();
  }

  function parseChapters(description, duration) {
    const chapters = [];
    for (const line of description.split("\n")) {
      let m = line.match(LEADING_TS);
      if (m) {
        chapters.push({ start: parseTimestamp(m[1]), title: m[2] });
        continue;
      }
      m = line.match(TRAILING_TS);
      if (m) chapters.push({ start: parseTimestamp(m[2]), title: m[1] });
    }
    chapters.sort((a, b) => a.start - b.start);
    const valid = chapters.filter((c, i) => c.start < duration && (i === 0 || c.start > chapters[i - 1].start));
    if (valid.length < 2) return [];
    return valid.map((c, i) => ({ ...c, end: valid[i + 1]?.start ?? duration }));
  }

  // Prefer human captions, then auto-captions for the original audio (videos may also carry AI-dubbed tracks).
  function pickCaptionTrack(captions) {
    const tracks = captions?.captionTracks ?? [];
    const manual = tracks.find((t) => t.kind !== "asr");
    if (manual) return manual;
    const audio = captions?.audioTracks?.[captions.defaultAudioTrackIndex ?? 0];
    return tracks[audio?.captionTrackIndices?.[0]] ?? tracks[0] ?? null;
  }

  async function fetchTranscript(track) {
    const url = new URL(track.baseUrl, location.origin);
    url.searchParams.set("fmt", "json3");
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Caption download returned ${res.status}`);
    const text = await res.text();
    if (!text) return null;

    const cues = [];
    for (const ev of JSON.parse(text).events ?? []) {
      if (!ev.segs) continue;
      const line = ev.segs.map((s) => s.utf8).join("").replace(/\s+/g, " ").trim();
      if (line) cues.push({ start: ev.tStartMs / 1000, text: line });
    }
    return cues.length ? cues : null;
  }

  async function getVideoInfo(videoId) {
    const player = await fetchPlayerResponse(videoId);
    const details = player.videoDetails ?? {};
    const duration = Number(details.lengthSeconds) || 0;
    const description = details.shortDescription ?? "";
    const track = pickCaptionTrack(player.captions?.playerCaptionsTracklistRenderer);

    let transcript = null;
    if (track) {
      try {
        transcript = await fetchTranscript(track);
      } catch (err) {
        console.warn("[Skip Sponsors] transcript unavailable:", err);
      }
    }

    return {
      videoId,
      title: details.title ?? "",
      author: details.author ?? "",
      duration,
      description,
      chapters: parseChapters(description, duration),
      language: track?.languageCode ?? null,
      transcript,
    };
  }

  return { getVideoInfo };
})();
