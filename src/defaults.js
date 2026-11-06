const SKIP_SPONSORS_CATEGORIES = [
  { id: "sponsor", label: "Sponsor" },
  { id: "selfpromo", label: "Self-promotion / merch" },
  { id: "interaction", label: "Like / subscribe reminders" },
  { id: "intro", label: "Intro animation" },
  { id: "outro", label: "Endcards / credits" },
  { id: "preview", label: "Preview / recap" },
  { id: "filler", label: "Filler tangents" },
  { id: "music_offtopic", label: "Non-music section (music videos)" },
];

// Categories the extension can detect on its own from chapters and transcripts.
const SKIP_SPONSORS_DETECTABLE = ["sponsor", "selfpromo", "interaction"];

const SKIP_SPONSORS_DEFAULTS = {
  enabled: true,
  detect: true,
  categories: ["sponsor", "selfpromo", "interaction"],
};

const SKIP_SPONSORS_PROVIDERS = {
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.5-flash-lite", keyUrl: "https://aistudio.google.com/apikey" },
  openai: { label: "OpenAI", defaultModel: "gpt-4.1-mini", keyUrl: "https://platform.openai.com/api-keys" },
  anthropic: { label: "Anthropic", defaultModel: "claude-haiku-4-5", keyUrl: "https://console.anthropic.com/settings/keys" },
};

// Stored in chrome.storage.local so the API key never syncs across devices.
const SKIP_SPONSORS_AI_DEFAULTS = {
  provider: "none",
  apiKey: "",
  model: "",
};
