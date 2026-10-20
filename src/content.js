(() => {
  // A segment is only auto-skipped when playback enters it, not when the user seeks into its middle.
  const ENTRY_WINDOW_SEC = 1.5;
  const TOAST_MS = 4000;

  let settings = { ...SKIP_SPONSORS_DEFAULTS };
  let videoId = null;
  let segments = [];
  let video = null;
  let timer = null;
  let toast = null;
  let toastTimer = null;

  function currentVideoId() {
    const url = new URL(location.href);
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const m = url.pathname.match(/^\/(?:embed|live)\/([\w-]{11})/);
    return m ? m[1] : null;
  }

  function findVideo() {
    return (
      document.querySelector("#movie_player video.html5-main-video") ||
      document.querySelector("video.html5-main-video")
    );
  }

  function isAdShowing() {
    return !!video?.closest(".html5-video-player")?.classList.contains("ad-showing");
  }

  function attachVideo() {
    const el = findVideo();
    if (el === video) return;
    if (video) {
      for (const ev of ["timeupdate", "seeked", "play", "ratechange"]) video.removeEventListener(ev, check);
    }
    video = el;
    if (video) {
      for (const ev of ["timeupdate", "seeked", "play", "ratechange"]) video.addEventListener(ev, check);
    }
  }

  function mergeSegments(list) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    const merged = [];
    for (const seg of sorted) {
      const last = merged[merged.length - 1];
      if (last && seg.start <= last.end + 0.5) {
        last.end = Math.max(last.end, seg.end);
      } else {
        merged.push({ ...seg, undone: false });
      }
    }
    return merged;
  }

  async function loadSegments() {
    const id = currentVideoId();
    attachVideo();
    if (id === videoId) return;
    videoId = id;
    segments = [];
    clearTimeout(timer);
    if (!id || !settings.enabled) return;

    try {
      const res = await chrome.runtime.sendMessage({
        type: "getSegments",
        videoId: id,
        categories: settings.categories,
      });
      if (id !== videoId) return;
      if (res?.error) {
        console.warn("[Skip Sponsors]", res.error);
        return;
      }
      segments = mergeSegments(res?.segments ?? []);
      check();
    } catch (err) {
      console.warn("[Skip Sponsors]", err);
    }
  }

  function check() {
    clearTimeout(timer);
    if (!settings.enabled || !video || !segments.length || isAdShowing()) return;

    const t = video.currentTime;
    for (const seg of segments) {
      if (seg.undone) continue;
      if (t >= seg.start && t < seg.end - 0.05 && t - seg.start < ENTRY_WINDOW_SEC) {
        skip(seg);
        return;
      }
    }

    // timeupdate only fires ~4x/sec, so schedule a precise check for an imminent segment.
    const next = segments.find((s) => !s.undone && s.start > t);
    if (next && !video.paused) {
      const delayMs = ((next.start - t) / video.playbackRate) * 1000;
      if (delayMs < 1000) timer = setTimeout(check, Math.max(0, delayMs));
    }
  }

  function skip(seg) {
    video.currentTime = seg.end;
    recordStats(seg.end - seg.start);
    showToast(seg);
  }

  async function recordStats(seconds) {
    const { skipCount = 0, timeSaved = 0 } = await chrome.storage.local.get(["skipCount", "timeSaved"]);
    await chrome.storage.local.set({ skipCount: skipCount + 1, timeSaved: timeSaved + seconds });
  }

  function categoryLabel(id) {
    return SKIP_SPONSORS_CATEGORIES.find((c) => c.id === id)?.label ?? id;
  }

  function showToast(seg) {
    const player = video.closest(".html5-video-player") || document.body;
    if (!toast) {
      toast = document.createElement("div");
      toast.style.cssText = [
        "position:absolute", "right:16px", "bottom:72px", "z-index:9999",
        "display:flex", "gap:12px", "align-items:center",
        "padding:8px 12px", "border-radius:8px",
        "background:rgba(28,28,28,0.9)", "color:#fff",
        "font:500 13px Roboto,Arial,sans-serif",
      ].join(";");
    }
    toast.textContent = `Skipped: ${categoryLabel(seg.category)}`;

    const undo = document.createElement("button");
    undo.textContent = "Undo";
    undo.style.cssText =
      "background:none;border:1px solid #fff6;border-radius:4px;color:#3ea6ff;cursor:pointer;font:inherit;padding:2px 8px";
    undo.addEventListener("click", () => {
      seg.undone = true;
      video.currentTime = seg.start;
      hideToast();
    });
    toast.appendChild(undo);

    player.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }

  function hideToast() {
    toast?.remove();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of Object.keys(changes)) settings[key] = changes[key].newValue;
    videoId = null;
    loadSegments();
  });

  chrome.storage.sync.get(SKIP_SPONSORS_DEFAULTS).then((stored) => {
    settings = stored;
    loadSegments();
  });

  // YouTube is a single-page app; navigations don't reload the content script.
  document.addEventListener("yt-navigate-finish", loadSegments);
  setInterval(loadSegments, 1000);
})();
