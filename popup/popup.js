const enabledEl = document.getElementById("enabled");
const categoriesEl = document.getElementById("categories");

function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

async function init() {
  const settings = await chrome.storage.sync.get(SKIP_SPONSORS_DEFAULTS);
  enabledEl.checked = settings.enabled;
  enabledEl.addEventListener("change", () => chrome.storage.sync.set({ enabled: enabledEl.checked }));

  for (const cat of SKIP_SPONSORS_CATEGORIES) {
    const label = document.createElement("label");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = cat.id;
    box.checked = settings.categories.includes(cat.id);
    box.addEventListener("change", saveCategories);
    label.append(box, cat.label);
    categoriesEl.appendChild(label);
  }

  const { skipCount = 0, timeSaved = 0 } = await chrome.storage.local.get(["skipCount", "timeSaved"]);
  document.getElementById("skipCount").textContent = skipCount;
  document.getElementById("timeSaved").textContent = formatDuration(timeSaved);
}

function saveCategories() {
  const categories = [...categoriesEl.querySelectorAll("input:checked")].map((el) => el.value);
  chrome.storage.sync.set({ categories });
}

init();
