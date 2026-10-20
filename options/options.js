const providerEl = document.getElementById("provider");
const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const keyLinkEl = document.getElementById("keyLink");

function flash(el, text) {
  el.textContent = text;
  setTimeout(() => (el.textContent = ""), 2500);
}

function updateProviderFields() {
  const provider = SKIP_SPONSORS_PROVIDERS[providerEl.value];
  apiKeyEl.disabled = modelEl.disabled = !provider;
  modelEl.placeholder = provider?.defaultModel ?? "";
  keyLinkEl.hidden = !provider;
  if (provider) {
    keyLinkEl.href = provider.keyUrl;
    keyLinkEl.textContent = `Get a ${provider.label} API key`;
  }
}

async function init() {
  for (const [id, p] of Object.entries(SKIP_SPONSORS_PROVIDERS)) {
    providerEl.add(new Option(p.label, id));
  }
  const ai = await chrome.storage.local.get(SKIP_SPONSORS_AI_DEFAULTS);
  providerEl.value = ai.provider;
  apiKeyEl.value = ai.apiKey;
  modelEl.value = ai.model;
  updateProviderFields();
}

providerEl.addEventListener("change", () => {
  modelEl.value = "";
  updateProviderFields();
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({
    provider: providerEl.value,
    apiKey: apiKeyEl.value.trim(),
    model: modelEl.value.trim(),
  });
  flash(document.getElementById("status"), "Saved");
});

document.getElementById("clearCache").addEventListener("click", async () => {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("analysis:"));
  await chrome.storage.local.remove(keys);
  flash(document.getElementById("cacheStatus"), `Cleared ${keys.length} videos`);
});

init();
