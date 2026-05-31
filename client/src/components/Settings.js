/**
 * AI Settings component.
 * Provider selector, model selector, and API key input.
 * Settings persist in localStorage.
 */
import { getProviders } from '../api.js';
import { showToast } from './Toast.js';

let providers = [];

export async function initSettings() {
  const providerSelect = document.getElementById('providerSelect');
  const modelSelect = document.getElementById('modelSelect');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleKeyBtn = document.getElementById('toggleApiKey');
  const settingsStatus = document.getElementById('settingsStatus');

  if (!providerSelect || !modelSelect || !apiKeyInput) return;

  // Load saved settings
  const saved = loadSettings();

  // Fetch providers from server
  try {
    providers = await getProviders();
  } catch {
    providers = [
      { id: 'groq', name: 'Groq', models: [{ id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' }], defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct', requiresKey: true },
    ];
  }

  // Populate provider dropdown
  providerSelect.innerHTML = '';
  providers.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    providerSelect.appendChild(opt);
  });

  // Set saved provider
  if (saved.provider && providers.find(p => p.id === saved.provider)) {
    providerSelect.value = saved.provider;
  }

  // Populate models for selected provider
  function updateModels() {
    const provider = providers.find(p => p.id === providerSelect.value);
    if (!provider) return;

    modelSelect.innerHTML = '';
    provider.models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      modelSelect.appendChild(opt);
    });

    // Restore saved model if it belongs to this provider
    if (saved.model && saved.provider === providerSelect.value) {
      const hasModel = provider.models.find(m => m.id === saved.model);
      if (hasModel) modelSelect.value = saved.model;
    }

    // Update key requirement hint
    updateKeyHint(provider);
  }

  function updateKeyHint(provider) {
    if (provider.requiresKey && !apiKeyInput.value.trim()) {
      settingsStatus.textContent = `⚠ ${provider.name} requires an API key`;
      settingsStatus.className = 'settings-status warn';
    } else {
      settingsStatus.textContent = `✓ ${provider.name} ready`;
      settingsStatus.className = 'settings-status ok';
    }
  }

  // Event: provider changed
  providerSelect.addEventListener('change', () => {
    saved.provider = providerSelect.value;
    saved.model = undefined; // reset model on provider change
    updateModels();
    saveSettings();
  });

  // Event: model changed
  modelSelect.addEventListener('change', () => {
    saveSettings();
  });

  // Event: API key changed
  apiKeyInput.value = saved.apiKey || '';
  apiKeyInput.addEventListener('input', () => {
    saveSettings();
    const provider = providers.find(p => p.id === providerSelect.value);
    if (provider) updateKeyHint(provider);
  });

  // Event: toggle key visibility
  if (toggleKeyBtn) {
    toggleKeyBtn.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      toggleKeyBtn.querySelector('i').className =
        apiKeyInput.type === 'password' ? 'ti ti-eye' : 'ti ti-eye-off';
    });
  }

  // Save helper
  function saveSettings() {
    const settings = {
      provider: providerSelect.value,
      model: modelSelect.value,
      apiKey: apiKeyInput.value.trim(),
    };
    localStorage.setItem('ai_settings', JSON.stringify(settings));
  }

  // Initial render
  updateModels();
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('ai_settings');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}
