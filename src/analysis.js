const ANALYSIS_VERSION = 1;
const MIN_SEGMENT_SEC = 3;
const MIN_CONFIDENCE = 0.6;
const MAX_DESCRIPTION_CHARS = 3000;
const MAX_TRANSCRIPT_CHARS = 400000;

// ---------- Chapter titles ----------

const CHAPTER_PATTERNS = {
  sponsor:
    /\b(sponsor(ed|ship|s)?|ads?|advert(isement)?s?|ad[- ]?read|paid promo(tion)?|promo|brought to you by|word from (our|today'?s) sponsor)\b|werbung|publicit[ée]|\bpub\b|sponsoris|patrocin|anuncio|reklam|реклам|спонсор|赞助|広告|スポンサー/i,
  selfpromo: /\b(merch|patreon|my course|support (the|this|my) channel|channel membership|plug)\b|мерч|патреон/i,
  interaction: /\b(like (and|&) subscribe|subscribe)\b|подпи(шись|сывайтесь)/i,
};

function classifyChapters(chapters) {
  const segments = [];
  for (const ch of chapters) {
    const category = Object.keys(CHAPTER_PATTERNS).find((cat) => CHAPTER_PATTERNS[cat].test(ch.title));
    if (category) {
      segments.push({ start: ch.start, end: ch.end, category, source: "chapters", reason: `Chapter "${ch.title}"` });
    }
  }
  return segments;
}

// ---------- Keyword heuristics (no API key) ----------

const AD_START =
  /sponsor(ed|ing)? (by|this|today)|today'?s sponsor|brought to you by|(partner(ed|ing)?|teamed up) with|thanks? (you )?to .{1,40} for (sponsoring|supporting|partnering)|sponsoris[ée]e? par|patrocinad[oa] por|gesponsert|unterstützt von|спонсор|при поддержке|реклам/i;
const AD_CALL_TO_ACTION =
  /promo ?code|use (my )?code|coupon|discount|\d+ ?(%|percent) off|free trial|link (is )?(in|below)|in the description|sign up|first \d+ (people|users)|\.com|dot com|code promo|lien|description|disponible (en|sur|dès)|código|enlace|descripción|rabatt|gutschein|beschreibung|промокод|скидк|ссылк|описани/i;
const AD_END =
  /back to (the|today'?s|our)? ?(video|topic|show|episode)|now,? (let'?s|back)|without further ado|and now,? (on|back)|revenons|(place à|tout de suite,?) (la|votre|notre) vidéo|retour (à|au)|volvamos|zurück zum|вернёмся|вернемся/i;
const HEURISTIC_MAX_SEC = 150;
const HEURISTIC_MIN_SEC = 10;

// Auto-captions split speech into ~2s cues, so a phrase like "today's | sponsor" can straddle two cues.
// A match counts at cue i if it's inside cue i or spans into cue i+1, but not if it's wholly inside cue i+1.
function matchesAt(re, cues, i) {
  if (re.test(cues[i].text)) return true;
  const next = cues[i + 1]?.text;
  return next !== undefined && re.test(`${cues[i].text} ${next}`) && !re.test(next);
}

function detectWithHeuristics(cues) {
  const segments = [];
  for (let i = 0; i < cues.length; i++) {
    if (!matchesAt(AD_START, cues, i)) continue;
    const start = cues[i].start;
    let lastCta = -1;
    let end = null;
    let j = i;
    for (; j < cues.length && cues[j].start - start <= HEURISTIC_MAX_SEC; j++) {
      if (j > i && matchesAt(AD_END, cues, j)) {
        end = cues[j].start;
        break;
      }
      if (matchesAt(AD_CALL_TO_ACTION, cues, j)) lastCta = j;
    }
    // A sponsor mention without any call to action is usually just a passing reference.
    if (lastCta === -1) continue;
    end ??= cues[lastCta + 1]?.start ?? cues[lastCta].start + 5;
    if (end - start >= HEURISTIC_MIN_SEC) {
      const reason = `${cues[i].text} ${cues[i + 1]?.text ?? ""}`.trim();
      segments.push({ start, end, category: "sponsor", source: "transcript", reason });
      while (i + 1 < cues.length && cues[i + 1].start < end) i++;
    }
  }
  return segments;
}

// ---------- Language model ----------

const SYSTEM_PROMPT = `You find advertising segments in YouTube video transcripts. Transcripts can be in any language and often come from automatic speech recognition, so expect misspelled brand names.

Find these segment types:
- "sponsor": a paid promotion of a third-party product, service, or company that is inserted into the video. Typical signs: "this video is sponsored by", "thanks to X for supporting the channel", promo codes, discount offers, "link in the description", a sudden switch to talking about an unrelated product. The video description often lists the sponsor's link or promo code, which tells you what brand to look for.
- "selfpromo": unpaid promotion of the creator's own things: merch, Patreon, channel memberships, courses, their other channels.
- "interaction": a standalone request to like, subscribe, comment, or turn on notifications. Ignore brief passing mentions.

Do not flag the video's actual subject matter. If the whole video is a review or discussion of a product, that is not an inserted ad.

Each transcript line starts with its start time in seconds, in brackets. For each segment, "start" is the time of the first line of the segment and "end" is the time of the first line after the segment where normal content resumes (or the video duration if it runs to the end).

Respond with JSON only, in this shape:
{"segments":[{"category":"sponsor","start":12,"end":75,"confidence":0.9,"reason":"short explanation"}]}
Return {"segments":[]} if there are none.`;

function formatTranscript(cues) {
  const lines = [];
  let current = null;
  for (const cue of cues) {
    if (current && cue.start - current.start < 5) {
      current.text += " " + cue.text;
    } else {
      current = { start: cue.start, text: cue.text };
      lines.push(current);
    }
  }
  return lines
    .map((l) => `[${Math.floor(l.start)}] ${l.text}`)
    .join("\n")
    .slice(0, MAX_TRANSCRIPT_CHARS);
}

function buildUserPrompt(info) {
  const chapters = info.chapters.length
    ? info.chapters.map((c) => `[${Math.floor(c.start)}-${Math.floor(c.end)}] ${c.title}`).join("\n")
    : "(none)";
  return [
    `Title: ${info.title}`,
    `Channel: ${info.author}`,
    `Duration: ${info.duration} seconds`,
    `Description:\n${info.description.slice(0, MAX_DESCRIPTION_CHARS)}`,
    `Chapters:\n${chapters}`,
    `Transcript:\n${formatTranscript(info.transcript)}`,
  ].join("\n\n");
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`${new URL(url).host} returned ${res.status}: ${detail}`);
  }
  return res.json();
}

const LLM_PROVIDERS = {
  async gemini({ apiKey, model }, userPrompt) {
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": apiKey },
      {
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      },
    );
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  },

  async openai({ apiKey, model }, userPrompt) {
    const data = await postJson(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      {
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      },
    );
    return data.choices?.[0]?.message?.content ?? "";
  },

  async anthropic({ apiKey, model }, userPrompt) {
    const data = await postJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      {
        model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
    );
    return data.content?.find((c) => c.type === "text")?.text ?? "";
  },
};

function parseModelJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error(`Model returned no JSON: ${text.slice(0, 200)}`);
  return JSON.parse(text.slice(start, end + 1));
}

async function detectWithLlm(info, ai) {
  const model = ai.model || SKIP_SPONSORS_PROVIDERS[ai.provider].defaultModel;
  const raw = await LLM_PROVIDERS[ai.provider]({ apiKey: ai.apiKey, model }, buildUserPrompt(info));
  const parsed = parseModelJson(raw);
  return (parsed.segments ?? [])
    .filter((s) => SKIP_SPONSORS_DETECTABLE.includes(s.category) && (s.confidence ?? 1) >= MIN_CONFIDENCE)
    .map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      category: s.category,
      source: "AI transcript analysis",
      reason: s.reason ?? "",
    }));
}

// ---------- Orchestration ----------

function analysisMode(ai) {
  return ai.provider in SKIP_SPONSORS_PROVIDERS && ai.apiKey ? `llm:${ai.provider}` : "heuristic";
}

async function loadAiSettings() {
  return chrome.storage.local.get(SKIP_SPONSORS_AI_DEFAULTS);
}

async function getCachedAnalysis(videoId) {
  const key = `analysis:${videoId}`;
  const cached = (await chrome.storage.local.get(key))[key];
  if (!cached || cached.version !== ANALYSIS_VERSION) return null;
  // A heuristic result is worth redoing once an API key is configured; an AI result never is.
  if (cached.mode === "heuristic" && analysisMode(await loadAiSettings()) !== "heuristic") return null;
  return cached.segments;
}

function sanitize(segments, duration) {
  return segments
    .map((s) => ({ ...s, start: Math.max(0, s.start), end: duration ? Math.min(s.end, duration) : s.end }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end - s.start >= MIN_SEGMENT_SEC)
    // Guards against a model labeling most of the video; chapter labels are trusted as-is.
    .filter((s) => s.source === "chapters" || !duration || s.end - s.start <= duration * 0.5);
}

async function analyzeVideo(info) {
  const ai = await loadAiSettings();
  let mode = analysisMode(ai);
  const segments = classifyChapters(info.chapters);

  if (info.transcript) {
    if (mode !== "heuristic") {
      try {
        segments.push(...(await detectWithLlm(info, ai)));
      } catch (err) {
        console.warn("[Skip Sponsors] AI analysis failed, falling back to keywords:", err);
        mode = "heuristic";
      }
    }
    if (mode === "heuristic") segments.push(...detectWithHeuristics(info.transcript));
  }

  const result = sanitize(segments, info.duration);
  await chrome.storage.local.set({
    [`analysis:${info.videoId}`]: { version: ANALYSIS_VERSION, mode, segments: result, createdAt: Date.now() },
  });
  return result;
}
