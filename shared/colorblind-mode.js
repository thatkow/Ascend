const STORAGE_KEY = 'ascend.colorblindMode';
const COLORBLIND_CLASS = 'colorblind-mode';
const listeners = new Set();
let toggleButton = null;
let colorblindModeEnabled = readInitialState();

function readInitialState() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch (error) {
    console.error('Unable to read colorblind mode preference:', error);
    return false;
  }
}

function persistState() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, colorblindModeEnabled ? 'true' : 'false');
  } catch (error) {
    console.error('Unable to save colorblind mode preference:', error);
  }
}

function applyModeToDocument() {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  document.body.classList.toggle(COLORBLIND_CLASS, colorblindModeEnabled);
}

function updateToggleButtonState() {
  if (!toggleButton) {
    return;
  }

  const label = colorblindModeEnabled ? 'Colorblind mode: On' : 'Colorblind mode: Off';
  const description = colorblindModeEnabled ? 'Disable colorblind mode' : 'Enable colorblind mode';
  toggleButton.textContent = label;
  toggleButton.setAttribute('aria-pressed', String(colorblindModeEnabled));
  toggleButton.setAttribute('aria-label', description);
  toggleButton.setAttribute('title', description);
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener(colorblindModeEnabled);
    } catch (error) {
      console.error('Colorblind mode listener failed:', error);
    }
  });
}

function updateColorblindMode(enabled, { persist = true } = {}) {
  const normalized = Boolean(enabled);
  if (colorblindModeEnabled === normalized) {
    return;
  }

  colorblindModeEnabled = normalized;
  if (persist) {
    persistState();
  }
  applyModeToDocument();
  updateToggleButtonState();
  notifyListeners();
}

function ensureToggleButton() {
  if (typeof document === 'undefined') {
    return null;
  }

  if (toggleButton && document.body?.contains(toggleButton)) {
    return toggleButton;
  }

  if (!document.body) {
    return null;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'colorblind-toggle';
  button.addEventListener('click', () => {
    toggleColorblindMode();
  });

  document.body.appendChild(button);
  toggleButton = button;
  updateToggleButtonState();
  return button;
}

export function initializeColorblindModeToggle() {
  if (typeof document === 'undefined') {
    return null;
  }

  const attachButton = () => {
    applyModeToDocument();
    return ensureToggleButton();
  };

  if (document.readyState === 'loading') {
    let initialized = false;
    const init = () => {
      if (initialized) {
        return;
      }
      initialized = true;
      attachButton();
    };
    document.addEventListener('DOMContentLoaded', init, { once: true });
    return null;
  }

  return attachButton();
}

export function isColorblindModeEnabled() {
  return colorblindModeEnabled;
}

export function setColorblindMode(value) {
  updateColorblindMode(value);
}

export function toggleColorblindMode() {
  updateColorblindMode(!colorblindModeEnabled);
}

export function onColorblindModeChange(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    const nextValue = event.newValue === 'true';
    updateColorblindMode(nextValue, { persist: false });
  });
}

applyModeToDocument();
if (typeof document !== 'undefined' && document.readyState !== 'loading') {
  ensureToggleButton();
} else {
  initializeColorblindModeToggle();
}
