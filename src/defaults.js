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

const SKIP_SPONSORS_DEFAULTS = {
  enabled: true,
  categories: ["sponsor", "selfpromo", "interaction"],
};
