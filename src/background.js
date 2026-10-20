importScripts("defaults.js", "analysis.js");

const API_BASE = "https://sponsor.ajay.app/api/skipSegments/";

const HANDLERS = {
  getSegments: (msg) => fetchSegments(msg.videoId, msg.categories),
  getCachedAnalysis: (msg) => getCachedAnalysis(msg.videoId),
  analyzeVideo: (msg) => analyzeVideo(msg.info),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) return false;
  handler(msg)
    .then((segments) => sendResponse({ segments }))
    .catch((err) => sendResponse({ error: String(err) }));
  return true;
});

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Queries by a 4-char hash prefix so the API never learns which exact video is being watched.
async function fetchSegments(videoId, categories) {
  if (!categories?.length) return [];
  const prefix = (await sha256Hex(videoId)).slice(0, 4);
  const params = new URLSearchParams({
    categories: JSON.stringify(categories),
    actionTypes: JSON.stringify(["skip"]),
  });
  const res = await fetch(`${API_BASE}${prefix}?${params}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`SponsorBlock API returned ${res.status}`);

  const data = await res.json();
  const match = data.find((v) => v.videoID === videoId);
  return (match?.segments ?? []).map((s) => ({
    start: s.segment[0],
    end: s.segment[1],
    category: s.category,
    source: "SponsorBlock",
  }));
}
