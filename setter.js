import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  limit,
  where,
  deleteDoc,
  deleteField,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { auth, db } from './shared/firebase.js';
import {
  LOCATIONS,
  LOCATION_STORAGE_KEY,
  WALL_QUERY_PARAM,
  getDefaultLocation,
  isLocationVisible,
} from './shared/location.js';

const authOverlay = document.getElementById('authOverlay');
const appContent = document.getElementById('appContent');
const canvasContainer = document.querySelector('.canvas-container');
const canvas = document.getElementById('drawingCanvas');
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const authTitle = document.getElementById('authTitle');
const authSwitchLabel = document.getElementById('authSwitchLabel');
const toggleAuthModeButton = document.getElementById('toggleAuthMode');
const signOutButton = document.getElementById('signOutButton');
const unauthorizedSignOut = document.getElementById('unauthorizedSignOut');
const unauthorizedNotice = document.getElementById('unauthorizedNotice');
const routeSelector = document.getElementById('routeSelector');
const routeSetterInput = document.getElementById('routeSetterInput');
const routeTitleInput = document.getElementById('routeTitleInput');
const routeDescriptionInput = document.getElementById('routeDescriptionInput');
const routeDateSetInput = document.getElementById('routeDateSetInput');
const deleteButton = document.getElementById('deleteButton');
const routeStatus = document.getElementById('routeStatus');
const routeHiddenCheckbox = document.getElementById('routeHiddenCheckbox');
const controlPanel = document.querySelector('.control-panel');
const drawingToggle = document.getElementById('drawingToggle');
const panelSidebar = document.getElementById('panelSidebar');
const panelToggleButton = document.getElementById('panelToggle');
const infoButton = document.getElementById('infoButton');
const infoPopover = document.getElementById('infoPopover');
const startTutorialButton = document.getElementById('startTutorialButton');
const climberViewButton = document.getElementById('climberViewButton');
const personalDashboardButton = document.getElementById('personalDashboardButton');
const adminConsoleButton = document.getElementById('adminConsoleButton');
const adminConsoleStatus = document.getElementById('adminConsoleStatus');
const previewLink = document.getElementById('previewLink');
const previewLinkBaseHref = previewLink?.getAttribute('href') || 'index.html';
const climberViewBaseHref = 'index.html';
let climberViewTargetHref = climberViewBaseHref;

async function signOutAndRedirectToIndex() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Failed to sign out:', error);
    return false;
  }

  window.location.href = 'index.html';
  return true;
}
const locationButton = document.getElementById('locationButton');
const locationButtonLabel = locationButton?.querySelector('.button-label');
const locationModal = document.getElementById('locationModal');
const locationOptions = document.getElementById('locationOptions');
const locationModalClose = document.getElementById('locationModalClose');
const routesTabButton = document.getElementById('routesTabButton');
const wallsTabButton = document.getElementById('wallsTabButton');
const configurationTabButton = document.getElementById('configurationTabButton');
const tabButtons = [routesTabButton, wallsTabButton, configurationTabButton].filter(Boolean);
const tabPanels = {
  routesTab: document.getElementById('routesTab'),
  wallsTab: document.getElementById('wallsTab'),
  configurationTab: document.getElementById('configurationTab'),
};
const newWallNameInput = document.getElementById('newWallNameInput');
const newWallImageInput = document.getElementById('newWallImageInput');
const createWallButton = document.getElementById('createWallButton');
const deleteWallButton = document.getElementById('deleteWallButton');
const createWallStatus = document.getElementById('createWallStatus');
const wallVisibilityToggleWrapper = document.getElementById('wallVisibilityToggleWrapper');
const wallVisibilityToggle = document.getElementById('wallVisibilityToggle');
const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialDialogCard = document.getElementById('tutorialDialogCard');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialDescription = document.getElementById('tutorialDescription');
const tutorialPrimaryAction = document.getElementById('tutorialPrimaryAction');
const tutorialSecondaryAction = document.getElementById('tutorialSecondaryAction');
const tutorialProgress = document.getElementById('tutorialProgress');

let isUpdatingWallVisibility = false;
let tutorialPointer = null;
let tutorialPointerTarget = null;
let tutorialHighlightedElement = null;
let tutorialHighlightedElementOptions = { illuminate: false };
let tutorialPreviousFocus = null;
let tutorialActive = false;
let tutorialTransitionInProgress = false;
let tutorialStepIndex = -1;
let tutorialSteps = [];
let tutorialPreviousTabId = null;
let tutorialSecondaryActionMode = 'back';
let tutorialAutostartTimeoutId = null;
let tutorialAutostartAttempts = 0;

const PATH_TYPE_BREZER = 'brezer';
const PATH_TYPE_HOLLOW_POINT = 'hollow-point';
const PATH_TYPE_FILLED_POINT = 'filled-point';
const PATH_TYPE_RECTANGLE = 'rectangle';
const OVERLAP_GROUP_TYPE_POINT = 'point-group';
const LEGACY_PATH_TYPE_POINT = 'point';
const DEFAULT_PATH_TYPE = PATH_TYPE_BREZER;
const BREZER_REMOVAL_RADIUS = 20;
const MIN_POINT_DIAMETER = 12;
const MAX_POINT_DIAMETER = 160;
const DEFAULT_HOLLOW_POINT_DIAMETER = 48;
const DEFAULT_FILLED_POINT_DIAMETER = 48;
const DEFAULT_POINT_DIAMETER = DEFAULT_HOLLOW_POINT_DIAMETER;
const MIN_HOLLOW_POINT_LINE_WIDTH = 1;
const MAX_HOLLOW_POINT_LINE_WIDTH = 48;
const DEFAULT_HOLLOW_POINT_LINE_WIDTH = Math.max(
  MIN_HOLLOW_POINT_LINE_WIDTH,
  Math.min(MAX_HOLLOW_POINT_LINE_WIDTH, Math.round(DEFAULT_HOLLOW_POINT_DIAMETER / 10) || 2),
);
const MIN_RECTANGLE_SIZE = 12;
const MAX_RECTANGLE_SIZE = 200;
const DEFAULT_RECTANGLE_WIDTH = 80;
const DEFAULT_RECTANGLE_HEIGHT = 60;
const MIN_BREZER_STROKE_WIDTH = 2;
const MAX_BREZER_STROKE_WIDTH = 40;
const DEFAULT_BREZER_STROKE_WIDTH = 10;
const MIN_UNFOCUSED_TRANSPARENCY = 0;
const MAX_UNFOCUSED_TRANSPARENCY = 1;
const DEFAULT_UNFOCUSED_TRANSPARENCY = 0.25;
const MIN_GRADE_VALUE = 5;
const MAX_GRADE_VALUE = 30;
const MIN_GRADE_BAR_BASE_HEIGHT = 0;
const MAX_GRADE_BAR_HEIGHT = 1000;
const DEFAULT_GRADE_BAR_BASE_HEIGHT = 40;
const DEFAULT_GRADE_BAR_MAX_HEIGHT = 220;
const MIN_GRADE_BAR_WIDTH = 4;
const MAX_GRADE_BAR_WIDTH = 160;
const DEFAULT_GRADE_BAR_WIDTH = 24;
const DEFAULT_GRADE_BAR_TRANSPARENCY = 0.85;
const WALL_COLLECTION = 'walls';

const normalizeLocationName = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizeWallKey = (value) => normalizeLocationName(value);

const BUILTIN_LOCATION_KEYS = new Set(
  LOCATIONS.map((location) => normalizeWallKey(location?.key || location?.name)).filter(Boolean),
);

const findLocationByKey = (key) => LOCATIONS.find((location) => location.key === key);

const findLocationByName = (name) => {
  const normalized = normalizeLocationName(name);
  return (
    LOCATIONS.find((location) => normalizeLocationName(location.name) === normalized) || null
  );
};

function buildWallAwareHref(baseHref, wallKey) {
  const normalizedKey = normalizeWallKey(wallKey);
  if (typeof baseHref !== 'string' || !baseHref) {
    return '';
  }

  try {
    const url = new URL(baseHref, window.location.origin);
    if (normalizedKey) {
      url.searchParams.set(WALL_QUERY_PARAM, normalizedKey);
    } else {
      url.searchParams.delete(WALL_QUERY_PARAM);
    }
    url.hash = '';
    const relativePath = `${url.pathname.replace(/^\//, '')}${url.search}`;
    return relativePath || baseHref;
  } catch (error) {
    if (!normalizedKey) {
      return baseHref;
    }

    const separator = baseHref.includes('?') ? '&' : '?';
    return `${baseHref}${separator}${encodeURIComponent(WALL_QUERY_PARAM)}=${encodeURIComponent(normalizedKey)}`;
  }
}

function getWallKeyFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(WALL_QUERY_PARAM);
    return normalizeWallKey(raw);
  } catch (error) {
    console.warn('Unable to read wall from query string:', error);
    return '';
  }
}

function updateWallQueryParam(wallKey) {
  try {
    const normalizedKey = normalizeWallKey(wallKey);
    const url = new URL(window.location.href);
    if (normalizedKey) {
      url.searchParams.set(WALL_QUERY_PARAM, normalizedKey);
    } else {
      url.searchParams.delete(WALL_QUERY_PARAM);
    }
    url.hash = '';
    const next = url.toString();
    if (next !== window.location.href) {
      window.history.replaceState({}, '', next);
    }
  } catch (error) {
    console.warn('Unable to update wall query parameter:', error);
  }
}

function persistSelectedWall(wallKey) {
  const normalizedKey = normalizeWallKey(wallKey);
  try {
    if (normalizedKey) {
      window.localStorage?.setItem(LOCATION_STORAGE_KEY, normalizedKey);
    } else {
      window.localStorage?.removeItem(LOCATION_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Unable to persist setter location preference:', error);
  }
}

function updateWallNavigationTargets(wallKey) {
  const normalizedKey = normalizeWallKey(wallKey);
  if (previewLink) {
    previewLink.href = buildWallAwareHref(previewLinkBaseHref, normalizedKey);
  }

  const computedClimberHref = buildWallAwareHref(climberViewBaseHref, normalizedKey);
  climberViewTargetHref = computedClimberHref;
  if (climberViewButton) {
    climberViewButton.setAttribute('data-target-href', computedClimberHref);
  }
}

function upsertLocation({
  key = '',
  name = '',
  image = '',
  fallbackName = '',
  hidden = false,
} = {}) {
  const trimmedName = typeof name === 'string' && name.trim() ? name.trim() : '';
  const fallback =
    trimmedName || (typeof fallbackName === 'string' && fallbackName.trim() ? fallbackName.trim() : '');
  const keySource = typeof key === 'string' && key.trim() ? key.trim() : fallback;
  const normalizedKey = normalizeWallKey(keySource);
  const displayName = fallback;
  if (!normalizedKey || !displayName) {
    return { entry: null, changed: false };
  }

  const normalizedImage = typeof image === 'string' ? image.trim() : '';
  const normalizedHidden = Boolean(hidden);
  const existingIndex = LOCATIONS.findIndex((location) => {
    if (!location) {
      return false;
    }
    if (location.key === normalizedKey) {
      return true;
    }
    return normalizeLocationName(location.name) === normalizeLocationName(displayName);
  });

  if (existingIndex >= 0) {
    const existing = LOCATIONS[existingIndex];
    const needsUpdate =
      existing.key !== normalizedKey ||
      existing.name !== displayName ||
      existing.image !== normalizedImage ||
      Boolean(existing.hidden) !== normalizedHidden;

    if (!needsUpdate) {
      return { entry: existing, changed: false };
    }

    const updated = {
      ...existing,
      key: normalizedKey,
      name: displayName,
      image: normalizedImage,
      hidden: normalizedHidden,
    };
    LOCATIONS[existingIndex] = updated;
    return { entry: updated, changed: true };
  }

  const created = {
    key: normalizedKey,
    name: displayName,
    image: normalizedImage,
    hidden: normalizedHidden,
  };
  LOCATIONS.push(created);
  return { entry: created, changed: true };
}

function synchronizeCurrentLocationReference() {
  if (!currentLocation) {
    return;
  }

  const normalizedKey = normalizeWallKey(currentLocation.key || currentLocation.name);
  const refreshed =
    (normalizedKey && findLocationByKey(normalizedKey)) ||
    findLocationByName(currentLocation.name);

  if (refreshed && refreshed !== currentLocation) {
    currentLocation = refreshed;
    updateLocationButtonLabel();
    updateLocationOptionsState();
    updateBackgroundForCurrentLocation();
    const activeKey = getCurrentLocationKey();
    updateWallNavigationTargets(activeKey);
    updateWallQueryParam(activeKey);
    persistSelectedWall(activeKey);
  }

  updateWallVisibilityControls();
}

const DEFAULT_LOCATION = LOCATIONS[0];

let currentLocation = DEFAULT_LOCATION;
let backgroundImageSource = '';
let backgroundReady = false;

const wallSettingsCache = new Map();
const wallDocumentIdMap = new Map();

const backgroundImage = new Image();

const updateLocationButtonLabel = () => {
  const baseName = currentLocation?.name || 'Select wall';
  const suffix = currentLocation?.hidden ? ' (Hidden)' : '';
  const labelText = `${baseName}${suffix}`;
  if (locationButtonLabel) {
    locationButtonLabel.textContent = labelText;
  }
  if (locationButton) {
    locationButton.setAttribute('aria-label', `Select wall: ${labelText}`);
    locationButton.setAttribute('title', labelText);
  }
};

const updateLocationOptionsState = () => {
  if (!locationOptions) {
    return;
  }

  const buttons = locationOptions.querySelectorAll('[data-location-key]');
  buttons.forEach((button) => {
    const key = button?.dataset?.locationKey;
    if (key && currentLocation && key === currentLocation.key) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });
};

const updateDeleteWallButtonState = () => {
  if (!deleteWallButton) {
    return;
  }

  if (isDeletingWall) {
    deleteWallButton.disabled = true;
    return;
  }

  const activeKey = getCurrentLocationKey();
  const normalizedActiveKey = normalizeWallKey(activeKey);
  const hasAlternativeWall = LOCATIONS.some((location) => {
    if (!location) {
      return false;
    }
    const candidateKey = normalizeWallKey(location.key || location.name);
    return candidateKey && candidateKey !== normalizedActiveKey;
  });

  deleteWallButton.disabled = !normalizedActiveKey || !hasAlternativeWall;
};

function updateLocationHiddenFlag(locationKey, hidden) {
  const normalizedKey = normalizeWallKey(locationKey);
  if (!normalizedKey) {
    return;
  }

  LOCATIONS.forEach((location) => {
    if (!location) {
      return;
    }
    const candidateKey = normalizeWallKey(location.key || location.name);
    if (candidateKey === normalizedKey) {
      location.hidden = hidden;
    }
  });

  if (currentLocation) {
    const currentKey = normalizeWallKey(currentLocation.key || currentLocation.name);
    if (currentKey === normalizedKey) {
      currentLocation.hidden = hidden;
    }
  }
}

const updateWallVisibilityControls = () => {
  if (!wallVisibilityToggle) {
    return;
  }

  const isHidden = Boolean(currentLocation?.hidden);
  wallVisibilityToggle.checked = isHidden;
  wallVisibilityToggle.setAttribute('aria-checked', isHidden ? 'true' : 'false');

  const disabled = !currentLocation || isUpdatingWallVisibility;
  wallVisibilityToggle.disabled = disabled;
  wallVisibilityToggle.setAttribute('aria-disabled', disabled ? 'true' : 'false');

  if (wallVisibilityToggleWrapper) {
    wallVisibilityToggleWrapper.classList.toggle('is-disabled', disabled);
  }
};

async function applyWallVisibilityChange(nextHidden) {
  const locationKey = getCurrentLocationKey();
  if (!locationKey || !currentLocation) {
    updateWallVisibilityControls();
    return;
  }

  const normalizedNext = Boolean(nextHidden);
  const previousHidden = Boolean(currentLocation.hidden);
  if (normalizedNext === previousHidden) {
    updateWallVisibilityControls();
    return;
  }

  isUpdatingWallVisibility = true;
  updateWallVisibilityControls();

  updateLocationHiddenFlag(locationKey, normalizedNext);
  updateLocationButtonLabel();
  renderLocationOptions();
  updateLocationOptionsState();
  updateWallVisibilityControls();

  try {
    const locationDetails =
      findLocationByKey(locationKey) ||
      findLocationByName(currentLocation.name) ||
      currentLocation;

    const wallPayload = {
      hidden: normalizedNext,
      updatedAt: serverTimestamp(),
      key: locationKey,
    };

    if (locationDetails?.name) {
      wallPayload.name = locationDetails.name;
    }

    if (locationDetails?.image) {
      wallPayload.background_url = locationDetails.image;
    }

    const docId = wallDocumentIdMap.get(locationKey) || locationKey;
    await setDoc(doc(db, WALL_COLLECTION, docId), wallPayload, { merge: true });

    setStatus(
      normalizedNext ? 'Wall hidden from climbers.' : 'Wall visible to climbers.',
      'success',
    );
  } catch (error) {
    console.error('Failed to update wall visibility:', error);
    setStatus('Failed to update wall visibility. Please try again.', 'error');

    updateLocationHiddenFlag(locationKey, previousHidden);
    if (wallVisibilityToggle) {
      wallVisibilityToggle.checked = previousHidden;
      wallVisibilityToggle.setAttribute('aria-checked', previousHidden ? 'true' : 'false');
    }
    updateLocationButtonLabel();
    renderLocationOptions();
    updateLocationOptionsState();
  } finally {
    isUpdatingWallVisibility = false;
    updateWallVisibilityControls();
  }
}

const applyBodyBackground = (imagePath) => {
  if (!document.body) {
    return;
  }

  if (imagePath) {
    document.body.style.setProperty('--wall-background', `url('${imagePath}')`);
  } else {
    document.body.style.removeProperty('--wall-background');
  }
};

function activateTab(targetId) {
  if (!targetId) {
    return;
  }

  tabButtons.forEach((button) => {
    if (!button) {
      return;
    }
    const isActive = button.dataset?.target === targetId;
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  Object.values(tabPanels).forEach((panel) => {
    if (!panel) {
      return;
    }
    const isActive = panel.id === targetId;
    panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
  });

  updateHelpTooltips();
}

const updateBackgroundForCurrentLocation = () => {
  const imagePath = currentLocation?.image || '';
  applyBodyBackground(imagePath);

  if (imagePath && imagePath !== backgroundImageSource) {
    backgroundImageSource = imagePath;
    backgroundReady = false;
    backgroundImage.src = imagePath;
  } else if (!imagePath) {
    backgroundImageSource = '';
    backgroundReady = false;
  }
};

const closeLocationModal = () => {
  if (!locationModal) {
    return;
  }

  if (!locationModal.classList.contains('hidden')) {
    locationModal.classList.add('hidden');
    locationModal.setAttribute('aria-hidden', 'true');
    locationButton?.setAttribute('aria-expanded', 'false');
    updateHelpTooltips();
  }
};

const openLocationModal = () => {
  if (!locationModal) {
    return;
  }

  locationModal.classList.remove('hidden');
  locationModal.setAttribute('aria-hidden', 'false');
  locationButton?.setAttribute('aria-expanded', 'true');
  registerHelpTargets(locationModal);
  updateHelpTooltips();
  updateLocationOptionsState();
};

const setLocation = (
  location,
  { persist = true, refreshRoutes = true, wallFallback = null } = {},
) => {
  const targetLocation = location || DEFAULT_LOCATION;
  if (!targetLocation) {
    return;
  }

  const { entry: canonicalLocation, changed: locationEntryChanged } = upsertLocation({
    key: typeof targetLocation?.key === 'string' ? targetLocation.key : '',
    name: typeof targetLocation?.name === 'string' ? targetLocation.name : '',
    image: typeof targetLocation?.image === 'string' ? targetLocation.image : '',
    fallbackName: typeof targetLocation?.name === 'string' ? targetLocation.name : '',
    hidden: Boolean(targetLocation?.hidden),
  });

  if (!canonicalLocation) {
    return;
  }

  if (locationEntryChanged) {
    renderLocationOptions();
  }

  const previousKey = getCurrentLocationKey();
  const nextKey = normalizeWallKey(canonicalLocation.key || canonicalLocation.name);
  const changed = previousKey !== nextKey;

  currentLocation = canonicalLocation;
  clearRouteFocus();
  updateWallVisibilityControls();
  updateLocationButtonLabel();
  updateLocationOptionsState();
  updateBackgroundForCurrentLocation();
  updateDeleteWallButtonState();

  if (locationEntryChanged) {
    synchronizeCurrentLocationReference();
  }

  applyWallSettingsToStateForLocationKey(nextKey, wallFallback);
  redraw();

  updateWallNavigationTargets(nextKey);
  updateWallQueryParam(nextKey);

  if (persist) {
    persistSelectedWall(nextKey);
  }

  if (changed) {
    ensureWallSettings(nextKey)
      .then(() => {
        if (getCurrentLocationKey() !== nextKey) {
          return;
        }
        const wallSettings = getWallSettingsForLocation(nextKey);
        updateRoutesForWall(nextKey, wallSettings);
        pointDiameter = wallSettings.hollowPointDiameter ?? wallSettings.pointDiameter;
        filledPointDiameter = wallSettings.filledPointDiameter ?? wallSettings.pointDiameter;
        brezerStrokeWidth = wallSettings.brezerStrokeWidth;
        unfocusedTransparency = wallSettings.unfocusedTransparency;
        gradeBarBaseHeight = wallSettings.gradeBarBaseHeight;
        gradeBarMaxHeight = wallSettings.gradeBarMaxHeight;
        gradeBarWidth = wallSettings.gradeBarWidth;
        gradeBarTransparency = wallSettings.gradeBarTransparency;
        updatePathControls();
        updateAppearanceControls();
        redraw();
      })
      .catch((error) => {
        console.warn('Failed to load wall settings:', error);
      });
  }

  if (changed && refreshRoutes) {
    prepareNewRoute();
    loadRoutesList('').catch((error) => {
      console.error('Failed to refresh routes for the selected location:', error);
    });
  }
};

const handleLocationSelection = (locationKey) => {
  const nextLocation = findLocationByKey(locationKey);
  if (!nextLocation) {
    return;
  }

  setLocation(nextLocation);
  closeLocationModal();
};

const renderLocationOptions = () => {
  if (!locationOptions) {
    return;
  }

  locationOptions.replaceChildren();

  LOCATIONS.forEach((location) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'location-option';
    button.dataset.locationKey = location.key;
    button.setAttribute('role', 'option');
    button.dataset.helpText = `Switch to ${location.name}`;

    const preview = document.createElement('div');
    preview.className = 'location-option-preview';
    preview.style.backgroundImage = `url('${location.image}')`;
    button.appendChild(preview);

    const label = document.createElement('span');
    label.className = 'location-option-label';
    const name = document.createElement('span');
    name.className = 'location-option-name';
    name.textContent = location.name;
    label.appendChild(name);

    if (location.hidden) {
      const badge = document.createElement('span');
      badge.className = 'location-option-badge';
      badge.textContent = 'Hidden';
      label.appendChild(badge);
    }
    button.appendChild(label);

    button.addEventListener('click', () => {
      handleLocationSelection(location.key);
    });

    locationOptions.appendChild(button);
  });

  registerHelpTargets(locationOptions);
  updateHelpTooltips();

  updateLocationOptionsState();
  updateDeleteWallButtonState();
};

function resetLocationsToBuiltins() {
  for (let index = LOCATIONS.length - 1; index >= 0; index -= 1) {
    const entry = LOCATIONS[index];
    if (!entry) {
      continue;
    }

    const normalizedKey = normalizeWallKey(entry.key || entry.name);
    if (!BUILTIN_LOCATION_KEYS.has(normalizedKey)) {
      LOCATIONS.splice(index, 1);
    }
  }

  renderLocationOptions();

  const currentKey = normalizeWallKey(currentLocation?.key || currentLocation?.name);
  if (!currentKey || !BUILTIN_LOCATION_KEYS.has(currentKey)) {
    setLocation(DEFAULT_LOCATION, { persist: true, refreshRoutes: false });
  } else {
    synchronizeCurrentLocationReference();
    updateLocationOptionsState();
  }

  updateDeleteWallButtonState();
}

backgroundImage.onload = () => {
  backgroundReady = true;
  if (backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0) {
    const ratio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
    if (Number.isFinite(ratio) && ratio > 0) {
      canvasAspectRatio = ratio;
    }
  }
  resizeCanvas();
};

backgroundImage.onerror = () => {
  backgroundReady = false;
  resizeCanvas();
};

const updatePanelMeasurements = () => {
  if (!controlPanel || !panelSidebar) {
    return;
  }

  const { width } = panelSidebar.getBoundingClientRect();
  if (Number.isFinite(width) && width > 0) {
    controlPanel.style.setProperty('--toggle-visible-width', `${Math.ceil(width)}px`);
  }

  let panelOffset = 0;
  if (controlPanel) {
    const panelRect = controlPanel.getBoundingClientRect();
    if (Number.isFinite(panelRect.width) && panelRect.width > 0) {
      panelOffset = Math.ceil(panelRect.width);
    }

    const isExpanded = controlPanel.getAttribute('data-expanded') !== 'false';
    if (!isExpanded) {
      const storedToggleWidth =
        controlPanel.style.getPropertyValue('--toggle-visible-width') ||
        window.getComputedStyle(controlPanel).getPropertyValue('--toggle-visible-width');
      const parsedToggleWidth = storedToggleWidth ? parseFloat(storedToggleWidth) : NaN;
      if (Number.isFinite(parsedToggleWidth) && parsedToggleWidth > 0) {
        panelOffset = Math.ceil(parsedToggleWidth);
      }
    }
  }

};

const updateDrawingToggle = () => {
  if (!drawingToggle) {
    return;
  }

  const label = isDrawingEnabled ? 'Disable drawing' : 'Enable drawing';
  drawingToggle.setAttribute('aria-pressed', String(isDrawingEnabled));
  const labelTarget = drawingToggle.querySelector('.sr-only');
  if (labelTarget) {
    labelTarget.textContent = label;
  }
  drawingToggle.setAttribute('aria-label', label);
  drawingToggle.setAttribute('title', label);

  if (canvas) {
    canvas.setAttribute('data-drawing-enabled', String(isDrawingEnabled));
  }
};

function setDrawingEnabled(value) {
  const next = Boolean(value);
  if (isDrawingEnabled === next) {
    return;
  }
  isDrawingEnabled = next;
  updateDrawingToggle();
}

function registerHelpTargets(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return;
  }

  const directMatch =
    root instanceof Element && root.matches('[data-help-text]') ? [root] : [];
  const candidates = [...directMatch, ...root.querySelectorAll('[data-help-text]')];
  candidates.forEach((element) => {
    if (helpTargets.has(element)) {
      return;
    }
    if (infoButton && infoButton.contains(element)) {
      return;
    }
    const text = element.dataset?.helpText;
    if (!text) {
      return;
    }
    const tooltip = document.createElement('span');
    tooltip.className = 'help-tooltip';
    tooltip.textContent = text;
    tooltip.setAttribute('role', 'note');
    tooltip.hidden = true;
    element.appendChild(tooltip);
    helpTargets.set(element, tooltip);
  });
}

function isElementVisible(element) {
  if (!element || !element.isConnected) {
    return false;
  }
  if (element.closest('.hidden')) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function setTutorialDescriptionContent(content = []) {
  if (!tutorialDescription) {
    return;
  }

  tutorialDescription.innerHTML = '';

  const fragment = document.createDocumentFragment();
  const items = Array.isArray(content) ? content : [content];

  items.forEach((item) => {
    if (typeof item === 'string') {
      const paragraph = document.createElement('p');
      paragraph.textContent = item;
      fragment.appendChild(paragraph);
      return;
    }

    if (typeof item === 'function') {
      try {
        const result = item();
        if (result instanceof Node) {
          fragment.appendChild(result);
          return;
        }

        if (typeof result === 'string') {
          const paragraph = document.createElement('p');
          paragraph.textContent = result;
          fragment.appendChild(paragraph);
        }
      } catch (error) {
        console.warn('Unable to render tutorial content item:', error);
      }
      return;
    }

    if (item instanceof Node) {
      fragment.appendChild(item);
    }
  });

  tutorialDescription.appendChild(fragment);
}

function ensureTutorialPointer() {
  if (tutorialPointer) {
    return tutorialPointer;
  }

  tutorialPointer = document.createElement('div');
  tutorialPointer.className = 'tutorial-pointer hidden';
  tutorialPointer.setAttribute('aria-hidden', 'true');
  tutorialPointer.innerHTML =
    '<svg viewBox="0 0 64 96" role="presentation" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="#27b4db" d="M32 0l32 36H44v56H20V36H0z"/></svg>';
  document.body.appendChild(tutorialPointer);

  return tutorialPointer;
}

function updateTutorialPointerPosition() {
  if (!tutorialPointer || tutorialPointer.classList.contains('hidden')) {
    return;
  }

  if (!tutorialPointerTarget || !isElementVisible(tutorialPointerTarget)) {
    hideTutorialPointer();
    return;
  }

  const rect = tutorialPointerTarget.getBoundingClientRect();
  const verticalOffset = 12;

  tutorialPointer.style.left = `${rect.left + rect.width / 2}px`;
  tutorialPointer.style.top = `${rect.bottom + verticalOffset}px`;
}

function showTutorialPointerFor(element) {
  if (!(element instanceof HTMLElement) || !isElementVisible(element)) {
    hideTutorialPointer();
    return;
  }

  ensureTutorialPointer();

  tutorialPointerTarget = element;
  tutorialPointer.classList.remove('hidden');
  tutorialPointer.setAttribute('aria-hidden', 'false');
  updateTutorialPointerPosition();
}

function hideTutorialPointer() {
  if (!tutorialPointer) {
    tutorialPointerTarget = null;
    return;
  }

  tutorialPointerTarget = null;
  tutorialPointer.classList.add('hidden');
  tutorialPointer.setAttribute('aria-hidden', 'true');
}

window.addEventListener('resize', updateTutorialPointerPosition);
window.addEventListener('scroll', updateTutorialPointerPosition, true);

function highlightTutorialElement(element, options = {}) {
  const shouldIlluminate = options?.illuminate === true;

  if (tutorialHighlightedElement) {
    if (tutorialHighlightedElement !== element || !element) {
      tutorialHighlightedElement.classList.remove('tutorial-highlight');
      tutorialHighlightedElement.classList.remove('tutorial-illuminated');
      tutorialHighlightedElementOptions = { illuminate: false };
    } else if (tutorialHighlightedElementOptions.illuminate !== shouldIlluminate) {
      tutorialHighlightedElement.classList.toggle('tutorial-illuminated', shouldIlluminate);
      tutorialHighlightedElementOptions = { illuminate: shouldIlluminate };
      return;
    } else {
      return;
    }
  }

  if (element instanceof HTMLElement) {
    element.classList.add('tutorial-highlight');
    element.classList.toggle('tutorial-illuminated', shouldIlluminate);
    tutorialHighlightedElement = element;
    tutorialHighlightedElementOptions = { illuminate: shouldIlluminate };
  } else {
    tutorialHighlightedElement = null;
    tutorialHighlightedElementOptions = { illuminate: false };
  }
}

function setTutorialOverlayAlignment(alignment = 'center') {
  if (!tutorialOverlay) {
    return;
  }

  const shouldAlignBottom = alignment === 'bottom';
  tutorialOverlay.classList.toggle('is-bottom-aligned', shouldAlignBottom);
}

function openTutorialOverlay() {
  if (!tutorialOverlay) {
    return;
  }

  tutorialPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  tutorialOverlay.classList.remove('hidden');
  tutorialOverlay.setAttribute('aria-hidden', 'false');

  if (tutorialDialogCard && typeof tutorialDialogCard.focus === 'function') {
    tutorialDialogCard.focus();
  }
}

function closeTutorialOverlay() {
  if (!tutorialOverlay) {
    return;
  }

  tutorialOverlay.classList.add('hidden');
  tutorialOverlay.setAttribute('aria-hidden', 'true');

  if (tutorialPreviousFocus && typeof tutorialPreviousFocus.focus === 'function') {
    tutorialPreviousFocus.focus();
  }

  tutorialPreviousFocus = null;
}

function attachTutorialKeydown() {
  document.addEventListener('keydown', handleTutorialKeydown, true);
}

function detachTutorialKeydown() {
  document.removeEventListener('keydown', handleTutorialKeydown, true);
}

function renderTutorialStep() {
  if (!tutorialActive) {
    return;
  }

  const step = tutorialSteps[tutorialStepIndex];
  if (!step) {
    return;
  }

  if (tutorialTitle) {
    tutorialTitle.textContent = step.title || '';
  }

  setTutorialDescriptionContent(step.body || []);

  if (tutorialProgress) {
    tutorialProgress.textContent = `Step ${tutorialStepIndex + 1} of ${tutorialSteps.length}`;
    tutorialProgress.classList.toggle('hidden', tutorialSteps.length <= 1);
  }

  if (tutorialPrimaryAction) {
    tutorialPrimaryAction.textContent =
      tutorialStepIndex === tutorialSteps.length - 1 ? 'Finish' : 'Next';
  }

  if (tutorialSecondaryAction) {
    const secondaryConfig = step.secondaryAction || null;
    let secondaryLabel = 'Back';
    let shouldShowSecondary = tutorialStepIndex > 0;
    tutorialSecondaryActionMode = 'back';

    if (secondaryConfig && (secondaryConfig.mode === 'skip' || secondaryConfig.mode === 'close')) {
      tutorialSecondaryActionMode = 'skip';
      secondaryLabel =
        typeof secondaryConfig.label === 'string' && secondaryConfig.label.trim().length
          ? secondaryConfig.label
          : 'Skip';
      shouldShowSecondary = true;
    }

    tutorialSecondaryAction.textContent = secondaryLabel;
    tutorialSecondaryAction.dataset.mode = tutorialSecondaryActionMode;
    tutorialSecondaryAction.classList.toggle('hidden', !shouldShowSecondary);
  }
}

function buildSetterTutorialSteps() {
  const steps = [
    {
      title: 'Welcome to the setter workspace',
      body: [
        'Design, update, and publish climbs from here. The wall preview on the left responds instantly as you draw or tweak route details.',
        'Use the sidebar tabs to switch between saved routes, manage walls, and adjust how problems appear to climbers.',
      ],
      secondaryAction: { mode: 'skip', label: 'Skip' },
      onEnter: () => {
        setTutorialOverlayAlignment('center');
        highlightTutorialElement(null);
        hideTutorialPointer();
        deactivateInfoMode({ clearTooltip: true });
      },
      onExit: () => {
        highlightTutorialElement(null);
      },
    },
    {
      title: 'Routes panel',
      body: [
        'Select existing problems or start fresh, then fill in setter info, descriptions, and notes for climbers.',
        'Pick colours, change path types, and save or clear drawings while you iterate on new ideas.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('bottom');
        activateTab('routesTab');
        if (routesTabButton && isElementVisible(routesTabButton)) {
          highlightTutorialElement(routesTabButton, { illuminate: true });
          showTutorialPointerFor(routesTabButton);
        } else {
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
      },
    },
    {
      title: 'Walls panel',
      body: [
        'Switch the active wall, create new backgrounds, or temporarily hide a wall from climbers.',
        'Use it to manage rotations and keep your wall list tidy as sets change over time.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('bottom');
        activateTab('wallsTab');
        if (wallsTabButton && isElementVisible(wallsTabButton)) {
          highlightTutorialElement(wallsTabButton, { illuminate: true });
          showTutorialPointerFor(wallsTabButton);
        } else {
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
      },
    },
    {
      title: 'Configuration panel',
      body: [
        'Tune how holds render by adjusting point sizes, rectangle dimensions, and transparency defaults.',
        'Save appearance settings so climbers see consistent visuals across every wall you manage.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('bottom');
        activateTab('configurationTab');
        if (configurationTabButton && isElementVisible(configurationTabButton)) {
          highlightTutorialElement(configurationTabButton, { illuminate: true });
          showTutorialPointerFor(configurationTabButton);
        } else {
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
      },
    },
    {
      title: 'Enable drawing',
      body: [
        'Toggle drawing mode when you want to sketch new holds or edit existing shapes directly on the wall.',
        'Switch it off to pan around freely or inspect details without leaving stray marks behind.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('bottom');
        if (drawingToggle && isElementVisible(drawingToggle)) {
          highlightTutorialElement(drawingToggle, { illuminate: true });
          showTutorialPointerFor(drawingToggle);
        } else {
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
      },
    },
    {
      title: 'Info mode',
      body: [
        'Tap the info button any time for quick tooltips explaining each control in the sidebar.',
        'Info mode stays active until you toggle it off, so you can explore every setting at your own pace.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('bottom');
        deactivateInfoMode({ clearTooltip: true });
        if (infoButton && isElementVisible(infoButton)) {
          highlightTutorialElement(infoButton, { illuminate: true });
          showTutorialPointerFor(infoButton);
        } else {
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
      },
    },
  ];

  return steps;
}

async function goToTutorialStep(index) {
  if (!tutorialActive || tutorialTransitionInProgress) {
    return;
  }

  if (index < 0 || index >= tutorialSteps.length) {
    return;
  }

  tutorialTransitionInProgress = true;

  if (tutorialStepIndex >= 0 && tutorialStepIndex < tutorialSteps.length) {
    const currentStep = tutorialSteps[tutorialStepIndex];
    if (currentStep && typeof currentStep.onExit === 'function') {
      try {
        await currentStep.onExit();
      } catch (error) {
        console.warn('Tutorial step cleanup failed:', error);
      }
    }
  }

  tutorialStepIndex = index;
  renderTutorialStep();

  const nextStep = tutorialSteps[tutorialStepIndex];
  if (nextStep && typeof nextStep.onEnter === 'function') {
    try {
      await nextStep.onEnter();
    } catch (error) {
      console.warn('Tutorial step setup failed:', error);
    }
  }

  tutorialTransitionInProgress = false;

  if (tutorialPrimaryAction) {
    tutorialPrimaryAction.focus();
  }
}

async function startTutorial(options = {}) {
  const { force = false } = options;

  if (
    !tutorialOverlay ||
    !tutorialDialogCard ||
    !tutorialTitle ||
    !tutorialDescription ||
    !tutorialPrimaryAction
  ) {
    return false;
  }

  if (tutorialTransitionInProgress) {
    if (!force) {
      return false;
    }
    await finishTutorial();
  } else if (tutorialActive) {
    if (!force) {
      return false;
    }
    await finishTutorial();
  }

  tutorialSteps = buildSetterTutorialSteps();
  if (!Array.isArray(tutorialSteps) || tutorialSteps.length === 0) {
    return false;
  }

  cancelTutorialAutostart();

  const activeTabButton = tabButtons.find((button) => button?.getAttribute('aria-selected') === 'true');
  tutorialPreviousTabId = activeTabButton?.dataset?.target || null;

  tutorialActive = true;
  tutorialStepIndex = -1;
  tutorialTransitionInProgress = false;
  tutorialSecondaryActionMode = 'back';

  if (tutorialProgress) {
    tutorialProgress.classList.remove('hidden');
  }

  setTutorialOverlayAlignment('center');
  openTutorialOverlay();
  attachTutorialKeydown();

  await goToTutorialStep(0);
  tutorialAutostartAttempts = 0;

  return true;
}

function cancelTutorialAutostart() {
  if (tutorialAutostartTimeoutId !== null) {
    clearTimeout(tutorialAutostartTimeoutId);
    tutorialAutostartTimeoutId = null;
  }
}

function scheduleTutorialAutostart() {
  cancelTutorialAutostart();
  tutorialAutostartAttempts = 0;

  const attemptStart = async () => {
    tutorialAutostartTimeoutId = null;
    const started = await startTutorial();
    if (!started) {
      if (tutorialAutostartAttempts < 2) {
        tutorialAutostartAttempts += 1;
        tutorialAutostartTimeoutId = window.setTimeout(attemptStart, 450);
      }
    } else {
      tutorialAutostartAttempts = 0;
    }
  };

  tutorialAutostartTimeoutId = window.setTimeout(attemptStart, 0);
}

async function finishTutorial() {
  cancelTutorialAutostart();
  if (!tutorialActive && !tutorialTransitionInProgress) {
    tutorialPreviousTabId = null;
    tutorialSecondaryActionMode = 'back';
    return;
  }

  tutorialTransitionInProgress = true;

  if (tutorialStepIndex >= 0 && tutorialStepIndex < tutorialSteps.length) {
    const finalStep = tutorialSteps[tutorialStepIndex];
    if (finalStep && typeof finalStep.onExit === 'function') {
      try {
        await finalStep.onExit();
      } catch (error) {
        console.warn('Tutorial completion cleanup failed:', error);
      }
    }
  }

  tutorialActive = false;
  tutorialStepIndex = -1;
  tutorialTransitionInProgress = false;
  tutorialSteps = [];
  tutorialSecondaryActionMode = 'back';

  highlightTutorialElement(null);
  hideTutorialPointer();
  setTutorialOverlayAlignment('center');

  if (tutorialProgress) {
    tutorialProgress.classList.add('hidden');
  }

  closeTutorialOverlay();
  detachTutorialKeydown();

  if (tutorialPreviousTabId) {
    activateTab(tutorialPreviousTabId);
  } else {
    activateTab('routesTab');
  }

  tutorialPreviousTabId = null;
}

function handleTutorialKeydown(event) {
  if (!tutorialActive) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    void finishTutorial();
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (tutorialStepIndex >= tutorialSteps.length - 1) {
      void finishTutorial();
    } else {
      void goToTutorialStep(tutorialStepIndex + 1);
    }
    return;
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    if (tutorialStepIndex > 0) {
      void goToTutorialStep(tutorialStepIndex - 1);
    }
  }
}

function updateHelpTooltips() {
  if (!activeHelpEntry) {
    return;
  }

  const { element } = activeHelpEntry;
  if (!element || !element.isConnected) {
    clearActiveHelpTooltip();
    return;
  }

  if (!helpTargets.has(element)) {
    registerHelpTargets(element);
  }

  const tooltip = helpTargets.get(element);
  if (!tooltip) {
    clearActiveHelpTooltip();
    return;
  }

  activeHelpEntry.tooltip = tooltip;

  const activePanel = document.querySelector('.tab-panel[aria-hidden="false"]');
  const panelCollapsed = controlPanel?.getAttribute('data-expanded') === 'false';
  const modalAncestor = element.closest('.location-modal');
  const inVisibleModal = Boolean(
    modalAncestor && !modalAncestor.classList.contains('hidden'),
  );
  const insideControlPanel = controlPanel ? controlPanel.contains(element) : false;
  const inActivePanel = activePanel ? activePanel.contains(element) : true;
  const visible = isElementVisible(element);
  const shouldShow =
    visible &&
    (!panelCollapsed || !insideControlPanel) &&
    (inActivePanel || inVisibleModal || (!activePanel && visible));

  element.classList.toggle('showing-help', shouldShow);
  tooltip.hidden = !shouldShow;
}

function setInfoButtonActiveState(active) {
  if (!infoButton) {
    return;
  }

  const label = active ? 'Hide setter help' : 'Learn about setter tools';
  infoButton.setAttribute('aria-label', label);
  infoButton.setAttribute('title', label);
  infoButton.setAttribute('aria-pressed', active ? 'true' : 'false');
  infoButton.setAttribute('aria-expanded', active ? 'true' : 'false');
  infoButton.classList.toggle('is-active', active);

  const srTarget = infoButton.querySelector('.sr-only');
  if (srTarget) {
    srTarget.textContent = label;
  }
}

function showInfoPopover() {
  if (!infoPopover) {
    return;
  }

  infoPopover.classList.remove('hidden');
  infoPopover.setAttribute('aria-hidden', 'false');
  if (typeof infoPopover.focus === 'function') {
    infoPopover.focus({ preventScroll: true });
  }
}

function hideInfoPopover() {
  if (!infoPopover) {
    return;
  }

  infoPopover.classList.add('hidden');
  infoPopover.setAttribute('aria-hidden', 'true');
}

function clearActiveHelpTooltip() {
  if (!activeHelpEntry) {
    return;
  }

  const { element, tooltip } = activeHelpEntry;
  if (element) {
    element.classList.remove('showing-help');
  }
  if (tooltip) {
    tooltip.hidden = true;
  }
  activeHelpEntry = null;
}

function showHelpTooltipForElement(element) {
  if (!element) {
    return null;
  }

  registerHelpTargets(element);
  const tooltip = helpTargets.get(element);
  if (!tooltip) {
    return null;
  }

  if (activeHelpEntry && activeHelpEntry.element !== element) {
    clearActiveHelpTooltip();
  }

  activeHelpEntry = { element, tooltip };
  updateHelpTooltips();
  return activeHelpEntry;
}

function activateInfoMode() {
  if (infoModeActive) {
    return;
  }

  infoModeActive = true;
  awaitingHelpTargetSelection = true;
  clearActiveHelpTooltip();
  setInfoButtonActiveState(true);
  showInfoPopover();
}

function deactivateInfoMode({ clearTooltip = false } = {}) {
  awaitingHelpTargetSelection = false;

  if (infoModeActive) {
    infoModeActive = false;
  }

  setInfoButtonActiveState(false);
  hideInfoPopover();

  if (clearTooltip) {
    clearActiveHelpTooltip();
  }
}

const isInteractiveElement = (element) => {
  if (!element) {
    return false;
  }

  const candidate = element instanceof Element ? element : element.parentElement;
  if (!candidate) {
    return false;
  }

  if (candidate.isContentEditable) {
    return true;
  }

  if (typeof candidate.closest === 'function') {
    if (candidate.closest('[contenteditable="true"]')) {
      return true;
    }

    if (candidate.closest('input, textarea, select, button, a')) {
      return true;
    }
  }

  const tagName = typeof candidate.tagName === 'string' ? candidate.tagName.toLowerCase() : '';
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    tagName === 'button' ||
    tagName === 'a'
  );
};

const updatePanModifierState = (active) => {
  isPanModifierActive = Boolean(active);

  if (!canvas) {
    return;
  }

  if (isPanModifierActive) {
    canvas.setAttribute('data-pan-modifier', 'true');
  } else {
    canvas.removeAttribute('data-pan-modifier');
  }
};

const hasScrollableCanvasArea = () => {
  if (!canvasContainer) {
    return false;
  }

  if (isCanvasScrollable) {
    return true;
  }

  return (
    canvasContainer.scrollWidth > canvasContainer.clientWidth ||
    canvasContainer.scrollHeight > canvasContainer.clientHeight
  );
};

const beginCanvasPan = (event) => {
  if (!canvasContainer || !canvas || !hasScrollableCanvasArea()) {
    return false;
  }

  isPointerPanning = true;
  panPointerId = event.pointerId;
  panPointerButton = event.button;
  panStartScrollLeft = canvasContainer.scrollLeft;
  panStartScrollTop = canvasContainer.scrollTop;
  panOriginX = event.clientX;
  panOriginY = event.clientY;
  shouldIgnoreNextClick = event.button === 0;

  canvas.classList.add('is-panning');

  if (typeof canvas.setPointerCapture === 'function') {
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // Ignore pointer capture errors (e.g., unsupported platforms).
    }
  }

  if (typeof event.preventDefault === 'function') {
    event.preventDefault();
  }

  return true;
};

const moveCanvasPan = (event) => {
  if (!isPointerPanning || event.pointerId !== panPointerId || !canvasContainer) {
    return;
  }

  const deltaX = event.clientX - panOriginX;
  const deltaY = event.clientY - panOriginY;

  canvasContainer.scrollLeft = panStartScrollLeft - deltaX;
  canvasContainer.scrollTop = panStartScrollTop - deltaY;
};

const endCanvasPan = () => {
  if (!isPointerPanning) {
    return;
  }

  if (
    canvas &&
    panPointerId !== null &&
    typeof canvas.hasPointerCapture === 'function' &&
    canvas.hasPointerCapture(panPointerId)
  ) {
    try {
      canvas.releasePointerCapture(panPointerId);
    } catch (error) {
      // Ignore pointer capture release errors.
    }
  }

  canvas?.classList.remove('is-panning');

  if (panPointerButton !== 0) {
    shouldIgnoreNextClick = false;
  }

  isPointerPanning = false;
  panPointerId = null;
  panPointerButton = 0;
};

const handleCanvasPointerDown = (event) => {
  const isPrimaryButton = event.button === 0;
  const isMiddleButton = event.button === 1;
  const panWithPrimary = isPrimaryButton && (!isDrawingEnabled || isPanModifierActive);

  if (isMiddleButton || panWithPrimary) {
    if (beginCanvasPan(event)) {
      return;
    }
  }

  shouldIgnoreNextClick = false;
};

const handleCanvasPointerMove = (event) => {
  moveCanvasPan(event);
};

const handleCanvasPointerEnd = (event) => {
  if (!isPointerPanning || event.pointerId !== panPointerId) {
    return;
  }

  endCanvasPan();
};

deleteButton.disabled = true;
routeSelector.disabled = true;
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const pathTypeSelect = document.getElementById('pathTypeSelect');
const hollowPointDiameterField = document.getElementById('hollowPointDiameterField');
const hollowPointDiameterSlider = document.getElementById('hollowPointDiameterSlider');
const hollowPointDiameterValue = document.getElementById('hollowPointDiameterValue');
const hollowPointLineWidthField = document.getElementById('hollowPointLineWidthField');
const hollowPointLineWidthSlider = document.getElementById('hollowPointLineWidthSlider');
const hollowPointLineWidthValue = document.getElementById('hollowPointLineWidthValue');
const filledPointDiameterField = document.getElementById('filledPointDiameterField');
const filledPointDiameterSlider = document.getElementById('filledPointDiameterSlider');
const filledPointDiameterValue = document.getElementById('filledPointDiameterValue');
const rectangleWidthField = document.getElementById('rectangleWidthField');
const rectangleWidthSlider = document.getElementById('rectangleWidthSlider');
const rectangleWidthValue = document.getElementById('rectangleWidthValue');
const rectangleHeightField = document.getElementById('rectangleHeightField');
const rectangleHeightSlider = document.getElementById('rectangleHeightSlider');
const rectangleHeightValue = document.getElementById('rectangleHeightValue');
const brezerStrokeWidthField = document.getElementById('brezerStrokeWidthField');
const brezerStrokeWidthSlider = document.getElementById('brezerStrokeWidthSlider');
const brezerStrokeWidthValue = document.getElementById('brezerStrokeWidthValue');
const unfocusedTransparencyField = document.getElementById('unfocusedTransparencyField');
const unfocusedTransparencySlider = document.getElementById('unfocusedTransparencySlider');
const gradeBarBaseHeightInput = document.getElementById('gradeBarBaseHeightInput');
const gradeBarMaxHeightInput = document.getElementById('gradeBarMaxHeightInput');
const gradeBarWidthInput = document.getElementById('gradeBarWidthInput');
const gradeBarTransparencyInput = document.getElementById('gradeBarTransparencyInput');
const saveAppearanceButton = document.getElementById('saveAppearanceButton');
const advancedColorToggle = document.getElementById('advancedColorToggle');
const advancedColorPicker = document.getElementById('advancedColorPicker');
const colorWheelCanvas = document.getElementById('colorWheelCanvas');
const colorWheelMarker = document.getElementById('colorWheelMarker');
const colorLightnessSlider = document.getElementById('colorLightnessSlider');
const colorWheelValue = document.getElementById('colorWheelValue');
const colorWheelSwatch = document.getElementById('colorWheelSwatch');
const clearButton = document.getElementById('clearButton');
const saveButton = document.getElementById('saveButton');
const cancelRouteButton = document.getElementById('cancelRouteButton');

const SYNTHETIC_EMAIL_DOMAIN = 'users.anuascend.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const SETTER_NAME_PATTERN = /^[a-z0-9_ ]{3,40}$/;

const normalizeUsername = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizeSetterName = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
};

function normalizePathType(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const normalized = trimmed.replace(/\s+/g, '-');
    if (normalized === PATH_TYPE_BREZER) {
      return PATH_TYPE_BREZER;
    }
    if (normalized === PATH_TYPE_RECTANGLE) {
      return PATH_TYPE_RECTANGLE;
    }
    if (normalized === PATH_TYPE_FILLED_POINT) {
      return PATH_TYPE_FILLED_POINT;
    }
    if (normalized === PATH_TYPE_HOLLOW_POINT || normalized === LEGACY_PATH_TYPE_POINT) {
      return PATH_TYPE_HOLLOW_POINT;
    }
  }
  return DEFAULT_PATH_TYPE;
}

function isNormalizedPointPathType(value) {
  return value === PATH_TYPE_HOLLOW_POINT || value === PATH_TYPE_FILLED_POINT;
}

function getDefaultPointDiameterForPathType(pathTypeValue) {
  const normalized = normalizePathType(pathTypeValue);
  if (normalized === PATH_TYPE_FILLED_POINT) {
    return DEFAULT_FILLED_POINT_DIAMETER;
  }
  if (normalized === PATH_TYPE_HOLLOW_POINT) {
    return DEFAULT_HOLLOW_POINT_DIAMETER;
  }
  return DEFAULT_POINT_DIAMETER;
}

function getStatePointDiameterForPathType(pathTypeValue) {
  const normalized = normalizePathType(pathTypeValue);
  if (normalized === PATH_TYPE_FILLED_POINT) {
    return filledPointDiameter;
  }
  return pointDiameter;
}

function getRoutePointDiameterForPathType(routeData, pathTypeValue) {
  const normalized = normalizePathType(pathTypeValue ?? routeData?.pathType);
  if (normalized === PATH_TYPE_FILLED_POINT) {
    const sourceValue =
      routeData?.filledPointDiameter ??
      routeData?.pointDiameter ??
      filledPointDiameter;
    return normalizePointDiameter(sourceValue, DEFAULT_FILLED_POINT_DIAMETER);
  }
  if (normalized === PATH_TYPE_HOLLOW_POINT) {
    const sourceValue =
      routeData?.hollowPointDiameter ??
      routeData?.pointDiameter ??
      pointDiameter;
    return normalizePointDiameter(sourceValue, DEFAULT_HOLLOW_POINT_DIAMETER);
  }
  return normalizePointDiameter(routeData?.pointDiameter, DEFAULT_POINT_DIAMETER);
}

function normalizePointDiameter(value, fallback = DEFAULT_POINT_DIAMETER) {
  const numeric = Number(value);
  let candidate = numeric;
  if (!Number.isFinite(candidate)) {
    const fallbackNumeric = Number(fallback);
    candidate = Number.isFinite(fallbackNumeric) ? fallbackNumeric : DEFAULT_POINT_DIAMETER;
  }
  const clamped = Math.min(
    Math.max(Math.round(candidate), MIN_POINT_DIAMETER),
    MAX_POINT_DIAMETER,
  );
  return clamped;
}

function computeDefaultHollowPointLineWidth(diameter = DEFAULT_HOLLOW_POINT_DIAMETER) {
  const normalizedDiameter = normalizePointDiameter(diameter, DEFAULT_HOLLOW_POINT_DIAMETER);
  const baseline = Math.max(2, Math.round(normalizedDiameter / 10));
  return Math.min(
    Math.max(baseline, MIN_HOLLOW_POINT_LINE_WIDTH),
    MAX_HOLLOW_POINT_LINE_WIDTH,
  );
}

function normalizeHollowPointLineWidth(value, diameterFallback = DEFAULT_HOLLOW_POINT_DIAMETER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return computeDefaultHollowPointLineWidth(diameterFallback);
  }
  const rounded = Math.round(numeric);
  return Math.min(
    Math.max(rounded, MIN_HOLLOW_POINT_LINE_WIDTH),
    MAX_HOLLOW_POINT_LINE_WIDTH,
  );
}

function getRouteHollowPointLineWidth(routeData) {
  const diameter = getRoutePointDiameterForPathType(routeData, PATH_TYPE_HOLLOW_POINT);
  return normalizeHollowPointLineWidth(routeData?.hollowPointLineWidth, diameter);
}

function normalizeRectangleSize(value, fallback = DEFAULT_RECTANGLE_WIDTH) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const clamped = Math.min(
    Math.max(Math.round(numeric), MIN_RECTANGLE_SIZE),
    MAX_RECTANGLE_SIZE,
  );
  return clamped;
}

function normalizeBrezerStrokeWidth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_BREZER_STROKE_WIDTH;
  }
  const clamped = Math.min(
    Math.max(Math.round(numeric), MIN_BREZER_STROKE_WIDTH),
    MAX_BREZER_STROKE_WIDTH,
  );
  return clamped;
}

function normalizeGradeBarHeight(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const clamped = Math.min(
    Math.max(numeric, MIN_GRADE_BAR_BASE_HEIGHT),
    MAX_GRADE_BAR_HEIGHT,
  );
  return Math.round(clamped);
}

function normalizeGradeBarWidth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_GRADE_BAR_WIDTH;
  }
  const clamped = Math.min(
    Math.max(Math.round(numeric), MIN_GRADE_BAR_WIDTH),
    MAX_GRADE_BAR_WIDTH,
  );
  return clamped;
}

function normalizeGradeBarTransparency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_GRADE_BAR_TRANSPARENCY;
  }
  const clamped = Math.min(Math.max(numeric, 0), 1);
  return Math.round(clamped * 1000) / 1000;
}

function normalizeGradeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (!Number.isInteger(numeric)) {
    return null;
  }

  if (numeric < MIN_GRADE_VALUE || numeric > MAX_GRADE_VALUE) {
    return null;
  }

  return numeric;
}

function normalizeRouteGradeField(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function resolveRouteNumericGrade(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.min(Math.max(value, MIN_GRADE_VALUE), MAX_GRADE_VALUE);
    return clamped;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      const clamped = Math.min(Math.max(numeric, MIN_GRADE_VALUE), MAX_GRADE_VALUE);
      return clamped;
    }
  }

  return null;
}

function normalizeUnfocusedTransparency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_UNFOCUSED_TRANSPARENCY;
  }
  const clamped = Math.min(
    Math.max(numeric, MIN_UNFOCUSED_TRANSPARENCY),
    MAX_UNFOCUSED_TRANSPARENCY,
  );
  return Math.round(clamped * 1000) / 1000;
}

function convertUnfocusedTransparencyToSliderValue(value) {
  return Math.round(normalizeUnfocusedTransparency(value) * 100);
}

function sliderValueToUnfocusedTransparency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_UNFOCUSED_TRANSPARENCY;
  }
  return normalizeUnfocusedTransparency(numeric / 100);
}

function createDefaultWallSettings() {
  return {
    pointDiameter: DEFAULT_HOLLOW_POINT_DIAMETER,
    hollowPointDiameter: DEFAULT_HOLLOW_POINT_DIAMETER,
    hollowPointLineWidth: DEFAULT_HOLLOW_POINT_LINE_WIDTH,
    filledPointDiameter: DEFAULT_FILLED_POINT_DIAMETER,
    rectangleWidth: DEFAULT_RECTANGLE_WIDTH,
    rectangleHeight: DEFAULT_RECTANGLE_HEIGHT,
    brezerStrokeWidth: DEFAULT_BREZER_STROKE_WIDTH,
    unfocusedTransparency: DEFAULT_UNFOCUSED_TRANSPARENCY,
    gradeBarBaseHeight: DEFAULT_GRADE_BAR_BASE_HEIGHT,
    gradeBarMaxHeight: DEFAULT_GRADE_BAR_MAX_HEIGHT,
    gradeBarWidth: DEFAULT_GRADE_BAR_WIDTH,
    gradeBarTransparency: DEFAULT_GRADE_BAR_TRANSPARENCY,
  };
}

function normalizeWallSettings(raw = {}) {
  if (!raw || typeof raw !== 'object') {
    return createDefaultWallSettings();
  }

  const hollowPointDiameter = normalizePointDiameter(
    raw.hollowPointDiameter ?? raw.pointDiameter,
    DEFAULT_HOLLOW_POINT_DIAMETER,
  );
  const hollowPointLineWidth = normalizeHollowPointLineWidth(
    raw.hollowPointLineWidth ?? raw.pointStrokeWidth ?? raw.hollowPointStrokeWidth,
    hollowPointDiameter,
  );
  const filledPointDiameter = normalizePointDiameter(
    raw.filledPointDiameter ?? raw.pointDiameter,
    DEFAULT_FILLED_POINT_DIAMETER,
  );
  const rectangleWidth = normalizeRectangleSize(
    raw.rectangleWidth,
    DEFAULT_RECTANGLE_WIDTH,
  );
  const rectangleHeight = normalizeRectangleSize(
    raw.rectangleHeight,
    DEFAULT_RECTANGLE_HEIGHT,
  );
  const brezerStrokeWidth = normalizeBrezerStrokeWidth(raw.brezerStrokeWidth);
  const gradeBarBaseHeight = normalizeGradeBarHeight(
    raw.gradeBarBaseHeight,
    DEFAULT_GRADE_BAR_BASE_HEIGHT,
  );
  const gradeBarMaxHeight = Math.max(
    gradeBarBaseHeight,
    normalizeGradeBarHeight(raw.gradeBarMaxHeight, DEFAULT_GRADE_BAR_MAX_HEIGHT),
  );
  const gradeBarWidth = normalizeGradeBarWidth(raw.gradeBarWidth);
  const gradeBarTransparency = normalizeGradeBarTransparency(
    raw.gradeBarTransparency ?? raw.transparency,
  );
  return {
    pointDiameter: hollowPointDiameter,
    hollowPointDiameter,
    hollowPointLineWidth,
    filledPointDiameter,
    rectangleWidth,
    rectangleHeight,
    brezerStrokeWidth,
    unfocusedTransparency: normalizeUnfocusedTransparency(raw.unfocusedTransparency),
    gradeBarBaseHeight,
    gradeBarMaxHeight,
    gradeBarWidth,
    gradeBarTransparency,
  };
}

function getWallSettingsWithFallback(locationKey, fallback = null) {
  const key = normalizeWallKey(locationKey);
  if (key) {
    const cached = wallSettingsCache.get(key);
    if (cached) {
      return { ...cached };
    }
  }

  if (fallback) {
    const normalized = normalizeWallSettings(fallback);
    if (key) {
      wallSettingsCache.set(key, normalized);
    }
    return normalized;
  }

  return createDefaultWallSettings();
}

function getWallSettingsForLocation(locationKey) {
  return getWallSettingsWithFallback(locationKey);
}

function applyWallSettingsToStateForLocationKey(locationKey, fallback = null) {
  const settings = getWallSettingsWithFallback(locationKey, fallback);
  pointDiameter = settings.hollowPointDiameter ?? settings.pointDiameter;
  filledPointDiameter = settings.filledPointDiameter ?? settings.pointDiameter;
  hollowPointLineWidth = settings.hollowPointLineWidth;
  rectangleWidth = settings.rectangleWidth;
  rectangleHeight = settings.rectangleHeight;
  brezerStrokeWidth = settings.brezerStrokeWidth;
  unfocusedTransparency = settings.unfocusedTransparency;
  gradeBarBaseHeight = settings.gradeBarBaseHeight;
  gradeBarMaxHeight = settings.gradeBarMaxHeight;
  gradeBarWidth = settings.gradeBarWidth;
  gradeBarTransparency = settings.gradeBarTransparency;
  updatePathControls();
  updateAppearanceControls();
}

function getCurrentLocationKey() {
  if (currentLocation?.key) {
    return normalizeWallKey(currentLocation.key);
  }
  return normalizeLocationName(currentLocation?.name);
}

async function ensureWallSettings(locationKey) {
  const key = normalizeWallKey(locationKey);
  if (!key) {
    return createDefaultWallSettings();
  }

  if (wallSettingsCache.has(key)) {
    return { ...wallSettingsCache.get(key) };
  }

  try {
    const docId = wallDocumentIdMap.get(key) || key;
    const wallRef = doc(db, WALL_COLLECTION, docId);
    const snap = await getDoc(wallRef);
    if (snap.exists()) {
      const data = snap.data();
      const settings = normalizeWallSettings(data);
      const normalizedId = normalizeWallKey(snap.id);
      const normalizedName = normalizeWallKey(data?.name);

      if (normalizedId) {
        wallSettingsCache.set(normalizedId, settings);
        wallDocumentIdMap.set(normalizedId, snap.id);
      }

      if (normalizedName) {
        wallDocumentIdMap.set(normalizedName, snap.id);
        if (!wallSettingsCache.has(normalizedName)) {
          wallSettingsCache.set(normalizedName, settings);
        }
      }

      if (data?.key) {
        const normalizedLocationKey = normalizeWallKey(data.key);
        if (normalizedLocationKey) {
          wallDocumentIdMap.set(normalizedLocationKey, snap.id);
          if (!wallSettingsCache.has(normalizedLocationKey)) {
            wallSettingsCache.set(normalizedLocationKey, settings);
          }
        }
      }

      const { changed: locationChanged } = upsertLocation({
        key: typeof data?.key === 'string' ? data.key : snap.id,
        name: typeof data?.name === 'string' ? data.name : '',
        image: typeof data?.background_url === 'string' ? data.background_url : '',
        fallbackName: typeof data?.name === 'string' && data.name ? data.name : snap.id,
        hidden: Boolean(data?.hidden),
      });

      if (locationChanged) {
        renderLocationOptions();
        synchronizeCurrentLocationReference();
      }

      return { ...settings };
    }
  } catch (error) {
    console.warn(`Failed to load wall settings for ${locationKey}:`, error);
  }

  return createDefaultWallSettings();
}

async function refreshWallSettingsCache() {
  try {
    const snapshot = await getDocs(collection(db, WALL_COLLECTION));
    const fetchedKeys = new Set();
    wallDocumentIdMap.clear();
    let locationsChanged = false;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const settings = normalizeWallSettings(data);
      const normalizedId = normalizeWallKey(docSnap.id);
      const normalizedName = normalizeWallKey(data?.name);

      if (normalizedId) {
        wallSettingsCache.set(normalizedId, settings);
        wallDocumentIdMap.set(normalizedId, docSnap.id);
        fetchedKeys.add(normalizedId);
      }

      if (normalizedName) {
        wallDocumentIdMap.set(normalizedName, docSnap.id);
        wallSettingsCache.set(normalizedName, settings);
        fetchedKeys.add(normalizedName);
      }

      if (data?.key) {
        const normalizedLocationKey = normalizeWallKey(data.key);
        if (normalizedLocationKey) {
          wallDocumentIdMap.set(normalizedLocationKey, docSnap.id);
          wallSettingsCache.set(normalizedLocationKey, settings);
          fetchedKeys.add(normalizedLocationKey);
        }
      }

      const { changed } = upsertLocation({
        key: typeof data?.key === 'string' ? data.key : docSnap.id,
        name: typeof data?.name === 'string' ? data.name : '',
        image: typeof data?.background_url === 'string' ? data.background_url : '',
        fallbackName: typeof data?.name === 'string' && data.name ? data.name : docSnap.id,
        hidden: Boolean(data?.hidden),
      });

      if (changed) {
        locationsChanged = true;
      }
    });

    wallSettingsCache.forEach((value, key) => {
      if (!fetchedKeys.has(key)) {
        wallSettingsCache.delete(key);
      }
    });

    if (locationsChanged) {
      renderLocationOptions();
      synchronizeCurrentLocationReference();
    }
  } catch (error) {
    console.warn('Failed to refresh wall settings:', error);
  }
}

function updateRoutesForWall(locationKey, settings) {
  const normalizedKey = normalizeWallKey(locationKey);
  if (!normalizedKey || !settings) {
    return;
  }

  routesCache.forEach((data, routeKey) => {
    const routeLocationKey = normalizeWallKey(
      typeof data?.locationKey === 'string'
        ? data.locationKey
        : normalizeLocationName(data?.location),
    );
    if (routeLocationKey === normalizedKey) {
      routesCache.set(routeKey, {
        ...data,
        pointDiameter: settings.hollowPointDiameter ?? settings.pointDiameter,
        hollowPointDiameter: settings.hollowPointDiameter ?? settings.pointDiameter,
        hollowPointLineWidth: settings.hollowPointLineWidth,
        filledPointDiameter: settings.filledPointDiameter ?? settings.pointDiameter,
        brezerStrokeWidth: settings.brezerStrokeWidth,
        rectangleWidth: settings.rectangleWidth,
        rectangleHeight: settings.rectangleHeight,
        gradeBarBaseHeight: settings.gradeBarBaseHeight,
        gradeBarMaxHeight: settings.gradeBarMaxHeight,
        gradeBarWidth: settings.gradeBarWidth,
        gradeBarTransparency: settings.gradeBarTransparency,
      });
    }
  });
}

function updateRoutesForAllWalls() {
  routesCache.forEach((data, key) => {
    const routeLocationKey = normalizeWallKey(
      typeof data?.locationKey === 'string'
        ? data.locationKey
        : normalizeLocationName(data?.location),
    );
    const settings = getWallSettingsForLocation(routeLocationKey);
    routesCache.set(key, {
      ...data,
      pointDiameter: settings.hollowPointDiameter ?? settings.pointDiameter,
      hollowPointDiameter: settings.hollowPointDiameter ?? settings.pointDiameter,
      hollowPointLineWidth: settings.hollowPointLineWidth,
      filledPointDiameter: settings.filledPointDiameter ?? settings.pointDiameter,
      brezerStrokeWidth: settings.brezerStrokeWidth,
      rectangleWidth: settings.rectangleWidth,
      rectangleHeight: settings.rectangleHeight,
      gradeBarBaseHeight: settings.gradeBarBaseHeight,
      gradeBarMaxHeight: settings.gradeBarMaxHeight,
      gradeBarWidth: settings.gradeBarWidth,
      gradeBarTransparency: settings.gradeBarTransparency,
    });
  });
}

async function persistWallSettings(locationKey, updates = {}) {
  const normalizedKey = normalizeWallKey(locationKey);
  if (!normalizedKey) {
    return;
  }

  const merged = normalizeWallSettings({
    ...getWallSettingsForLocation(normalizedKey),
    ...updates,
  });

  wallSettingsCache.set(normalizedKey, merged);
  updateRoutesForWall(normalizedKey, merged);

  if (getCurrentLocationKey() === normalizedKey) {
    pointDiameter = merged.hollowPointDiameter ?? merged.pointDiameter;
    filledPointDiameter = merged.filledPointDiameter ?? merged.pointDiameter;
    hollowPointLineWidth = merged.hollowPointLineWidth;
    brezerStrokeWidth = merged.brezerStrokeWidth;
    unfocusedTransparency = merged.unfocusedTransparency;
    gradeBarBaseHeight = merged.gradeBarBaseHeight;
    gradeBarMaxHeight = merged.gradeBarMaxHeight;
    gradeBarWidth = merged.gradeBarWidth;
    gradeBarTransparency = merged.gradeBarTransparency;
    updatePathControls();
    updateAppearanceControls();
    redraw();
  } else {
    redraw();
  }

  try {
    const locationDetails =
      (currentLocation && normalizeWallKey(currentLocation.name) === normalizedKey
        ? currentLocation
        : null) ||
      findLocationByName(normalizedKey) ||
      null;

    const wallPayload = {
      pointDiameter: merged.hollowPointDiameter ?? merged.pointDiameter,
      hollowPointDiameter: merged.hollowPointDiameter ?? merged.pointDiameter,
      hollowPointLineWidth: merged.hollowPointLineWidth,
      filledPointDiameter: merged.filledPointDiameter ?? merged.pointDiameter,
      rectangleWidth: merged.rectangleWidth,
      rectangleHeight: merged.rectangleHeight,
      brezerStrokeWidth: merged.brezerStrokeWidth,
      unfocusedTransparency: merged.unfocusedTransparency,
      gradeBarBaseHeight: merged.gradeBarBaseHeight,
      gradeBarMaxHeight: merged.gradeBarMaxHeight,
      gradeBarWidth: merged.gradeBarWidth,
      transparency: merged.gradeBarTransparency,
      updatedAt: serverTimestamp(),
      key: normalizedKey,
    };

    if (locationDetails) {
      const { name, image } = locationDetails;
      if (typeof name === 'string' && name.trim()) {
        wallPayload.name = name.trim();
      }

      if (typeof image === 'string' && image.trim()) {
        wallPayload.background_url = image.trim();
      }
    }

    const docId = wallDocumentIdMap.get(normalizedKey) || normalizedKey;
    await setDoc(doc(db, WALL_COLLECTION, docId), wallPayload, { merge: true });
    wallDocumentIdMap.set(normalizedKey, docId);

    if (typeof wallPayload.name === 'string' && wallPayload.name) {
      const normalizedName = normalizeWallKey(wallPayload.name);
      if (normalizedName) {
        wallDocumentIdMap.set(normalizedName, docId);
        if (!wallSettingsCache.has(normalizedName)) {
          wallSettingsCache.set(normalizedName, merged);
        }
      }
    }

    if (locationDetails?.key) {
      const normalizedLocationKey = normalizeWallKey(locationDetails.key);
      if (normalizedLocationKey) {
        wallDocumentIdMap.set(normalizedLocationKey, docId);
        if (!wallSettingsCache.has(normalizedLocationKey)) {
          wallSettingsCache.set(normalizedLocationKey, merged);
        }
      }
    }
  } catch (error) {
    console.error('Failed to save wall settings:', error);
    setStatus('Failed to save wall settings. Please try again.', 'error');
    throw error;
  }
}

async function handleCreateWall() {
  if (isCreatingWall) {
    return;
  }

  clearCreateWallStatusMessage();

  const rawName = newWallNameInput?.value ?? '';
  const trimmedName = rawName.trim();
  if (!trimmedName) {
    setCreateWallStatusMessage('Enter a wall name.', 'error');
    newWallNameInput?.focus();
    return;
  }

  const rawImage = newWallImageInput?.value ?? '';
  const trimmedImage = rawImage.trim();
  if (!trimmedImage) {
    setCreateWallStatusMessage('Enter a background image URL.', 'error');
    newWallImageInput?.focus();
    return;
  }

  const normalizedKey = normalizeWallKey(trimmedName);
  if (!normalizedKey) {
    setCreateWallStatusMessage('Enter a valid wall name.', 'error');
    newWallNameInput?.focus();
    return;
  }

  if (findLocationByKey(normalizedKey) || findLocationByName(trimmedName)) {
    setCreateWallStatusMessage('A wall with this name already exists.', 'error');
    return;
  }

  if (wallDocumentIdMap.has(normalizedKey)) {
    setCreateWallStatusMessage('A wall with this key already exists.', 'error');
    return;
  }

  isCreatingWall = true;
  if (createWallButton) {
    createWallButton.disabled = true;
  }

  setCreateWallStatusMessage('Creating wall…');

  try {
    const wallSettings = createDefaultWallSettings();
    const payload = {
      name: trimmedName,
      background_url: trimmedImage,
      pointDiameter: wallSettings.hollowPointDiameter,
      hollowPointDiameter: wallSettings.hollowPointDiameter,
      hollowPointLineWidth: wallSettings.hollowPointLineWidth,
      filledPointDiameter: wallSettings.filledPointDiameter,
      rectangleWidth: wallSettings.rectangleWidth,
      rectangleHeight: wallSettings.rectangleHeight,
      unfocusedTransparency: wallSettings.unfocusedTransparency,
      gradeBarBaseHeight: wallSettings.gradeBarBaseHeight,
      gradeBarMaxHeight: wallSettings.gradeBarMaxHeight,
      gradeBarWidth: wallSettings.gradeBarWidth,
      transparency: wallSettings.gradeBarTransparency,
      key: normalizedKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docId = normalizedKey;
    await setDoc(doc(db, WALL_COLLECTION, docId), payload, { merge: true });

    wallDocumentIdMap.set(normalizedKey, docId);
    wallSettingsCache.set(normalizedKey, wallSettings);

    const { entry: locationEntry, changed } = upsertLocation({
      key: normalizedKey,
      name: trimmedName,
      image: trimmedImage,
      fallbackName: trimmedName,
      hidden: false,
    });

    if (changed) {
      renderLocationOptions();
    }

    synchronizeCurrentLocationReference();

    if (newWallNameInput) {
      newWallNameInput.value = '';
    }
    if (newWallImageInput) {
      newWallImageInput.value = '';
    }

    const targetLocation =
      locationEntry ||
      findLocationByKey(normalizedKey) ||
      { key: normalizedKey, name: trimmedName, image: trimmedImage };

    setLocation(targetLocation, {
      persist: true,
      refreshRoutes: true,
      wallFallback: wallSettings,
    });

    setCreateWallStatusMessage(`Created wall “${trimmedName}”.`, 'success');
  } catch (error) {
    console.error('Failed to create wall:', error);
    setCreateWallStatusMessage('Failed to create wall. Please try again.', 'error');
  } finally {
    isCreatingWall = false;
    if (createWallButton) {
      createWallButton.disabled = false;
    }
  }
}

async function handleDeleteWall() {
  if (isDeletingWall) {
    return;
  }

  clearCreateWallStatusMessage();

  const activeLocation = currentLocation || null;
  const locationKey = getCurrentLocationKey();
  const locationName = activeLocation?.name || '';

  if (!locationKey) {
    setCreateWallStatusMessage('Select a wall before deleting it.', 'error');
    return;
  }

  if (LOCATIONS.length <= 1) {
    setCreateWallStatusMessage(
      'At least one wall must remain. Create another wall before deleting this one.',
      'error',
    );
    return;
  }

  const confirmationLabel = locationName || locationKey;
  const confirmed = window.confirm(
    `Delete wall “${confirmationLabel}”? This will remove all associated routes.`,
  );

  if (!confirmed) {
    return;
  }

  const normalizedCurrentKey = normalizeWallKey(locationKey);
  const docId = wallDocumentIdMap.get(normalizedCurrentKey) || locationKey;
  const wallRef = doc(db, WALL_COLLECTION, docId);

  isDeletingWall = true;
  if (deleteWallButton) {
    deleteWallButton.disabled = true;
  }

  setCreateWallStatusMessage('Deleting wall…');
  updateDeleteWallButtonState();

  try {
    let wallSnapshot = null;
    try {
      wallSnapshot = await getDoc(wallRef);
    } catch (snapshotError) {
      console.warn('Unable to load wall before deletion:', snapshotError);
    }

    const wallData = wallSnapshot?.exists?.() ? wallSnapshot.data() : null;

    const normalizedTargets = new Set(
      [
        normalizedCurrentKey,
        normalizeWallKey(docId),
        normalizeWallKey(wallData?.key),
        normalizeLocationName(wallData?.name),
        normalizeLocationName(locationName),
      ].filter(Boolean),
    );

    const routesSnapshot = await getDocs(collection(db, 'routes'));
    const routeIdsToDelete = [];
    routesSnapshot.forEach((routeSnap) => {
      const data = routeSnap.data();
      const normalizedRouteLocation = normalizeWallKey(
        typeof data?.locationKey === 'string' && data.locationKey
          ? data.locationKey
          : normalizeLocationName(data?.location),
      );
      if (normalizedRouteLocation && normalizedTargets.has(normalizedRouteLocation)) {
        routeIdsToDelete.push(routeSnap.id);
      }
    });

    for (const routeId of routeIdsToDelete) {
      await deleteDoc(doc(db, 'routes', routeId));
      routesCache.delete(routeId);
    }

    await deleteDoc(wallRef);

    const keysToRemove = new Set(normalizedTargets);

    for (const [key, value] of [...wallDocumentIdMap.entries()]) {
      if (keysToRemove.has(key) || value === docId) {
        wallDocumentIdMap.delete(key);
      }
    }

    for (const key of keysToRemove) {
      wallSettingsCache.delete(key);
    }

    for (let index = LOCATIONS.length - 1; index >= 0; index -= 1) {
      const entry = LOCATIONS[index];
      if (!entry) {
        continue;
      }
      const entryKey = normalizeWallKey(entry.key);
      const entryName = normalizeLocationName(entry.name);
      if (keysToRemove.has(entryKey) || keysToRemove.has(entryName)) {
        LOCATIONS.splice(index, 1);
      }
    }

    renderLocationOptions();

    const fallbackLocation = LOCATIONS.find((location) => {
      const entryKey = normalizeWallKey(location?.key || location?.name);
      return entryKey && !keysToRemove.has(entryKey);
    });

    if (fallbackLocation) {
      setLocation(fallbackLocation, { persist: true, refreshRoutes: false });
    } else {
      currentLocation = null;
      clearRouteFocus();
      updateLocationButtonLabel();
      updateLocationOptionsState();
      applyBodyBackground('');
    }

    updateDeleteWallButtonState();

    const cacheRouteKeysToDelete = [];
    routesCache.forEach((data, routeKey) => {
      const normalizedRouteLocation = normalizeWallKey(
        typeof data?.locationKey === 'string' && data.locationKey
          ? data.locationKey
          : normalizeLocationName(data?.location),
      );
      if (normalizedRouteLocation && keysToRemove.has(normalizedRouteLocation)) {
        cacheRouteKeysToDelete.push(routeKey);
      }
    });

    cacheRouteKeysToDelete.forEach((routeKey) => {
      routesCache.delete(routeKey);
    });

    await loadRoutesList('');
    prepareNewRoute('Wall deleted. You can select another wall.');

    setCreateWallStatusMessage(`Deleted wall “${confirmationLabel}”.`, 'success');
  } catch (error) {
    console.error('Failed to delete wall:', error);
    setCreateWallStatusMessage('Failed to delete wall. Please try again.', 'error');
  } finally {
    isDeletingWall = false;
    if (deleteWallButton) {
      deleteWallButton.disabled = false;
    }
    updateDeleteWallButtonState();
  }
}

const isValidUsername = (value) => USERNAME_PATTERN.test(normalizeUsername(value));
const isValidSetterName = (value) => SETTER_NAME_PATTERN.test(normalizeSetterName(value));

const buildSyntheticEmail = (username) => {
  const normalized = normalizeUsername(username);
  return normalized ? `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}` : '';
};

const points = [];
const normalizedPointsByPathType = new Map();
let strokeColor = sanitizeColor(colorPicker.value || '#ffde59');
let pathType = DEFAULT_PATH_TYPE;
let isDrawingEnabled = false;
let pointDiameter = DEFAULT_HOLLOW_POINT_DIAMETER;
let hollowPointLineWidth = DEFAULT_HOLLOW_POINT_LINE_WIDTH;
let filledPointDiameter = DEFAULT_FILLED_POINT_DIAMETER;
let rectangleWidth = DEFAULT_RECTANGLE_WIDTH;
let rectangleHeight = DEFAULT_RECTANGLE_HEIGHT;
let brezerStrokeWidth = DEFAULT_BREZER_STROKE_WIDTH;
let unfocusedTransparency = DEFAULT_UNFOCUSED_TRANSPARENCY;
let gradeBarBaseHeight = DEFAULT_GRADE_BAR_BASE_HEIGHT;
let gradeBarMaxHeight = DEFAULT_GRADE_BAR_MAX_HEIGHT;
let gradeBarWidth = DEFAULT_GRADE_BAR_WIDTH;
let gradeBarTransparency = DEFAULT_GRADE_BAR_TRANSPARENCY;
let currentRouteGradeValue = null;
let currentRouteNumericGrade = null;
let wheelHue = 48;
let wheelSaturation = 1;
let wheelLightness = 0.5;
let isWheelPointerActive = false;
let loadedNormalizedPoints = null;
let currentRouteKey = '';
let hasUnsavedChanges = false;
let isSaving = false;
let currentUsername = '';
let currentUserId = null;
let isCanvasScrollable = false;
let isCreatingWall = false;
let isDeletingWall = false;
let isPointerPanning = false;
let panPointerId = null;
let panPointerButton = 0;
let panStartScrollLeft = 0;
let panStartScrollTop = 0;
let panOriginX = 0;
let panOriginY = 0;
let shouldIgnoreNextClick = false;
let isPanModifierActive = false;
const helpTargets = new Map();
let infoModeActive = false;
let awaitingHelpTargetSelection = false;
let activeHelpEntry = null;

registerHelpTargets(document);
setInfoButtonActiveState(false);
updateHelpTooltips();

if (drawingToggle) {
  updateDrawingToggle();
  drawingToggle.addEventListener('click', () => {
    setDrawingEnabled(!isDrawingEnabled);
  });
}

if (tutorialPrimaryAction) {
  tutorialPrimaryAction.addEventListener('click', () => {
    if (!tutorialActive) {
      return;
    }

    if (tutorialStepIndex >= tutorialSteps.length - 1) {
      void finishTutorial();
    } else {
      void goToTutorialStep(tutorialStepIndex + 1);
    }
  });
}

if (tutorialSecondaryAction) {
  tutorialSecondaryAction.addEventListener('click', () => {
    if (!tutorialActive) {
      return;
    }

    const mode = tutorialSecondaryAction.dataset.mode || tutorialSecondaryActionMode;
    if (mode === 'skip' || mode === 'close') {
      void finishTutorial();
      return;
    }

    if (tutorialStepIndex <= 0) {
      return;
    }

    void goToTutorialStep(tutorialStepIndex - 1);
  });
}

if (tutorialOverlay) {
  tutorialOverlay.addEventListener('click', (event) => {
    if (event.target === tutorialOverlay) {
      void finishTutorial();
    }
  });
}

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space') {
    return;
  }

  if (event.repeat) {
    event.preventDefault();
    return;
  }

  if (isInteractiveElement(event.target)) {
    return;
  }

  event.preventDefault();
  updatePanModifierState(true);
});

window.addEventListener('keyup', (event) => {
  if (event.code !== 'Space') {
    return;
  }

  updatePanModifierState(false);
});

window.addEventListener('blur', () => {
  updatePanModifierState(false);
});

if (canvas) {
  canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  canvas.addEventListener('pointermove', handleCanvasPointerMove);
  canvas.addEventListener('pointerup', handleCanvasPointerEnd);
  canvas.addEventListener('pointercancel', handleCanvasPointerEnd);
  canvas.addEventListener('pointerleave', handleCanvasPointerEnd);
}

const routesCache = new Map();
let queuedGradeBarOverlays = [];
let focusedRouteKey = '';
let overlayInteractionEntries = [];

const DOUBLE_FOCUS_TIME_THRESHOLD = 350;
const DOUBLE_FOCUS_DISTANCE_THRESHOLD = 32;
let lastFocusActivation = {
  time: 0,
  routeKey: '',
  pointerType: '',
  x: 0,
  y: 0,
};

const resetLastFocusActivation = () => {
  lastFocusActivation = {
    time: 0,
    routeKey: '',
    pointerType: '',
    x: 0,
    y: 0,
  };
};

const resolvePointerType = (event) => {
  if (!event) {
    return '';
  }

  if (typeof event.pointerType === 'string') {
    return event.pointerType;
  }

  if (typeof event.type === 'string') {
    if (event.type.startsWith('mouse')) {
      return 'mouse';
    }
    if (event.type.startsWith('touch')) {
      return 'touch';
    }
    if (event.type.startsWith('pen')) {
      return 'pen';
    }
  }

  return '';
};

const resolveOverlayInteraction = (event, entry) => {
  if (!entry || typeof entry.routeKey !== 'string' || !entry.routeKey) {
    resetLastFocusActivation();
    return null;
  }

  const pointerType = resolvePointerType(event);
  const now = typeof event?.timeStamp === 'number' ? event.timeStamp : Date.now();
  const clickCount = typeof event?.detail === 'number' ? event.detail : 0;
  let isDoubleActivation = clickCount >= 2;

  if (!isDoubleActivation && lastFocusActivation.routeKey) {
    const elapsed = now - lastFocusActivation.time;
    if (elapsed <= DOUBLE_FOCUS_TIME_THRESHOLD) {
      const pointerMatches =
        !pointerType || !lastFocusActivation.pointerType
          ? true
          : pointerType === lastFocusActivation.pointerType;
      if (pointerMatches && entry.routeKey === lastFocusActivation.routeKey) {
        const dx = (entry.canvasX ?? 0) - (lastFocusActivation.x ?? 0);
        const dy = (entry.canvasY ?? 0) - (lastFocusActivation.y ?? 0);
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= DOUBLE_FOCUS_DISTANCE_THRESHOLD * DOUBLE_FOCUS_DISTANCE_THRESHOLD) {
          isDoubleActivation = true;
        }
      }
    }
  }

  lastFocusActivation = {
    time: now,
    routeKey: entry.routeKey,
    pointerType,
    x: entry.canvasX ?? 0,
    y: entry.canvasY ?? 0,
  };

  if (isDoubleActivation) {
    return 'switch';
  }

  return 'focus';
};

const distanceSquared = (x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
};

const isPointNearSegment = (px, py, x1, y1, x2, y2, padding = 0) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0.0001) {
    return distanceSquared(px, py, x1, y1) <= padding * padding;
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return distanceSquared(px, py, projX, projY) <= padding * padding;
};

const getOverlayRouteAtCanvasPoint = (canvasX, canvasY) => {
  if (!overlayInteractionEntries.length) {
    return null;
  }

  for (let index = overlayInteractionEntries.length - 1; index >= 0; index -= 1) {
    const entry = overlayInteractionEntries[index];
    if (!entry || !entry.routeKey) {
      continue;
    }

    if (entry.type === 'circle') {
      const radius = Number(entry.radius) || 0;
      if (radius > 0) {
        const distance = distanceSquared(canvasX, canvasY, Number(entry.cx), Number(entry.cy));
        if (distance <= radius * radius) {
          return {
            routeKey: entry.routeKey,
            canvasX: entry.cx,
            canvasY: entry.cy,
            route: routesCache.get(entry.routeKey) || null,
          };
        }
      }
    } else if (entry.type === 'rect') {
      const left = Number(entry.left);
      const right = Number(entry.right);
      const top = Number(entry.top);
      const bottom = Number(entry.bottom);
      if (canvasX >= left && canvasX <= right && canvasY >= top && canvasY <= bottom) {
        return {
          routeKey: entry.routeKey,
          canvasX: (left + right) / 2,
          canvasY: (top + bottom) / 2,
          route: routesCache.get(entry.routeKey) || null,
        };
      }
    } else if (entry.type === 'segment') {
      const padding = Number(entry.padding) || 0;
      const x1 = Number(entry.x1);
      const y1 = Number(entry.y1);
      const x2 = Number(entry.x2);
      const y2 = Number(entry.y2);
      if (isPointNearSegment(canvasX, canvasY, x1, y1, x2, y2, padding)) {
        return {
          routeKey: entry.routeKey,
          canvasX: (x1 + x2) / 2,
          canvasY: (y1 + y2) / 2,
          route: routesCache.get(entry.routeKey) || null,
        };
      }
    }
  }

  return null;
};

const setFocusedRouteKey = (routeKey, { resetActivation = false } = {}) => {
  const normalizedKey = typeof routeKey === 'string' ? routeKey : '';
  if (focusedRouteKey === normalizedKey) {
    if (resetActivation) {
      resetLastFocusActivation();
    }
    return;
  }

  focusedRouteKey = normalizedKey;
  if (resetActivation) {
    resetLastFocusActivation();
  }
  redraw();
};

const clearRouteFocus = () => {
  if (!focusedRouteKey) {
    resetLastFocusActivation();
    return;
  }

  focusedRouteKey = '';
  resetLastFocusActivation();
  redraw();
};

const handlePotentialOverlayFocus = async (event) => {
  if (!canvas) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;

  if (!Number.isFinite(canvasX) || !Number.isFinite(canvasY)) {
    resetLastFocusActivation();
    return;
  }

  const entry = getOverlayRouteAtCanvasPoint(canvasX, canvasY);
  if (!entry || !entry.routeKey) {
    resetLastFocusActivation();
    return;
  }

  const interaction = resolveOverlayInteraction(event, {
    routeKey: entry.routeKey,
    canvasX: entry.canvasX,
    canvasY: entry.canvasY,
  });

  if (interaction === 'switch') {
    const label = entry.route?.title || entry.routeKey;
    const confirmMessage = hasUnsavedChanges
      ? `Switch to route “${label}”? This will discard your current drawing because it hasn't been saved yet.`
      : `Switch to route “${label}”? This will discard your current drawing if it isn't saved.`;
    const shouldSwitch = window.confirm(confirmMessage);
    if (shouldSwitch) {
      if (routeSelector) {
        routeSelector.disabled = true;
      }
      try {
        const loaded = await loadRouteByKey(entry.routeKey);
        if (!loaded && routeSelector) {
          routeSelector.value = currentRouteKey || '';
        }
      } finally {
        if (routeSelector) {
          routeSelector.disabled = false;
        }
      }
    }
    resetLastFocusActivation();
    return;
  }

  if (interaction === 'focus' && entry.routeKey === currentRouteKey) {
    setFocusedRouteKey(entry.routeKey, { resetActivation: true });
  }
};

const updatePanelToggleState = () => {
  if (!panelToggleButton || !controlPanel) {
    return;
  }

  const expanded = controlPanel.getAttribute('data-expanded') !== 'false';
  const label = expanded ? 'Hide menu' : 'Show menu';
  const pressed = !expanded;
  panelToggleButton.setAttribute('aria-label', label);
  panelToggleButton.setAttribute('title', label);
  panelToggleButton.setAttribute('aria-pressed', String(pressed));
  const srTarget = panelToggleButton.querySelector('.sr-only');
  if (srTarget) {
    srTarget.textContent = label;
  }
};

const setPanelExpanded = (value) => {
  if (!controlPanel) {
    return;
  }

  const expanded = Boolean(value);
  controlPanel.setAttribute('data-expanded', String(expanded));
  updatePanelToggleState();
  updateHelpTooltips();
};

if (controlPanel) {
  const initialExpanded = controlPanel.getAttribute('data-expanded') !== 'false';
  setPanelExpanded(initialExpanded);
  updatePanelMeasurements();

  window.addEventListener('resize', updatePanelMeasurements);

  if ('ResizeObserver' in window && panelSidebar) {
    const resizeObserver = new ResizeObserver(updatePanelMeasurements);
    resizeObserver.observe(panelSidebar);
  }
}

if (panelToggleButton) {
  panelToggleButton.addEventListener('click', () => {
    const isExpanded = controlPanel?.getAttribute('data-expanded') !== 'false';
    setPanelExpanded(!isExpanded);
    requestAnimationFrame(updatePanelMeasurements);
  });
}

if (infoButton && infoPopover) {
  infoButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (infoModeActive) {
      deactivateInfoMode({ clearTooltip: true });
    } else {
      activateInfoMode();
    }
  });

  infoPopover.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  if (startTutorialButton) {
    startTutorialButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      cancelTutorialAutostart();
      deactivateInfoMode({ clearTooltip: true });
      const started = await startTutorial({ force: true });
      if (!started) {
        scheduleTutorialAutostart();
      }
    });
  }
}

document.addEventListener(
  'click',
  (event) => {
    if (!infoModeActive || !awaitingHelpTargetSelection) {
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      deactivateInfoMode({ clearTooltip: true });
      return;
    }

    if ((infoButton && infoButton.contains(target)) || (infoPopover && infoPopover.contains(target))) {
      return;
    }

    const helpElement = target.closest('[data-help-text]');
    if (helpElement) {
      event.preventDefault();
      event.stopPropagation();
      const entry = showHelpTooltipForElement(helpElement);
      deactivateInfoMode({ clearTooltip: !entry });
    } else {
      deactivateInfoMode({ clearTooltip: true });
    }
  },
  true,
);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (infoModeActive) {
      deactivateInfoMode({ clearTooltip: true });
      if (infoButton) {
        infoButton.focus();
      }
    } else if (activeHelpEntry) {
      clearActiveHelpTooltip();
      if (infoButton) {
        infoButton.focus();
      }
    }
  }
});

renderLocationOptions();
updateWallVisibilityControls();

if (tabButtons.length) {
  tabButtons.forEach((button) => {
    if (!button) {
      return;
    }
    button.addEventListener('click', () => {
      const targetId = button.dataset?.target;
      const expanded = controlPanel
        ? controlPanel.getAttribute('data-expanded') !== 'false'
        : false;
      const isActive = button.getAttribute('aria-selected') === 'true';

      if (isActive && expanded) {
        setPanelExpanded(false);
        requestAnimationFrame(updatePanelMeasurements);
        return;
      }

      if (!expanded) {
        setPanelExpanded(true);
        requestAnimationFrame(updatePanelMeasurements);
      }

      if (targetId) {
        activateTab(targetId);
      }
    });
  });
}

activateTab('routesTab');

const wallKeyFromQuery = getWallKeyFromQuery();
let initialLocation = wallKeyFromQuery
  ? findLocationByKey(wallKeyFromQuery) || findLocationByName(wallKeyFromQuery)
  : null;

let storedLocationKey = null;
if (!initialLocation) {
  try {
    storedLocationKey = window.localStorage?.getItem(LOCATION_STORAGE_KEY) || null;
  } catch (error) {
    console.warn('Unable to read setter location preference:', error);
  }

  if (storedLocationKey) {
    const normalizedStoredKey = normalizeWallKey(storedLocationKey);
    initialLocation =
      findLocationByKey(normalizedStoredKey) || findLocationByName(normalizedStoredKey);
  }
}

if (!initialLocation) {
  initialLocation = DEFAULT_LOCATION;
}

setLocation(initialLocation, { persist: true, refreshRoutes: false });

if (locationButton) {
  locationButton.setAttribute('aria-expanded', 'false');
}

if (locationButton) {
  locationButton.addEventListener('click', (event) => {
    event.preventDefault();
    openLocationModal();
  });
}

if (wallVisibilityToggle) {
  wallVisibilityToggle.addEventListener('change', (event) => {
    applyWallVisibilityChange(event.target.checked).catch((error) => {
      console.error('Failed to update wall visibility:', error);
    });
  });
}

if (locationModalClose) {
  locationModalClose.addEventListener('click', (event) => {
    event.preventDefault();
    closeLocationModal();
  });
}

if (locationModal) {
  locationModal.addEventListener('click', (event) => {
    if (event.target === locationModal) {
      closeLocationModal();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLocationModal();
  }
});

const wheelCtx = colorWheelCanvas ? colorWheelCanvas.getContext('2d') : null;

if (colorWheelCanvas) {
  const baseSize = 220;
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  colorWheelCanvas.width = Math.round(baseSize * ratio);
  colorWheelCanvas.height = Math.round(baseSize * ratio);
}

function hslToRgb(h, s, l) {
  let r;
  let g;
  let b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hueToRgb = (p, q, t) => {
      let temp = t;
      if (temp < 0) temp += 1;
      if (temp > 1) temp -= 1;
      if (temp < 1 / 6) return p + (q - p) * 6 * temp;
      if (temp < 1 / 2) return q;
      if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function hslToHex(h, s, l) {
  const [r, g, b] = hslToRgb((h % 360 + 360) % 360 / 360, s, l);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case red:
        h = (green - blue) / d + (green < blue ? 6 : 0);
        break;
      case green:
        h = (blue - red) / d + 2;
        break;
      default:
        h = (red - green) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, l };
}

function hexToHsl(value) {
  if (typeof value !== 'string') {
    return { h: wheelHue, s: wheelSaturation, l: wheelLightness };
  }

  const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) {
    return { h: wheelHue, s: wheelSaturation, l: wheelLightness };
  }

  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return rgbToHsl(r, g, b);
}

function drawColorWheel(lightness = wheelLightness) {
  if (!wheelCtx || !colorWheelCanvas) {
    return;
  }

  const { width, height } = colorWheelCanvas;
  const imageData = wheelCtx.createImageData(width, height);
  const { data } = imageData;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const index = (y * width + x) * 4;

      if (distance <= radius) {
        const hue = (Math.atan2(dy, dx) * 180) / Math.PI;
        const saturation = Math.min(1, distance / radius);
        const [r, g, b] = hslToRgb(((hue % 360) + 360) % 360 / 360, saturation, lightness);
        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = 255;
      } else {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
      }
    }
  }

  wheelCtx.putImageData(imageData, 0, 0);
}

function updateColorWheelMarker() {
  if (!colorWheelMarker || !colorWheelCanvas) {
    return;
  }

  const radius = Math.min(colorWheelCanvas.width, colorWheelCanvas.height) / 2;
  const angle = (wheelHue * Math.PI) / 180;
  const markerRadius = wheelSaturation * radius;
  const x = radius + Math.cos(angle) * markerRadius;
  const y = radius + Math.sin(angle) * markerRadius;
  colorWheelMarker.style.left = `${x}px`;
  colorWheelMarker.style.top = `${y}px`;
}

function updateLightnessSliderGradient() {
  if (!colorLightnessSlider) {
    return;
  }

  const dark = hslToHex(wheelHue, wheelSaturation, 0);
  const mid = hslToHex(wheelHue, wheelSaturation, 0.5);
  const light = hslToHex(wheelHue, wheelSaturation, 1);
  colorLightnessSlider.style.background = `linear-gradient(90deg, ${dark}, ${mid}, ${light})`;
}

function updateAdvancedPreview(hex) {
  if (colorWheelValue) {
    colorWheelValue.textContent = hex.toUpperCase();
  }
  if (colorWheelSwatch) {
    colorWheelSwatch.style.background = hex;
  }
}

function setStrokeColorFromWheel(nextHue, nextSaturation, nextLightness, { quiet = false } = {}) {
  wheelHue = ((nextHue % 360) + 360) % 360;
  wheelSaturation = Math.min(Math.max(nextSaturation, 0), 1);
  wheelLightness = Math.min(Math.max(nextLightness, 0), 1);

  if (colorLightnessSlider) {
    const sliderValue = Math.round(wheelLightness * 100);
    if (Number.isFinite(sliderValue)) {
      colorLightnessSlider.value = String(sliderValue);
    }
  }

  updateColorWheelMarker();
  updateLightnessSliderGradient();

  const hex = sanitizeColor(hslToHex(wheelHue, wheelSaturation, wheelLightness));
  if (colorPicker && colorPicker.value !== hex) {
    colorPicker.value = hex;
  }
  updateAdvancedPreview(hex);

  if (strokeColor !== hex && !quiet) {
    strokeColor = hex;
    loadedNormalizedPoints = null;
    redraw();
    markUnsavedChange();
  } else if (strokeColor !== hex) {
    strokeColor = hex;
  }
}

function syncAdvancedColorPicker(color) {
  if (!colorWheelCanvas) {
    return;
  }

  const sanitized = sanitizeColor(color);
  const { h, s, l } = hexToHsl(sanitized);
  wheelHue = Number.isFinite(h) ? h : wheelHue;
  wheelSaturation = Number.isFinite(s) ? s : wheelSaturation;
  wheelLightness = Number.isFinite(l) ? l : wheelLightness;

  drawColorWheel(wheelLightness);
  updateColorWheelMarker();
  updateLightnessSliderGradient();

  if (colorLightnessSlider) {
    colorLightnessSlider.value = String(Math.round(wheelLightness * 100));
  }

  updateAdvancedPreview(sanitized);
}

function handleWheelSelection(clientX, clientY) {
  if (!colorWheelCanvas) {
    return;
  }

  const rect = colorWheelCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const scaleX = colorWheelCanvas.width / rect.width;
  const scaleY = colorWheelCanvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const centerX = colorWheelCanvas.width / 2;
  const centerY = colorWheelCanvas.height / 2;
  let dx = x - centerX;
  let dy = y - centerY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const radius = Math.min(centerX, centerY);

  if (distance > radius) {
    const ratio = radius / distance;
    dx *= ratio;
    dy *= ratio;
  }

  const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const saturation = Math.min(1, Math.sqrt(dx * dx + dy * dy) / radius);
  setStrokeColorFromWheel(hue, saturation, wheelLightness);
}

if (advancedColorToggle && advancedColorPicker) {
  advancedColorToggle.addEventListener('click', () => {
    if (!advancedColorPicker) {
      return;
    }

    const isHidden = advancedColorPicker.classList.toggle('hidden');
    const expanded = !isHidden;
    advancedColorToggle.setAttribute('aria-expanded', String(expanded));
    advancedColorPicker.setAttribute('aria-hidden', String(!expanded));
    advancedColorToggle.textContent = expanded ? 'Hide colour wheel' : 'Open colour wheel';

    if (expanded) {
      drawColorWheel(wheelLightness);
      updateColorWheelMarker();
      updateLightnessSliderGradient();
    }

    updateHelpTooltips();
  });
}

if (colorWheelCanvas) {
  const normalizeEvent = (event) => {
    event.preventDefault();
    handleWheelSelection(event.clientX, event.clientY);
  };

  colorWheelCanvas.addEventListener('pointerdown', (event) => {
    isWheelPointerActive = true;
    if (typeof colorWheelCanvas.setPointerCapture === 'function') {
      colorWheelCanvas.setPointerCapture(event.pointerId);
    }
    if (document.activeElement !== colorWheelCanvas) {
      colorWheelCanvas.focus();
    }
    normalizeEvent(event);
  });

  colorWheelCanvas.addEventListener('pointermove', (event) => {
    if (!isWheelPointerActive) {
      return;
    }
    normalizeEvent(event);
  });

  const stopPointer = (event) => {
    if (
      typeof colorWheelCanvas.releasePointerCapture === 'function' &&
      colorWheelCanvas.hasPointerCapture(event.pointerId)
    ) {
      colorWheelCanvas.releasePointerCapture(event.pointerId);
    }
    isWheelPointerActive = false;
  };

  colorWheelCanvas.addEventListener('pointerup', stopPointer);
  colorWheelCanvas.addEventListener('pointercancel', stopPointer);
  colorWheelCanvas.addEventListener('pointerleave', () => {
    isWheelPointerActive = false;
  });

  colorWheelCanvas.addEventListener('keydown', (event) => {
    const hueStep = event.shiftKey ? 10 : 3;
    const satStep = event.shiftKey ? 0.05 : 0.02;
    let handled = true;

    switch (event.key) {
      case 'ArrowLeft':
        setStrokeColorFromWheel(wheelHue - hueStep, wheelSaturation, wheelLightness);
        break;
      case 'ArrowRight':
        setStrokeColorFromWheel(wheelHue + hueStep, wheelSaturation, wheelLightness);
        break;
      case 'ArrowUp':
        setStrokeColorFromWheel(wheelHue, Math.min(1, wheelSaturation + satStep), wheelLightness);
        break;
      case 'ArrowDown':
        setStrokeColorFromWheel(wheelHue, Math.max(0, wheelSaturation - satStep), wheelLightness);
        break;
      default:
        handled = false;
        break;
    }

    if (handled) {
      event.preventDefault();
    }
  });
}

if (colorLightnessSlider) {
  colorLightnessSlider.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (!Number.isFinite(value)) {
      return;
    }

    const normalized = Math.min(Math.max(value, 0), 100) / 100;
    setStrokeColorFromWheel(wheelHue, wheelSaturation, normalized);
    drawColorWheel(wheelLightness);
  });
}

syncAdvancedColorPicker(strokeColor);

if (climberViewButton) {
  climberViewButton.addEventListener('click', () => {
    const activeKey = getCurrentLocationKey();
    const targetHref = buildWallAwareHref(climberViewBaseHref, activeKey);
    const destination = targetHref || climberViewTargetHref || climberViewBaseHref;
    window.location.href = destination;
  });
}

if (personalDashboardButton) {
  personalDashboardButton.addEventListener('click', () => {
    window.location.href = 'personal.html';
  });
}

const ADMIN_CONSOLE_PATH = 'admin.html';

if (adminConsoleButton) {
  adminConsoleButton.addEventListener('click', () => {
    if (adminConsoleButton.disabled) {
      return;
    }

    window.location.href = ADMIN_CONSOLE_PATH;
  });
}

function updateAdminConsoleAccess(role) {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  const isAdmin = normalized === 'admin';

  if (adminConsoleButton) {
    adminConsoleButton.classList.toggle('hidden', !isAdmin);
    adminConsoleButton.disabled = !isAdmin;
  }

  if (!adminConsoleStatus) {
    return;
  }

  if (isAdmin) {
    adminConsoleStatus.textContent = 'Open the admin console to manage database operations.';
    adminConsoleStatus.dataset.variant = 'info';
    adminConsoleStatus.classList.remove('hidden');
    return;
  }

  adminConsoleStatus.textContent = '';
  adminConsoleStatus.classList.add('hidden');
  delete adminConsoleStatus.dataset.variant;
}

updateAdminConsoleAccess('');







function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
    return null;
  }

  return null;
}

function isoStringToInputValue(isoString) {
  if (!isoString) {
    return '';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function inputValueToIsoString(inputValue) {
  if (!inputValue) {
    return null;
  }

  const date = new Date(inputValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getNowInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function normalizeRouteData(raw = {}) {
  const normalizeRouteUid = (value) =>
    typeof value === 'string' && value.trim() ? value.trim() : '';
  const rawUid = normalizeRouteUid(raw?.uid);
  const rawId = normalizeRouteUid(raw?.id);
  const resolvedId = rawUid || rawId;
  const { date_removed: _unusedDateRemoved, ...rest } = raw || {};
  const rawLocation = typeof rest.location === 'string' ? rest.location.trim() : '';
  const locationName = rawLocation || DEFAULT_LOCATION?.name || '';
  const locationKey = normalizeLocationName(locationName);
  const normalizedPathType = normalizePathType(rest.pathType);
  const fallbackHollowPointDiameter = normalizePointDiameter(
    rest.hollowPointDiameter ?? rest.pointDiameter,
    DEFAULT_HOLLOW_POINT_DIAMETER,
  );
  const fallbackFilledPointDiameter = normalizePointDiameter(
    rest.filledPointDiameter ?? rest.pointDiameter,
    DEFAULT_FILLED_POINT_DIAMETER,
  );
  const fallbackPointDiameter = fallbackHollowPointDiameter;
  const fallbackRectangleWidth = normalizeRectangleSize(
    rest.rectangleWidth,
    DEFAULT_RECTANGLE_WIDTH,
  );
  const fallbackRectangleHeight = normalizeRectangleSize(
    rest.rectangleHeight,
    DEFAULT_RECTANGLE_HEIGHT,
  );
  const fallbackBrezerStrokeWidth = normalizeBrezerStrokeWidth(rest.brezerStrokeWidth);
  const fallbackHollowPointLineWidth = normalizeHollowPointLineWidth(
    rest.hollowPointLineWidth,
    fallbackHollowPointDiameter,
  );
  const gradeBarBaseHeight = normalizeGradeBarHeight(
    rest.gradeBarBaseHeight,
    DEFAULT_GRADE_BAR_BASE_HEIGHT,
  );
  const gradeBarMaxHeight = Math.max(
    gradeBarBaseHeight,
    normalizeGradeBarHeight(rest.gradeBarMaxHeight, DEFAULT_GRADE_BAR_MAX_HEIGHT),
  );
  const gradeBarWidth = normalizeGradeBarWidth(rest.gradeBarWidth);
  const gradeBarTransparency = normalizeGradeBarTransparency(
    rest.gradeBarTransparency ?? rest.transparency,
  );
  const normalizedGradeField = normalizeRouteGradeField(rest.grade);
  const numericGrade = resolveRouteNumericGrade(normalizedGradeField);
  const wallSettings = getWallSettingsWithFallback(locationKey, {
    pointDiameter: fallbackPointDiameter,
    hollowPointDiameter: fallbackHollowPointDiameter,
    filledPointDiameter: fallbackFilledPointDiameter,
    hollowPointLineWidth: fallbackHollowPointLineWidth,
    rectangleWidth: fallbackRectangleWidth,
    rectangleHeight: fallbackRectangleHeight,
    brezerStrokeWidth: fallbackBrezerStrokeWidth,
    gradeBarBaseHeight,
    gradeBarMaxHeight,
    gradeBarWidth,
    gradeBarTransparency,
  });
  let pointsSource = rest.points;
  if (
    rest.pointsByType instanceof Map ||
    (rest.pointsByType && typeof rest.pointsByType === 'object' && !Array.isArray(rest.pointsByType))
  ) {
    pointsSource = rest.pointsByType;
  }

  const { pointsByType, activePoints } = normalizeRoutePoints(
    pointsSource,
    normalizedPathType,
  );

  const usersMap = normalizeRouteUsers(rest.users);

  return {
    id: resolvedId,
    uid: resolvedId,
    ...rest,
    setter: normalizeSetterName(rest.setter),
    title: typeof rest.title === 'string' ? rest.title.trim() : '',
    description: typeof rest.description === 'string' ? rest.description.trim() : '',
    strokeColor: sanitizeColor(rest.strokeColor),
    pathType: normalizedPathType,
    pointDiameter: wallSettings.hollowPointDiameter ?? wallSettings.pointDiameter,
    hollowPointDiameter: wallSettings.hollowPointDiameter ?? wallSettings.pointDiameter,
    hollowPointLineWidth: wallSettings.hollowPointLineWidth,
    filledPointDiameter: wallSettings.filledPointDiameter ?? wallSettings.pointDiameter,
    rectangleWidth: wallSettings.rectangleWidth,
    rectangleHeight: wallSettings.rectangleHeight,
    brezerStrokeWidth: wallSettings.brezerStrokeWidth,
    gradeBarBaseHeight: wallSettings.gradeBarBaseHeight,
    gradeBarMaxHeight: wallSettings.gradeBarMaxHeight,
    gradeBarWidth: wallSettings.gradeBarWidth,
    gradeBarTransparency: wallSettings.gradeBarTransparency,
    points: activePoints,
    pointsByType,
    users: usersMap,
    date_set: normalizeDateValue(rest.date_set),
    location: locationName,
    locationKey,
    grade: normalizedGradeField,
    numericGrade,
    hiddenFromClimbers: rest.hiddenFromClimbers === true,
  };
}

  function sanitizeNormalizedPoint(point) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }

  function sanitizeNormalizedPointsArray(rawPoints) {
    if (Array.isArray(rawPoints)) {
      return rawPoints.map(sanitizeNormalizedPoint).filter(Boolean);
    }

    if (rawPoints && typeof rawPoints === 'object' && rawPoints !== null) {
      return Object.values(rawPoints).map(sanitizeNormalizedPoint).filter(Boolean);
    }

    return [];
  }

  function normalizeRoutePoints(rawPoints, activePathType) {
    const normalizedActiveType = normalizePathType(activePathType);
    const pointsByType = new Map();

    if (rawPoints instanceof Map) {
      rawPoints.forEach((value, key) => {
        const normalizedKey = normalizePathType(key);
        if (!normalizedKey) {
          return;
        }
        pointsByType.set(normalizedKey, sanitizeNormalizedPointsArray(value));
      });
    } else if (rawPoints && typeof rawPoints === 'object' && !Array.isArray(rawPoints)) {
      Object.entries(rawPoints).forEach(([key, value]) => {
        const normalizedKey = normalizePathType(key);
        if (!normalizedKey) {
          return;
        }
        pointsByType.set(normalizedKey, sanitizeNormalizedPointsArray(value));
      });
    } else if (Array.isArray(rawPoints)) {
      pointsByType.set(normalizedActiveType, sanitizeNormalizedPointsArray(rawPoints));
    }

    if (!pointsByType.has(normalizedActiveType)) {
      pointsByType.set(normalizedActiveType, []);
    }

    return {
      pointsByType,
      activePoints: pointsByType.get(normalizedActiveType) || [],
    };
  }

  function collectRoutePointEntries(routeData) {
    const entries = [];
    if (!routeData) {
      return entries;
    }

    const appendEntry = (pathTypeKey, pointsValue) => {
      const normalizedType = normalizePathType(pathTypeKey);
      if (!normalizedType) {
        return;
      }

      const normalizedPoints = sanitizeNormalizedPointsArray(pointsValue);
      if (!Array.isArray(normalizedPoints) || !normalizedPoints.length) {
        return;
      }

      entries.push({
        pathType: normalizedType,
        normalizedPoints,
      });
    };

    const { pointsByType } = routeData;
    if (pointsByType instanceof Map) {
      pointsByType.forEach((value, key) => appendEntry(key, value));
    } else if (pointsByType && typeof pointsByType === 'object' && !Array.isArray(pointsByType)) {
      Object.entries(pointsByType).forEach(([key, value]) => appendEntry(key, value));
    }

    if (!entries.length) {
      appendEntry(routeData.pathType, routeData.points);
    }

    return entries;
  }

  function serialiseNormalizedPointsByType(pointsByType) {
    const payload = {};
    if (!(pointsByType instanceof Map)) {
      return payload;
    }

    pointsByType.forEach((pointsArray, key) => {
      if (!key || !Array.isArray(pointsArray)) {
        return;
      }
      const sanitized = pointsArray
        .map((point) => sanitizeNormalizedPoint(point))
        .filter(Boolean)
        .map(({ x, y }) => ({
          x: Number(x),
          y: Number(y),
        }));

      payload[key] = sanitized;
    });

    return payload;
  }

  function sanitizeUsersForPersistence(rawUsers) {
    const sanitized = {};

    if (!rawUsers || typeof rawUsers !== 'object') {
      return sanitized;
    }

    if (rawUsers instanceof Map) {
      rawUsers.forEach((details, username) => {
        if (!isValidUsername(username)) {
          return;
        }
        const normalizedUsername = normalizeUsername(username);
        if (!normalizedUsername) {
          return;
        }
        sanitized[normalizedUsername] = sanitizeUserEntry(details);
      });
      return sanitized;
    }

    Object.entries(rawUsers).forEach(([username, details]) => {
      if (!isValidUsername(username)) {
        return;
      }

      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        return;
      }

      sanitized[normalizedUsername] = sanitizeUserEntry(details);
    });

    return sanitized;
  }

  function sanitizeUserEntry(details) {
    const normalizedDetails =
      details && typeof details === 'object' ? details : {};

    const normalizedGrade = normalizeGradeValue(normalizedDetails.grade);
    let ascendedValue = null;
    if (normalizedDetails.ascended === true) {
      ascendedValue = true;
    } else if (normalizedDetails.ascended === false) {
      ascendedValue = false;
    }

    const betatipValue =
      typeof normalizedDetails.betatip === 'string'
        ? normalizedDetails.betatip.replace(/\r\n/g, '\n').trim()
        : null;

    return {
      grade: normalizedGrade,
      ascended: ascendedValue,
      betatip: betatipValue || null,
    };
  }

  function normalizeRouteUsers(rawUsers) {
    const map = new Map();
    if (!rawUsers || typeof rawUsers !== 'object') {
      return map;
    }

    if (rawUsers instanceof Map) {
      rawUsers.forEach((details, username) => {
        if (!isValidUsername(username)) {
          return;
        }
        const normalizedUsername = normalizeUsername(username);
        if (!normalizedUsername) {
          return;
        }
        map.set(normalizedUsername, sanitizeUserEntry(details));
      });
      return map;
    }

    Object.entries(rawUsers).forEach(([username, details]) => {
      if (!isValidUsername(username)) {
        return;
      }

      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        return;
      }

      map.set(normalizedUsername, sanitizeUserEntry(details));
    });

    return map;
  }

function generateRouteUid() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    if (typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint32Array(4);
      crypto.getRandomValues(buffer);
      return Array.from(buffer)
        .map((value) => value.toString(16).padStart(8, '0'))
        .join('');
    }
  }

  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `route-${timestamp}-${random}`;
}

function findConflictingRouteKey(title, excludeKey = '') {
  if (typeof title !== 'string') {
    return null;
  }

  const target = title.trim().toLowerCase();
  if (!target) {
    return null;
  }

  for (const [key, data] of routesCache.entries()) {
    if (key === excludeKey) {
      continue;
    }

    const existingTitle = (data?.title || key).trim().toLowerCase();
    if (existingTitle === target) {
      return key;
    }
  }

  return null;
}

function setStatus(message, variant = 'info') {
  if (!routeStatus) {
    return;
  }
  if (!message) {
    clearStatus();
    return;
  }
  routeStatus.textContent = message;
  routeStatus.classList.remove('hidden');
  if (variant) {
    routeStatus.dataset.variant = variant;
  } else {
    delete routeStatus.dataset.variant;
  }
}

function clearStatus() {
  if (!routeStatus) {
    return;
  }
  routeStatus.textContent = '';
  routeStatus.classList.add('hidden');
  delete routeStatus.dataset.variant;
}

function setCreateWallStatusMessage(message, variant = 'info') {
  if (!createWallStatus) {
    return;
  }
  if (!message) {
    clearCreateWallStatusMessage();
    return;
  }
  createWallStatus.textContent = message;
  createWallStatus.classList.remove('hidden');
  if (variant) {
    createWallStatus.dataset.variant = variant;
  } else {
    delete createWallStatus.dataset.variant;
  }
}

function clearCreateWallStatusMessage() {
  if (!createWallStatus) {
    return;
  }
  createWallStatus.textContent = '';
  createWallStatus.classList.add('hidden');
  delete createWallStatus.dataset.variant;
}

















function markUnsavedChange() {
  if (!hasUnsavedChanges) {
    hasUnsavedChanges = true;
    setStatus('Unsaved changes – remember to save.', 'info');
  }
}

function resetUnsavedState() {
  hasUnsavedChanges = false;
}

function updatePathControls() {
  if (pathTypeSelect) {
    pathTypeSelect.value = pathType;
  }
  if (hollowPointDiameterSlider) {
    hollowPointDiameterSlider.value = String(pointDiameter);
  }
  if (hollowPointDiameterValue) {
    hollowPointDiameterValue.textContent = `${pointDiameter}px`;
  }
  if (filledPointDiameterSlider) {
    filledPointDiameterSlider.value = String(filledPointDiameter);
  }
  if (filledPointDiameterValue) {
    filledPointDiameterValue.textContent = `${filledPointDiameter}px`;
  }
  if (rectangleWidthSlider) {
    rectangleWidthSlider.value = String(rectangleWidth);
  }
  if (rectangleWidthValue) {
    rectangleWidthValue.textContent = `${rectangleWidth}px`;
  }
  if (rectangleHeightSlider) {
    rectangleHeightSlider.value = String(rectangleHeight);
  }
  if (rectangleHeightValue) {
    rectangleHeightValue.textContent = `${rectangleHeight}px`;
  }
  if (brezerStrokeWidthSlider) {
    brezerStrokeWidthSlider.value = String(brezerStrokeWidth);
  }
  if (brezerStrokeWidthValue) {
    brezerStrokeWidthValue.textContent = `${brezerStrokeWidth}px`;
  }
  if (unfocusedTransparencySlider) {
    unfocusedTransparencySlider.value = String(
      convertUnfocusedTransparencyToSliderValue(unfocusedTransparency),
    );
  }
}

function updateAppearanceControls() {
  if (gradeBarBaseHeightInput) {
    gradeBarBaseHeightInput.value = String(gradeBarBaseHeight);
  }
  if (gradeBarMaxHeightInput) {
    gradeBarMaxHeightInput.value = String(gradeBarMaxHeight);
  }
  if (gradeBarWidthInput) {
    gradeBarWidthInput.value = String(gradeBarWidth);
  }
  if (gradeBarTransparencyInput) {
    gradeBarTransparencyInput.value = String(gradeBarTransparency);
  }
  if (hollowPointLineWidthSlider) {
    hollowPointLineWidthSlider.value = String(hollowPointLineWidth);
  }
  if (hollowPointLineWidthValue) {
    hollowPointLineWidthValue.textContent = `${hollowPointLineWidth}px`;
  }
}

const DEFAULT_CANVAS_ASPECT_RATIO = 1536 / 1024;
let canvasAspectRatio = DEFAULT_CANVAS_ASPECT_RATIO;

function computeCanvasDimensions() {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const aspectRatio = Number.isFinite(canvasAspectRatio) && canvasAspectRatio > 0
    ? canvasAspectRatio
    : DEFAULT_CANVAS_ASPECT_RATIO;
  const enableScroll = viewportWidth <= 768 && viewportHeight > viewportWidth;

  if (enableScroll) {
    const height = viewportHeight;
    const width = Math.max(viewportWidth, Math.round(height * aspectRatio));
    return { width, height, enableScroll };
  }

  return {
    width: viewportWidth,
    height: viewportHeight,
    enableScroll: false,
  };
}

function resizeCanvas() {
  const previousWidth = canvas.width || 0;
  const previousHeight = canvas.height || 0;
  const { width, height, enableScroll } = computeCanvasDimensions();

  if (canvasContainer) {
    canvasContainer.classList.toggle('scrollable', enableScroll);
  }

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (canvasContainer) {
    if (enableScroll) {
      const maxScrollLeft = Math.max(0, width - window.innerWidth);
      if (!isCanvasScrollable) {
        canvasContainer.scrollLeft = Math.max(0, maxScrollLeft / 2);
      } else if (canvasContainer.scrollLeft > maxScrollLeft) {
        canvasContainer.scrollLeft = maxScrollLeft;
      }
    } else if (isCanvasScrollable) {
      canvasContainer.scrollLeft = 0;
    }
  }

  const safePreviousWidth = previousWidth || width;
  const safePreviousHeight = previousHeight || height;

  if (loadedNormalizedPoints) {
    points.length = 0;
    loadedNormalizedPoints.forEach(({ x, y }) => {
      if (Number.isFinite(x) && Number.isFinite(y)) {
        points.push({ x: x * canvas.width, y: y * canvas.height });
      }
    });
  } else if (points.length && safePreviousWidth && safePreviousHeight) {
    const scaledPoints = points.map(({ x, y }) => ({
      x: (x / safePreviousWidth) * canvas.width,
      y: (y / safePreviousHeight) * canvas.height,
    }));
    points.length = 0;
    points.push(...scaledPoints);
  }

  isCanvasScrollable = enableScroll;
  redraw();
}

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (backgroundReady && backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  queuedGradeBarOverlays = [];
  drawExistingRoutesOverlay();
  drawStoredPathPreviews();
  const activePointDiameter = getStatePointDiameterForPathType(pathType);
  drawRouteFromCanvasPoints(
    points,
    strokeColor,
    1,
    pathType,
    activePointDiameter,
    rectangleWidth,
    rectangleHeight,
    brezerStrokeWidth,
    hollowPointLineWidth,
  );
  if (points.length) {
    queueGradeBarOverlay({
      routePoints: points,
      color: strokeColor,
      alpha: 1,
      numericGrade: currentRouteNumericGrade,
      baseHeight: gradeBarBaseHeight,
      maxHeight: gradeBarMaxHeight,
      width: gradeBarWidth,
      transparency: gradeBarTransparency,
      isAscended: false,
    });
  }
  renderQueuedGradeBarOverlays();
}

function drawStoredPathPreviews() {
  if (!(normalizedPointsByPathType instanceof Map) || !normalizedPointsByPathType.size) {
    return;
  }

  const activeType = normalizePathType(pathType);
  normalizedPointsByPathType.forEach((value, type) => {
    const normalizedType = normalizePathType(type);
    if (!normalizedType || normalizedType === activeType) {
      return;
    }

    const normalizedPoints = sanitizeNormalizedPointsArray(value);
    if (!Array.isArray(normalizedPoints) || !normalizedPoints.length) {
      return;
    }

    normalizedPointsByPathType.set(normalizedType, normalizedPoints);

    const canvasPoints = convertNormalizedToCanvasPoints(normalizedPoints);
    if (!Array.isArray(canvasPoints) || !canvasPoints.length) {
      return;
    }

    const previewPointDiameter = getStatePointDiameterForPathType(normalizedType);
    drawRouteFromCanvasPoints(
      canvasPoints,
      strokeColor,
      0.7,
      normalizedType,
      previewPointDiameter,
      rectangleWidth,
      rectangleHeight,
      brezerStrokeWidth,
      hollowPointLineWidth,
    );
  });
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function calculateAverageXFromCanvasPoints(routePoints = []) {
  if (!Array.isArray(routePoints) || !routePoints.length) {
    return null;
  }

  const valid = routePoints
    .map((point) => Number(point?.x))
    .filter((x) => Number.isFinite(x));

  if (!valid.length) {
    return null;
  }

  const sum = valid.reduce((total, x) => total + x, 0);
  return sum / valid.length;
}

function queueGradeBarOverlay() {
  queuedGradeBarOverlays = [];
}

function renderQueuedGradeBarOverlays() {
  queuedGradeBarOverlays = [];
}

function drawRouteFromCanvasPoints(
  routePoints = [],
  color = '#ffde59',
  alpha = 1,
  routePathType = DEFAULT_PATH_TYPE,
  routePointDiameter = DEFAULT_POINT_DIAMETER,
  routeRectangleWidth = DEFAULT_RECTANGLE_WIDTH,
  routeRectangleHeight = DEFAULT_RECTANGLE_HEIGHT,
  routeBrezerStrokeWidth = DEFAULT_BREZER_STROKE_WIDTH,
  routeHollowPointLineWidth = DEFAULT_HOLLOW_POINT_LINE_WIDTH,
) {
  if (!Array.isArray(routePoints) || !routePoints.length) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  const effectivePathType = normalizePathType(routePathType);
  const effectivePointDiameter = normalizePointDiameter(
    routePointDiameter,
    getDefaultPointDiameterForPathType(effectivePathType),
  );
  const effectiveRectangleWidth = normalizeRectangleSize(
    routeRectangleWidth,
    DEFAULT_RECTANGLE_WIDTH,
  );
  const effectiveRectangleHeight = normalizeRectangleSize(
    routeRectangleHeight,
    DEFAULT_RECTANGLE_HEIGHT,
  );

  if (effectivePathType === PATH_TYPE_BREZER) {
    const strokeWidth = normalizeBrezerStrokeWidth(routeBrezerStrokeWidth);
    if (routePoints.length >= 2) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(routePoints[0].x, routePoints[0].y);

      for (let i = 0; i < routePoints.length - 1; i++) {
        const p0 = i === 0 ? routePoints[0] : routePoints[i - 1];
        const p1 = routePoints[i];
        const p2 = routePoints[i + 1];
        const p3 = i + 2 < routePoints.length ? routePoints[i + 2] : routePoints[i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      ctx.stroke();
    }

    const anchorRadius = Math.max(2, Math.round(Math.max(strokeWidth, 2) / 3));
    ctx.fillStyle = color;
    routePoints.forEach((point) => {
      if (!point) {
        return;
      }
      ctx.beginPath();
      ctx.arc(point.x, point.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
    return;
  }

  if (effectivePathType === PATH_TYPE_HOLLOW_POINT) {
    const radius = Math.max(1, effectivePointDiameter / 2);
    const strokeWidth = normalizeHollowPointLineWidth(
      routeHollowPointLineWidth,
      effectivePointDiameter,
    );
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = color;
    routePoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (effectivePathType === PATH_TYPE_FILLED_POINT) {
    const radius = Math.max(1, effectivePointDiameter / 2);
    ctx.fillStyle = color;
    routePoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (effectivePathType === PATH_TYPE_RECTANGLE) {
    const halfWidth = Math.max(1, effectiveRectangleWidth / 2);
    const halfHeight = Math.max(1, effectiveRectangleHeight / 2);
    const strokeWidth = Math.max(
      2,
      Math.round(Math.max(effectiveRectangleWidth, effectiveRectangleHeight) / 10),
    );
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = color;
    routePoints.forEach((point) => {
      ctx.strokeRect(
        point.x - halfWidth,
        point.y - halfHeight,
        effectiveRectangleWidth,
        effectiveRectangleHeight,
      );
    });
  } else {
    ctx.fillStyle = color;
    routePoints.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1, effectivePointDiameter / 2), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ctx.restore();
}

function createNormalizedPointKey(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const clampedX = Math.min(Math.max(x, 0), 1);
  const clampedY = Math.min(Math.max(y, 0), 1);
  const scaledX = Math.round(clampedX * 10000);
  const scaledY = Math.round(clampedY * 10000);
  return `${scaledX}:${scaledY}`;
}

function buildNormalizedPointKeySetFromCanvasPoints(canvasPoints = []) {
  const keys = new Set();
  if (!Array.isArray(canvasPoints) || !canvasPoints.length || !canvas.width || !canvas.height) {
    return keys;
  }

  const width = canvas.width;
  const height = canvas.height;

  canvasPoints.forEach((point) => {
    if (!point) {
      return;
    }

    const normalizedX = Number(point.x) / width;
    const normalizedY = Number(point.y) / height;
    const key = createNormalizedPointKey(normalizedX, normalizedY);
    if (key) {
      keys.add(key);
    }
  });

  return keys;
}

function convertNormalizedToCanvasPoints(normalizedPoints = []) {
  if (!Array.isArray(normalizedPoints) || !canvas.width || !canvas.height) {
    return [];
  }

  return normalizedPoints
    .map((point) => {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { x: x * canvas.width, y: y * canvas.height };
      }
      return null;
    })
    .filter(Boolean);
}

function getOverlapGroupPathType(pathTypeValue) {
  const normalized = normalizePathType(pathTypeValue);
  if (normalized === PATH_TYPE_HOLLOW_POINT || normalized === PATH_TYPE_FILLED_POINT) {
    return OVERLAP_GROUP_TYPE_POINT;
  }
  return normalized;
}

function createOverlapGroupKey(pathTypeValue, pointKey) {
  if (!pathTypeValue || !pointKey) {
    return null;
  }

  const normalizedPathType = getOverlapGroupPathType(pathTypeValue);
  if (!normalizedPathType) {
    return null;
  }

  return `${normalizedPathType}::${pointKey}`;
}

function buildOverlayOverlapGroups(routeEntries = []) {
  const groups = new Map();

  routeEntries.forEach((entry) => {
    if (!entry) {
      return;
    }

    const { pathType: pathTypeValue, normalizedPoints } = entry;
    const normalizedPathType = normalizePathType(pathTypeValue);
    if (
      (!isNormalizedPointPathType(normalizedPathType) && normalizedPathType !== PATH_TYPE_RECTANGLE) ||
      !Array.isArray(normalizedPoints) ||
      !normalizedPoints.length
    ) {
      return;
    }

    normalizedPoints.forEach((point) => {
      const normalizedX = Number(point?.x);
      const normalizedY = Number(point?.y);
      const key = createNormalizedPointKey(normalizedX, normalizedY);
      if (!key) {
        return;
      }

      const groupKey = createOverlapGroupKey(normalizedPathType, key);
      if (!groupKey) {
        return;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          pathType: normalizedPathType,
          entries: [],
        });
      }

      const group = groups.get(groupKey);
      group.entries.push({
        routeId: entry.id,
        color: entry.color,
        pathType: normalizedPathType,
        pointDiameter: entry.pointDiameter,
        rectangleWidth: entry.rectangleWidth,
        rectangleHeight: entry.rectangleHeight,
        alpha: entry.alpha,
        hollowPointLineWidth: entry.hollowPointLineWidth,
      });
    });
  });

  for (const [key, group] of groups) {
    if (!group || !Array.isArray(group.entries) || group.entries.length <= 1) {
      groups.delete(key);
    }
  }

  return groups;
}

function drawOverlayPointGroup(center, entries) {
  if (!center || !Array.isArray(entries) || entries.length <= 1) {
    return;
  }

  const total = entries.length;
  const radii = entries.map((entry) => Math.max(1, Number(entry.pointDiameter) / 2));
  const radius = Math.max(...radii, 4);
  const strokeWidths = entries.map((entry) => {
    if (!entry) {
      return MIN_HOLLOW_POINT_LINE_WIDTH;
    }

    const fallbackDiameter =
      entry.pathType === PATH_TYPE_FILLED_POINT
        ? DEFAULT_FILLED_POINT_DIAMETER
        : DEFAULT_HOLLOW_POINT_DIAMETER;
    const diameter = normalizePointDiameter(entry.pointDiameter, fallbackDiameter);

    if (
      (entry.pathType === PATH_TYPE_HOLLOW_POINT || entry.pathType === PATH_TYPE_FILLED_POINT) &&
      entry.hollowPointLineWidth !== undefined
    ) {
      return normalizeHollowPointLineWidth(entry.hollowPointLineWidth, diameter);
    }

    return Math.max(2, Math.round(diameter / 10) || 2);
  });
  const maxStrokeWidth = strokeWidths.length ? Math.max(...strokeWidths) : 2;
  const fillRadius = Math.max(1, radius - maxStrokeWidth * 0.6);
  const step = (Math.PI * 2) / total;
  const startAngle = -Math.PI / 2;

  ctx.save();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  entries.forEach((entry, index) => {
    if (entry?.pathType !== PATH_TYPE_FILLED_POINT) {
      return;
    }

    const angleStart = startAngle + step * index;
    const angleEnd = angleStart + step;
    const entryAlpha = Number.isFinite(entry.alpha) ? entry.alpha : 1;
    const fillColor = entry.color || '#ffde59';

    ctx.globalAlpha = entryAlpha;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, fillRadius, angleStart, angleEnd);
    ctx.closePath();
    ctx.fill();
  });

  entries.forEach((entry, index) => {
    const strokeWidth = strokeWidths[index] ?? Math.max(2, Math.round(Number(entry.pointDiameter) / 10) || 2);
    const angleStart = startAngle + step * index;
    const angleEnd = angleStart + step;

    ctx.globalAlpha = Number.isFinite(entry.alpha) ? entry.alpha : 1;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = entry.color || '#ffde59';
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, angleStart, angleEnd);
    ctx.stroke();
  });

  ctx.restore();
}

function drawOverlayRectangleGroup(center, width, height, entries) {
  if (!center || !Array.isArray(entries) || entries.length <= 1) {
    return;
  }

  const normalizedWidth = Math.max(...entries.map((entry) => Number(entry.rectangleWidth) || 0), width);
  const normalizedHeight = Math.max(
    ...entries.map((entry) => Number(entry.rectangleHeight) || 0),
    height,
  );
  const finalWidth = Math.max(1, normalizedWidth);
  const finalHeight = Math.max(1, normalizedHeight);
  const halfWidth = finalWidth / 2;
  const halfHeight = finalHeight / 2;
  const perimeter = 2 * (finalWidth + finalHeight);

  if (!Number.isFinite(perimeter) || perimeter <= 0) {
    return;
  }

  const segmentLength = perimeter / entries.length;
  const edges = [
    { length: finalWidth, startX: center.x - halfWidth, startY: center.y - halfHeight, dx: 1, dy: 0 },
    { length: finalHeight, startX: center.x + halfWidth, startY: center.y - halfHeight, dx: 0, dy: 1 },
    { length: finalWidth, startX: center.x + halfWidth, startY: center.y + halfHeight, dx: -1, dy: 0 },
    { length: finalHeight, startX: center.x - halfWidth, startY: center.y + halfHeight, dx: 0, dy: -1 },
  ];
  const edgeCount = edges.length;

  let offset = 0;

  entries.forEach((entry) => {
    let localOffset = offset % perimeter;
    if (localOffset < 0) {
      localOffset += perimeter;
    }

    let edgeIndex = 0;
    while (localOffset >= edges[edgeIndex].length && edgeIndex < edgeCount - 1) {
      localOffset -= edges[edgeIndex].length;
      edgeIndex += 1;
    }

    let currentX = edges[edgeIndex].startX + edges[edgeIndex].dx * localOffset;
    let currentY = edges[edgeIndex].startY + edges[edgeIndex].dy * localOffset;
    let remaining = segmentLength;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = Math.max(
      2,
      Math.round(
        Math.max(Number(entry.rectangleWidth) || 0, Number(entry.rectangleHeight) || 0) / 10,
      ) || 2,
    );
    ctx.strokeStyle = entry.color || '#ffde59';
    ctx.globalAlpha = Number.isFinite(entry.alpha) ? entry.alpha : 1;

    while (remaining > 0) {
      const edge = edges[edgeIndex];
      const available = edge.length - localOffset;
      const step = Math.min(remaining, available);
      const nextOffset = localOffset + step;
      const nextX = edge.startX + edge.dx * nextOffset;
      const nextY = edge.startY + edge.dy * nextOffset;

      ctx.beginPath();
      ctx.moveTo(currentX, currentY);
      ctx.lineTo(nextX, nextY);
      ctx.stroke();

      remaining -= step;
      currentX = nextX;
      currentY = nextY;
      localOffset = 0;
      edgeIndex = (edgeIndex + 1) % edgeCount;
    }

    ctx.restore();

    offset += segmentLength;
    if (offset >= perimeter) {
      offset -= perimeter;
    }
  });
}

function drawExistingRoutesOverlay() {
  if (!routesCache.size) {
    overlayInteractionEntries = [];
    if (focusedRouteKey) {
      focusedRouteKey = '';
      resetLastFocusActivation();
    }
    return;
  }

  const activeLocationKey = getCurrentLocationKey();
  const wallSettings = getWallSettingsForLocation(activeLocationKey);
  const overlayAlpha = normalizeUnfocusedTransparency(wallSettings.unfocusedTransparency);
  const focusPointKeys = points.length
    ? buildNormalizedPointKeySetFromCanvasPoints(points)
    : null;

  if (focusedRouteKey && !routesCache.has(focusedRouteKey)) {
    focusedRouteKey = '';
  }

  overlayInteractionEntries = [];

  const overlayEntries = [];

  routesCache.forEach((data, key) => {
    if (!data || key === currentRouteKey) {
      return;
    }

    const routeLocationKey =
      typeof data?.locationKey === 'string'
        ? data.locationKey
        : normalizeLocationName(data?.location);
    if (activeLocationKey && routeLocationKey !== activeLocationKey) {
      return;
    }

    const color = sanitizeColor(data.strokeColor);
    const normalizedRectangleWidth = normalizeRectangleSize(
      data.rectangleWidth,
      DEFAULT_RECTANGLE_WIDTH,
    );
    const normalizedRectangleHeight = normalizeRectangleSize(
      data.rectangleHeight,
      DEFAULT_RECTANGLE_HEIGHT,
    );
    const normalizedBrezerWidth = normalizeBrezerStrokeWidth(data.brezerStrokeWidth);
    const normalizedHollowPointLineWidth = getRouteHollowPointLineWidth(data);

    const pointEntries = collectRoutePointEntries(data);
    pointEntries.forEach(({ pathType: entryPathType, normalizedPoints }) => {
      if (!Array.isArray(normalizedPoints) || !normalizedPoints.length) {
        return;
      }

      const canvasPoints = convertNormalizedToCanvasPoints(normalizedPoints);
      if (!canvasPoints.length) {
        return;
      }

      const entryPointDiameter = getRoutePointDiameterForPathType(data, entryPathType);
      const numericGrade =
        typeof data.numericGrade === 'number' && Number.isFinite(data.numericGrade)
          ? data.numericGrade
          : resolveRouteNumericGrade(data.grade);

      overlayEntries.push({
        id: key,
        color,
        pathType: entryPathType,
        canvasPoints,
        normalizedPoints,
        pointDiameter: entryPointDiameter,
        brezerStrokeWidth: normalizedBrezerWidth,
        rectangleWidth: normalizedRectangleWidth,
        rectangleHeight: normalizedRectangleHeight,
        alpha: overlayAlpha,
        numericGrade,
        gradeBarBaseHeight: data.gradeBarBaseHeight,
        gradeBarMaxHeight: data.gradeBarMaxHeight,
        gradeBarWidth: data.gradeBarWidth,
        gradeBarTransparency: data.gradeBarTransparency,
        hollowPointLineWidth: normalizedHollowPointLineWidth,
      });
    });
  });

  if (!overlayEntries.length) {
    return;
  }

  const overlapGroups = buildOverlayOverlapGroups(overlayEntries);
  const handledOverlapKeys = new Set();

  overlayEntries.forEach((entry) => {
      const {
        color,
        pathType: routePathType,
        canvasPoints,
        normalizedPoints,
        pointDiameter: entryPointDiameter,
        rectangleWidth: entryRectangleWidth,
        rectangleHeight: entryRectangleHeight,
        alpha,
        numericGrade,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
      } = entry;

    const supportsPattern =
      isNormalizedPointPathType(routePathType) || routePathType === PATH_TYPE_RECTANGLE;
    const visiblePoints = [];
    const isFocused = !focusedRouteKey || entry.id === focusedRouteKey;
    const routeAlpha = isFocused ? 1 : alpha;

    if (Array.isArray(canvasPoints) && canvasPoints.length) {
      if (isNormalizedPointPathType(routePathType)) {
        const radius = Math.max(6, entryPointDiameter / 2);
        canvasPoints.forEach((point) => {
          if (!point) {
            return;
          }
          overlayInteractionEntries.push({
            type: 'circle',
            cx: point.x,
            cy: point.y,
            radius,
            routeKey: entry.id,
          });
        });
      } else if (routePathType === PATH_TYPE_RECTANGLE) {
        const halfWidth = Math.max(4, entryRectangleWidth / 2);
        const halfHeight = Math.max(4, entryRectangleHeight / 2);
        canvasPoints.forEach((point) => {
          if (!point) {
            return;
          }
          overlayInteractionEntries.push({
            type: 'rect',
            left: point.x - halfWidth,
            right: point.x + halfWidth,
            top: point.y - halfHeight,
            bottom: point.y + halfHeight,
            routeKey: entry.id,
          });
        });
      } else if (routePathType === PATH_TYPE_BREZER && canvasPoints.length >= 2) {
        const strokeWidth = normalizeBrezerStrokeWidth(entry.brezerStrokeWidth);
        const padding = Math.max(10, strokeWidth / 2);
        for (let i = 0; i < canvasPoints.length - 1; i += 1) {
          const start = canvasPoints[i];
          const end = canvasPoints[i + 1];
          if (!start || !end) {
            continue;
          }
          overlayInteractionEntries.push({
            type: 'segment',
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            padding,
            routeKey: entry.id,
          });
        }
        canvasPoints.forEach((point) => {
          if (!point) {
            return;
          }
          overlayInteractionEntries.push({
            type: 'circle',
            cx: point.x,
            cy: point.y,
            radius: Math.max(6, strokeWidth / 2),
            routeKey: entry.id,
          });
        });
      }
    }

    canvasPoints.forEach((point, index) => {
      const normalized = Array.isArray(normalizedPoints) ? normalizedPoints[index] : null;
      const normalizedX = Number(normalized?.x);
      const normalizedY = Number(normalized?.y);
      const pointKey =
        supportsPattern && Number.isFinite(normalizedX) && Number.isFinite(normalizedY)
          ? createNormalizedPointKey(normalizedX, normalizedY)
          : null;

      if (
        supportsPattern &&
        focusPointKeys &&
        focusPointKeys.size > 0 &&
        pointKey &&
        focusPointKeys.has(pointKey)
      ) {
        return;
      }

      const overlapKey =
        pointKey && overlapGroups ? createOverlapGroupKey(routePathType, pointKey) : null;
      const overlapGroup =
        overlapKey && overlapGroups ? overlapGroups.get(overlapKey) : null;

      if (
        overlapGroup &&
        Array.isArray(overlapGroup.entries) &&
        overlapGroup.entries.length > 1 &&
        !focusPointKeys
      ) {
        if (handledOverlapKeys.has(overlapKey)) {
          return;
        }

        handledOverlapKeys.add(overlapKey);

        if (isNormalizedPointPathType(routePathType)) {
          drawOverlayPointGroup(point, overlapGroup.entries);
        } else if (routePathType === PATH_TYPE_RECTANGLE) {
          drawOverlayRectangleGroup(point, entryRectangleWidth, entryRectangleHeight, overlapGroup.entries);
        }
        return;
      }

      visiblePoints.push(point);
    });

    if (visiblePoints.length) {
      drawRouteFromCanvasPoints(
        visiblePoints,
        color,
        routeAlpha,
        routePathType,
        entryPointDiameter,
        entryRectangleWidth,
        entryRectangleHeight,
        entry.brezerStrokeWidth,
        entry.hollowPointLineWidth,
      );
    }

    queueGradeBarOverlay({
      routePoints: canvasPoints,
      color,
      alpha: routeAlpha,
      numericGrade,
      baseHeight: gradeBarBaseHeight,
      maxHeight: gradeBarMaxHeight,
      width: gradeBarWidth,
      transparency: gradeBarTransparency,
      isAscended: false,
    });
  });
}

function setCanvasPointsFromNormalized(normalizedPoints = []) {
  const target = Array.isArray(normalizedPoints)
    ? normalizedPoints.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    : [];

  const filtered = target.filter(
    ({ x, y }) => Number.isFinite(x) && Number.isFinite(y),
  );

  loadedNormalizedPoints = filtered;
  points.length = 0;
  filtered.forEach(({ x, y }) => {
    points.push({ x: x * canvas.width, y: y * canvas.height });
  });
  redraw();
}

function loadPointsForActivePathType() {
  const activeType = normalizePathType(pathType);
  const normalized = normalizedPointsByPathType.get(activeType) || [];
  const sanitized = sanitizeNormalizedPointsArray(normalized);
  normalizedPointsByPathType.set(activeType, sanitized);
  setCanvasPointsFromNormalized(sanitized);
}

function flushActivePointsToNormalized() {
  const activeType = normalizePathType(pathType);
  if (!activeType) {
    return [];
  }

  const normalized = convertPointsToNormalized();
  normalizedPointsByPathType.set(activeType, normalized);
  loadedNormalizedPoints = normalized;
  return normalized;
}

function synchroniseNormalizedPoints(pointsByType, activeType) {
  const normalizedActiveType = normalizePathType(activeType) || DEFAULT_PATH_TYPE;
  normalizedPointsByPathType.clear();

  const register = (type, value) => {
    const normalizedType = normalizePathType(type);
    if (!normalizedType) {
      return;
    }
    normalizedPointsByPathType.set(
      normalizedType,
      sanitizeNormalizedPointsArray(value),
    );
  };

  if (pointsByType instanceof Map) {
    pointsByType.forEach((value, key) => {
      register(key, value);
    });
  } else if (
    pointsByType &&
    typeof pointsByType === 'object' &&
    !Array.isArray(pointsByType)
  ) {
    Object.entries(pointsByType).forEach(([key, value]) => {
      register(key, value);
    });
  } else if (Array.isArray(pointsByType)) {
    register(normalizedActiveType, pointsByType);
  }

  if (!normalizedPointsByPathType.has(normalizedActiveType)) {
    normalizedPointsByPathType.set(normalizedActiveType, []);
  }

  loadPointsForActivePathType();
}

function convertPointsToNormalized() {
  if (!canvas.width || !canvas.height) {
    return [];
  }

  return points.map(({ x, y }) => ({
    x: Number((x / canvas.width).toFixed(6)),
    y: Number((y / canvas.height).toFixed(6)),
  }));
}

function getPointDetectionRadius(diameter) {
  const normalizedDiameter = normalizePointDiameter(diameter);
  return Math.max(6, normalizedDiameter / 2);
}

function getRectangleDetectionRadius(width, height) {
  const normalizedWidth = normalizeRectangleSize(width, DEFAULT_RECTANGLE_WIDTH);
  const normalizedHeight = normalizeRectangleSize(height, DEFAULT_RECTANGLE_HEIGHT);
  const halfWidth = Math.max(1, normalizedWidth / 2);
  const halfHeight = Math.max(1, normalizedHeight / 2);
  const diagonal = Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight);
  return Math.max(6, diagonal);
}

function findPointIndexNear(x, y, targetPoints = [], radius = 0) {
  if (!Array.isArray(targetPoints) || !targetPoints.length || radius <= 0) {
    return -1;
  }

  const radiusSq = radius * radius;
  for (let index = 0; index < targetPoints.length; index += 1) {
    const point = targetPoints[index];
    if (!point) {
      continue;
    }

    const dx = point.x - x;
    const dy = point.y - y;
    if (dx * dx + dy * dy <= radiusSq) {
      return index;
    }
  }

  return -1;
}

function findSharedPointNear(x, y) {
  if (!routesCache.size) {
    return null;
  }

  const activePathType = normalizePathType(pathType);
  if (!isNormalizedPointPathType(activePathType) && activePathType !== PATH_TYPE_RECTANGLE) {
    return null;
  }

  const activeLocationKey = getCurrentLocationKey();
  let closestPoint = null;
  let closestDistanceSq = Number.POSITIVE_INFINITY;
  const activeDetectionRadius =
    activePathType === PATH_TYPE_RECTANGLE
      ? getRectangleDetectionRadius(rectangleWidth, rectangleHeight)
      : getPointDetectionRadius(getStatePointDiameterForPathType(activePathType));

  routesCache.forEach((data, routeKey) => {
    if (!data || routeKey === currentRouteKey) {
      return;
    }

    const routeLocationKey = normalizeWallKey(
      typeof data?.locationKey === 'string'
        ? data.locationKey
        : normalizeLocationName(data?.location),
    );

    if (activeLocationKey && routeLocationKey !== activeLocationKey) {
      return;
    }

    if (normalizePathType(data.pathType) !== activePathType) {
      return;
    }

    let detectionRadius = activeDetectionRadius;

    if (isNormalizedPointPathType(activePathType)) {
      const routeDiameter = getRoutePointDiameterForPathType(data, activePathType);
      detectionRadius = Math.max(
        activeDetectionRadius,
        getPointDetectionRadius(routeDiameter),
      );
    } else {
      const routeWidth = normalizeRectangleSize(
        typeof data?.rectangleWidth === 'number' ? data.rectangleWidth : rectangleWidth,
        DEFAULT_RECTANGLE_WIDTH,
      );
      const routeHeight = normalizeRectangleSize(
        typeof data?.rectangleHeight === 'number' ? data.rectangleHeight : rectangleHeight,
        DEFAULT_RECTANGLE_HEIGHT,
      );
      detectionRadius = Math.max(
        activeDetectionRadius,
        getRectangleDetectionRadius(routeWidth, routeHeight),
      );
    }

    const detectionRadiusSq = detectionRadius * detectionRadius;
    const routePoints = convertNormalizedToCanvasPoints(data.points);

    routePoints.forEach((point) => {
      if (!point) {
        return;
      }

      const dx = point.x - x;
      const dy = point.y - y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq <= detectionRadiusSq && distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestPoint = { x: point.x, y: point.y };
      }
    });
  });

  if (!closestPoint) {
    return null;
  }

  const existingIndex = findPointIndexNear(closestPoint.x, closestPoint.y, points, activeDetectionRadius);
  if (existingIndex >= 0) {
    return null;
  }

  return closestPoint;
}

function addPoint(event) {
  if (shouldIgnoreNextClick) {
    shouldIgnoreNextClick = false;
    return;
  }

  if (!isDrawingEnabled) {
    void handlePotentialOverlayFocus(event);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const currentPathType = normalizePathType(pathType);
  if (currentPathType === PATH_TYPE_BREZER) {
    const removalIndex = findPointIndexNear(x, y, points, BREZER_REMOVAL_RADIUS);
    if (removalIndex >= 0) {
      points.splice(removalIndex, 1);
      loadedNormalizedPoints = null;
      redraw();
      markUnsavedChange();
      return;
    }
  }
  if (isNormalizedPointPathType(currentPathType) || currentPathType === PATH_TYPE_RECTANGLE) {
    const detectionRadius =
      currentPathType === PATH_TYPE_RECTANGLE
        ? getRectangleDetectionRadius(rectangleWidth, rectangleHeight)
        : getPointDetectionRadius(getStatePointDiameterForPathType(currentPathType));
    const existingIndex = findPointIndexNear(x, y, points, detectionRadius);
    if (existingIndex >= 0) {
      points.splice(existingIndex, 1);
      loadedNormalizedPoints = null;
      redraw();
      markUnsavedChange();
      return;
    }

    const sharedPoint = findSharedPointNear(x, y);
    if (sharedPoint) {
      points.push(sharedPoint);
      loadedNormalizedPoints = null;
      redraw();
      markUnsavedChange();
      return;
    }
  }

  points.push({ x, y });
  loadedNormalizedPoints = null;
  redraw();
  markUnsavedChange();
}

function clearCanvas() {
  const activeType = normalizePathType(pathType);
  if (!points.length && (!loadedNormalizedPoints || !loadedNormalizedPoints.length)) {
    return;
  }

  normalizedPointsByPathType.set(activeType, []);
  setCanvasPointsFromNormalized([]);
  markUnsavedChange();
}

function sanitizeColor(value) {
  if (typeof value === 'string' && /^#([0-9a-f]{6})$/i.test(value)) {
    return value;
  }
  return '#ffde59';
}

function applyRouteToCanvas(routeKey, rawData = {}) {
  const data = normalizeRouteData(rawData);

  const targetLocation = findLocationByName(data.location) || DEFAULT_LOCATION;
  setLocation(targetLocation, {
    persist: false,
    refreshRoutes: false,
    wallFallback: {
      pointDiameter: data.pointDiameter,
      hollowPointDiameter: data.hollowPointDiameter ?? data.pointDiameter,
      filledPointDiameter: data.filledPointDiameter ?? data.pointDiameter,
      rectangleWidth: data.rectangleWidth,
      rectangleHeight: data.rectangleHeight,
      brezerStrokeWidth: data.brezerStrokeWidth,
      gradeBarBaseHeight: data.gradeBarBaseHeight,
      gradeBarMaxHeight: data.gradeBarMaxHeight,
      gradeBarWidth: data.gradeBarWidth,
      transparency: data.gradeBarTransparency,
    },
  });

  const savedPathType = normalizePathType(data.pathType) || DEFAULT_PATH_TYPE;
  const nonEmptyPointEntries = collectRoutePointEntries(data);
  const hasSavedPathPoints = nonEmptyPointEntries.some(
    (entry) => entry.pathType === savedPathType,
  );
  const fallbackEntry = hasSavedPathPoints ? null : nonEmptyPointEntries[0] || null;
  pathType = fallbackEntry?.pathType || savedPathType;
  updatePathControls();

  currentRouteKey = routeKey;
  routeSelector.value = routeKey;
  routeSetterInput.value = data.setter || currentUsername || '';
  routeTitleInput.value = data.title;
  routeDescriptionInput.value = data.description;
  routeDateSetInput.value = isoStringToInputValue(data.date_set) || '';
  strokeColor = data.strokeColor;
  currentRouteGradeValue = normalizeRouteGradeField(data.grade);
  currentRouteNumericGrade = resolveRouteNumericGrade(
    currentRouteGradeValue !== null ? currentRouteGradeValue : data.numericGrade,
  );
  if (routeHiddenCheckbox) {
    const isHidden = data.hiddenFromClimbers === true;
    routeHiddenCheckbox.checked = isHidden;
    routeHiddenCheckbox.setAttribute('aria-checked', isHidden ? 'true' : 'false');
  }
  colorPicker.value = strokeColor;
  syncAdvancedColorPicker(strokeColor);
  synchroniseNormalizedPoints(data.pointsByType ?? data.points, pathType);
  const activeNormalizedPoints = sanitizeNormalizedPointsArray(
    normalizedPointsByPathType.get(pathType),
  );
  const cachedPointsByType = new Map();
  normalizedPointsByPathType.forEach((value, key) => {
    cachedPointsByType.set(key, sanitizeNormalizedPointsArray(value));
  });
  deleteButton.disabled = !routeKey;
  resetUnsavedState();

  if (routeKey) {
    const cachedRouteData = {
      ...data,
      pathType,
      points: activeNormalizedPoints,
      pointsByType: cachedPointsByType,
    };
    routesCache.set(routeKey, cachedRouteData);
    const label = cachedRouteData.title || routeKey;
    setStatus(`Loaded route “${label}”.`, 'success');
  }

  setFocusedRouteKey(routeKey, { resetActivation: true });
}

function prepareNewRoute(statusMessage = '') {
  currentRouteKey = '';
  clearRouteFocus();
  routeSelector.value = '';
  routeSetterInput.value = currentUsername || '';
  routeTitleInput.value = '';
  routeDescriptionInput.value = '';
  routeDateSetInput.value = getNowInputValue();
  if (routeHiddenCheckbox) {
    routeHiddenCheckbox.checked = false;
    routeHiddenCheckbox.setAttribute('aria-checked', 'false');
  }
  strokeColor = '#ffde59';
  colorPicker.value = strokeColor;
  syncAdvancedColorPicker(strokeColor);
  setDrawingEnabled(false);
  const wallSettings = getWallSettingsForLocation(getCurrentLocationKey());
  pathType = DEFAULT_PATH_TYPE;
  pointDiameter = wallSettings.hollowPointDiameter ?? wallSettings.pointDiameter;
  filledPointDiameter = wallSettings.filledPointDiameter ?? wallSettings.pointDiameter;
  hollowPointLineWidth = wallSettings.hollowPointLineWidth;
  rectangleWidth = wallSettings.rectangleWidth;
  rectangleHeight = wallSettings.rectangleHeight;
  brezerStrokeWidth = wallSettings.brezerStrokeWidth;
  unfocusedTransparency = wallSettings.unfocusedTransparency;
  gradeBarBaseHeight = wallSettings.gradeBarBaseHeight;
  gradeBarMaxHeight = wallSettings.gradeBarMaxHeight;
  gradeBarWidth = wallSettings.gradeBarWidth;
  gradeBarTransparency = wallSettings.gradeBarTransparency;
  currentRouteGradeValue = null;
  currentRouteNumericGrade = null;
  updatePathControls();
  updateAppearanceControls();
  normalizedPointsByPathType.clear();
  normalizedPointsByPathType.set(pathType, []);
  loadPointsForActivePathType();
  deleteButton.disabled = true;
  resetUnsavedState();
  if (statusMessage) {
    setStatus(statusMessage, 'info');
  } else {
    clearStatus();
  }
}

async function loadRouteByKey(routeKey) {
  if (typeof routeKey !== 'string' || !routeKey) {
    return false;
  }

  let data = routesCache.get(routeKey);
  if (!data) {
    try {
      const snap = await getDoc(doc(db, 'routes', routeKey));
      if (snap.exists()) {
        data = normalizeRouteData({ id: routeKey, ...snap.data() });
        routesCache.set(routeKey, data);
      }
    } catch (error) {
      console.error('Failed to fetch route:', error);
      setStatus('Unable to load the selected route.', 'error');
      return false;
    }
  }

  if (!data) {
    setStatus('Unable to load the selected route.', 'error');
    return false;
  }

  applyRouteToCanvas(routeKey, data);
  return true;
}

async function loadRoutesList(selectedRouteKey = '') {
  try {
    routeSelector.disabled = true;
    const currentLocationKey = getCurrentLocationKey();
    const previousSettings = getWallSettingsForLocation(currentLocationKey);
    await refreshWallSettingsCache();
    const resolvedSettings = getWallSettingsForLocation(currentLocationKey);
    const pathSettingsChanged =
      resolvedSettings.hollowPointDiameter !== previousSettings.hollowPointDiameter ||
      resolvedSettings.filledPointDiameter !== previousSettings.filledPointDiameter ||
      resolvedSettings.hollowPointLineWidth !== previousSettings.hollowPointLineWidth ||
      resolvedSettings.rectangleWidth !== previousSettings.rectangleWidth ||
      resolvedSettings.rectangleHeight !== previousSettings.rectangleHeight ||
      resolvedSettings.unfocusedTransparency !== previousSettings.unfocusedTransparency;

    if (pathSettingsChanged) {
      pointDiameter = resolvedSettings.hollowPointDiameter ?? resolvedSettings.pointDiameter;
      filledPointDiameter = resolvedSettings.filledPointDiameter ?? resolvedSettings.pointDiameter;
      hollowPointLineWidth = resolvedSettings.hollowPointLineWidth;
      rectangleWidth = resolvedSettings.rectangleWidth;
      rectangleHeight = resolvedSettings.rectangleHeight;
      unfocusedTransparency = resolvedSettings.unfocusedTransparency;
      updatePathControls();
    }

    const appearanceSettingsChanged =
      resolvedSettings.gradeBarBaseHeight !== previousSettings.gradeBarBaseHeight ||
      resolvedSettings.gradeBarMaxHeight !== previousSettings.gradeBarMaxHeight ||
      resolvedSettings.gradeBarWidth !== previousSettings.gradeBarWidth ||
      resolvedSettings.gradeBarTransparency !== previousSettings.gradeBarTransparency;

    if (appearanceSettingsChanged) {
      gradeBarBaseHeight = resolvedSettings.gradeBarBaseHeight;
      gradeBarMaxHeight = resolvedSettings.gradeBarMaxHeight;
      gradeBarWidth = resolvedSettings.gradeBarWidth;
      gradeBarTransparency = resolvedSettings.gradeBarTransparency;
      updateAppearanceControls();
    }

    const routesSnapshot = await getDocs(collection(db, 'routes'));
    routesCache.clear();
    routesSnapshot.forEach((docSnap) => {
      const data = docSnap.data() ?? {};
      const rawUid = typeof data.uid === 'string' ? data.uid.trim() : '';
      const routeUid = rawUid || docSnap.id;
      routesCache.set(routeUid, normalizeRouteData({ id: routeUid, uid: routeUid, ...data }));
    });

    updateRoutesForAllWalls();

    const sortedEntries = [...routesCache.entries()].sort((a, b) => {
      const labelA = (a[1]?.title || a[0]).toLowerCase();
      const labelB = (b[1]?.title || b[0]).toLowerCase();
      return labelA.localeCompare(labelB);
    });

    const activeLocationKey = getCurrentLocationKey();
    const filteredEntries = sortedEntries.filter(([_, data]) => {
      const routeLocationKey =
        typeof data?.locationKey === 'string'
          ? data.locationKey
          : normalizeLocationName(data?.location);
      if (!activeLocationKey) {
        return true;
      }
      return routeLocationKey === activeLocationKey;
    });

    routeSelector.innerHTML = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Create new route…';
    routeSelector.appendChild(defaultOption);

    filteredEntries.forEach(([id, data]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = data?.title || id;
      routeSelector.appendChild(option);
    });

    if (selectedRouteKey && filteredEntries.some(([id]) => id === selectedRouteKey)) {
      routeSelector.value = selectedRouteKey;
    } else {
      routeSelector.value = '';
    }
  } catch (error) {
    console.error('Failed to load routes:', error);
    setStatus('Failed to load routes. Please try again.', 'error');
    throw error;
  } finally {
    routeSelector.disabled = false;
    redraw();
  }
}

async function saveRoute() {
  if (isSaving) {
    return;
  }

  const previousRouteKey = currentRouteKey;
  setDrawingEnabled(false);

  if (points.length < 2) {
    setStatus('Add at least two points to define the route.', 'error');
    return;
  }

  flushActivePointsToNormalized();
  const pointsPayload = serialiseNormalizedPointsByType(
    normalizedPointsByPathType,
  );
  const setter = normalizeSetterName(routeSetterInput.value);
  routeSetterInput.value = setter;
  if (!setter) {
    setStatus('Setter name is required before saving.', 'error');
    routeSetterInput.focus();
    return;
  }

  if (!isValidSetterName(setter)) {
    setStatus('Setter name must use letters, numbers, underscores, or spaces.', 'error');
    routeSetterInput.focus();
    return;
  }

  const title = routeTitleInput.value.trim();
  routeTitleInput.value = title;
  if (!title) {
    setStatus('Route title is required before saving.', 'error');
    routeTitleInput.focus();
    return;
  }

  const conflictingKey = findConflictingRouteKey(title, previousRouteKey);
  if (conflictingKey && conflictingKey !== previousRouteKey) {
    setStatus('Another route already uses this title. Choose a different title.', 'error');
    routeTitleInput.focus();
    return;
  }
  const isExistingRoute = Boolean(previousRouteKey);
  const routeKey = isExistingRoute ? previousRouteKey : generateRouteUid();

  const description = routeDescriptionInput.value.trim();
  routeDescriptionInput.value = description;
  const dateSetIso = inputValueToIsoString(routeDateSetInput.value);
  if (!dateSetIso) {
    setStatus('Enter a valid set date for the route.', 'error');
    routeDateSetInput.focus();
    return;
  }

  const currentLocationKey = getCurrentLocationKey();
  const wallSettings = getWallSettingsForLocation(currentLocationKey);
  const normalizedPathType = normalizePathType(pathType);
  const normalizedHollowPointDiameter =
    wallSettings.hollowPointDiameter ?? wallSettings.pointDiameter;
  const normalizedFilledPointDiameter =
    wallSettings.filledPointDiameter ?? wallSettings.pointDiameter;
  const normalizedPointDiameter = normalizedHollowPointDiameter;
  const normalizedRectangleWidth = wallSettings.rectangleWidth;
  const normalizedRectangleHeight = wallSettings.rectangleHeight;
  const normalizedUnfocusedTransparency = wallSettings.unfocusedTransparency;
  const hiddenFromClimbers = routeHiddenCheckbox?.checked === true;
  pathType = normalizedPathType;
  pointDiameter = normalizedHollowPointDiameter;
  filledPointDiameter = normalizedFilledPointDiameter;
  rectangleWidth = normalizedRectangleWidth;
  rectangleHeight = normalizedRectangleHeight;
  unfocusedTransparency = normalizedUnfocusedTransparency;
  updatePathControls();

  const normalizedGradeField = normalizeRouteGradeField(currentRouteGradeValue);

  const payload = {
    uid: routeKey,
    setter,
    title,
    description: description || null,
    strokeColor,
    pathType: normalizedPathType,
    points: pointsPayload,
    date_set: dateSetIso,
    date_removed: deleteField(),
    location: currentLocation?.name || DEFAULT_LOCATION?.name || null,
    updatedAt: serverTimestamp(),
    hiddenFromClimbers: hiddenFromClimbers ? true : deleteField(),
  };

  if (normalizedGradeField !== null) {
    payload.grade = normalizedGradeField;
  }

  const routeRef = doc(db, 'routes', routeKey);

  try {
    isSaving = true;
    saveButton.disabled = true;
    routeSelector.disabled = true;
    deleteButton.disabled = true;
    setStatus('Saving route…', 'info');

      const existingSnap = await getDoc(routeRef);
      const existingData = existingSnap.data();
      let usersPayload = null;

      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
        usersPayload = {};
      } else if (!existingData?.users || typeof existingData.users !== 'object') {
        usersPayload = {};
      }

      if (usersPayload !== null) {
        payload.users = usersPayload;
      }

      await setDoc(routeRef, payload, { merge: true });

      currentRouteKey = routeKey;
      routesCache.set(
        routeKey,
        normalizeRouteData({
          id: routeKey,
          uid: routeKey,
          ...payload,
          users: usersPayload !== null ? usersPayload : existingData?.users,
          pointDiameter: normalizedPointDiameter,
          hollowPointDiameter: normalizedHollowPointDiameter,
          filledPointDiameter: normalizedFilledPointDiameter,
          brezerStrokeWidth: wallSettings.brezerStrokeWidth,
          rectangleWidth: normalizedRectangleWidth,
          rectangleHeight: normalizedRectangleHeight,
          grade:
            normalizedGradeField !== null
              ? normalizedGradeField
              : normalizeRouteGradeField(existingData?.grade),
        }),
      );

      resetUnsavedState();

      const label = title || routeKey;
      await loadRoutesList(routeKey);
      prepareNewRoute();
      setStatus(`Route “${label}” saved successfully.`, 'success');
  } catch (error) {
    console.error('Failed to save route:', error);
    setStatus(error.message || 'Failed to save route.', 'error');
  } finally {
    isSaving = false;
    saveButton.disabled = false;
    routeSelector.disabled = false;
    deleteButton.disabled = !currentRouteKey;
  }
}

async function deleteCurrentRoute() {
  const targetKey = currentRouteKey;
  if (!targetKey) {
    setStatus('Select a saved route to delete.', 'error');
    return;
  }

  const cachedRoute = routesCache.get(targetKey);
  const routeLabel = cachedRoute?.title || targetKey;
  const confirmed = window.confirm(`Delete route “${routeLabel}”? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  try {
    saveButton.disabled = true;
    deleteButton.disabled = true;
    routeSelector.disabled = true;
    setStatus('Deleting route…', 'info');

    await deleteDoc(doc(db, 'routes', targetKey));
    routesCache.delete(targetKey);

    await loadRoutesList();
    prepareNewRoute('Route deleted. You can create a new one.');
    setStatus(`Route “${routeLabel}” deleted.`, 'success');
  } catch (error) {
    console.error('Failed to delete route:', error);
    setStatus(error.message || 'Failed to delete route.', 'error');
    deleteButton.disabled = false;
  } finally {
    saveButton.disabled = false;
    routeSelector.disabled = false;
  }
}

[routeSetterInput, routeTitleInput, routeDescriptionInput].forEach((element) => {
  if (element) {
    element.addEventListener('input', markUnsavedChange);
  }
});

if (routeDateSetInput) {
  routeDateSetInput.addEventListener('change', markUnsavedChange);
  routeDateSetInput.addEventListener('input', markUnsavedChange);
}

if (routeHiddenCheckbox) {
  routeHiddenCheckbox.addEventListener('change', (event) => {
    const isHidden = event.target.checked === true;
    event.target.setAttribute('aria-checked', isHidden ? 'true' : 'false');
    markUnsavedChange();
  });
}

if (saveAppearanceButton) {
  saveAppearanceButton.addEventListener('click', async () => {
    const locationKey = getCurrentLocationKey();
    if (!locationKey) {
      setStatus('Select a wall before saving appearance.', 'error');
      return;
    }

    const nextHollowPointDiameter = normalizePointDiameter(
      hollowPointDiameterSlider?.value ?? pointDiameter,
      DEFAULT_HOLLOW_POINT_DIAMETER,
    );
    const nextFilledPointDiameter = normalizePointDiameter(
      filledPointDiameterSlider?.value ?? filledPointDiameter,
      DEFAULT_FILLED_POINT_DIAMETER,
    );
    const nextHollowPointLineWidth = normalizeHollowPointLineWidth(
      hollowPointLineWidthSlider?.value ?? hollowPointLineWidth,
      nextHollowPointDiameter,
    );
    const nextGradeBarBaseHeight = normalizeGradeBarHeight(
      gradeBarBaseHeightInput?.value,
      DEFAULT_GRADE_BAR_BASE_HEIGHT,
    );
    const nextGradeBarMaxHeight = Math.max(
      nextGradeBarBaseHeight,
      normalizeGradeBarHeight(gradeBarMaxHeightInput?.value, DEFAULT_GRADE_BAR_MAX_HEIGHT),
    );
    const nextGradeBarWidth = normalizeGradeBarWidth(
      gradeBarWidthInput?.value,
    );
    const nextGradeBarTransparency = normalizeGradeBarTransparency(
      gradeBarTransparencyInput?.value,
    );

    try {
      await persistWallSettings(locationKey, {
        pointDiameter: nextHollowPointDiameter,
        hollowPointDiameter: nextHollowPointDiameter,
        hollowPointLineWidth: nextHollowPointLineWidth,
        filledPointDiameter: nextFilledPointDiameter,
        brezerStrokeWidth,
        gradeBarBaseHeight: nextGradeBarBaseHeight,
        gradeBarMaxHeight: nextGradeBarMaxHeight,
        gradeBarWidth: nextGradeBarWidth,
        transparency: nextGradeBarTransparency,
      });
      pointDiameter = nextHollowPointDiameter;
      filledPointDiameter = nextFilledPointDiameter;
      hollowPointLineWidth = nextHollowPointLineWidth;
      setStatus('Appearance saved.', 'success');
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
      setStatus('Failed to save appearance. Please try again.', 'error');
    }
  });
}

canvas.addEventListener('click', addPoint);
window.addEventListener('resize', resizeCanvas);

clearButton.addEventListener('click', clearCanvas);
saveButton.addEventListener('click', saveRoute);
if (cancelRouteButton) {
  cancelRouteButton.addEventListener('click', () => {
    setDrawingEnabled(false);
  });
}
deleteButton.addEventListener('click', deleteCurrentRoute);
routeSelector.addEventListener('change', async (event) => {
  const selectedKey = event.target.value;
  if (!selectedKey) {
    setDrawingEnabled(false);
    prepareNewRoute('Creating a new route.');
    return;
  }

  routeSelector.disabled = true;
  try {
    const loaded = await loadRouteByKey(selectedKey);
    if (!loaded) {
      routeSelector.value = currentRouteKey || '';
    }
  } finally {
    routeSelector.disabled = false;
  }
});

colorPicker.addEventListener('input', (event) => {
  strokeColor = sanitizeColor(event.target.value || '#ffde59');
  loadedNormalizedPoints = null;
  redraw();
  markUnsavedChange();
  syncAdvancedColorPicker(strokeColor);
});

if (pathTypeSelect) {
  pathTypeSelect.addEventListener('change', (event) => {
    const selectedType = normalizePathType(event.target.value);
    if (pathType === selectedType) {
      updatePathControls();
      return;
    }

    flushActivePointsToNormalized();
    pathType = selectedType;
    updatePathControls();

    if (!normalizedPointsByPathType.has(pathType)) {
      normalizedPointsByPathType.set(pathType, []);
    }

    loadPointsForActivePathType();

    if (currentRouteKey && routesCache.has(currentRouteKey)) {
      const cached = routesCache.get(currentRouteKey);
      routesCache.set(currentRouteKey, {
        ...cached,
        pathType: selectedType,
        pointsByType: new Map(normalizedPointsByPathType),
      });
    }
    markUnsavedChange();
  });
}

if (hollowPointDiameterSlider) {
  hollowPointDiameterSlider.addEventListener('input', (event) => {
    const nextValue = normalizePointDiameter(
      event.target.value,
      DEFAULT_HOLLOW_POINT_DIAMETER,
    );
    if (pointDiameter === nextValue) {
      updatePathControls();
      updateAppearanceControls();
      return;
    }

    pointDiameter = nextValue;
    updatePathControls();
    updateAppearanceControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter: nextValue,
        hollowPointDiameter: nextValue,
        hollowPointLineWidth,
        filledPointDiameter,
        rectangleWidth,
        rectangleHeight,
        brezerStrokeWidth,
        unfocusedTransparency,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  hollowPointDiameterSlider.addEventListener('change', async (event) => {
    const nextValue = normalizePointDiameter(
      event.target.value,
      DEFAULT_HOLLOW_POINT_DIAMETER,
    );
    if (pointDiameter !== nextValue) {
      pointDiameter = nextValue;
      updatePathControls();
      updateAppearanceControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, {
          pointDiameter: nextValue,
          hollowPointDiameter: nextValue,
          hollowPointLineWidth,
        });
      } catch (error) {
        console.error('Failed to persist hollow point diameter:', error);
      }
    }
  });
}

if (hollowPointLineWidthSlider) {
  hollowPointLineWidthSlider.addEventListener('input', (event) => {
    const nextValue = normalizeHollowPointLineWidth(event.target.value, pointDiameter);
    if (hollowPointLineWidth === nextValue) {
      updateAppearanceControls();
      return;
    }

    hollowPointLineWidth = nextValue;
    updateAppearanceControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter,
        hollowPointDiameter: pointDiameter,
        hollowPointLineWidth: nextValue,
        filledPointDiameter,
        rectangleWidth,
        rectangleHeight,
        brezerStrokeWidth,
        unfocusedTransparency,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  hollowPointLineWidthSlider.addEventListener('change', async (event) => {
    const nextValue = normalizeHollowPointLineWidth(event.target.value, pointDiameter);
    if (hollowPointLineWidth !== nextValue) {
      hollowPointLineWidth = nextValue;
      updateAppearanceControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, { hollowPointLineWidth: nextValue });
      } catch (error) {
        console.error('Failed to persist hollow point outline thickness:', error);
      }
    }
  });
}

if (filledPointDiameterSlider) {
  filledPointDiameterSlider.addEventListener('input', (event) => {
    const nextValue = normalizePointDiameter(
      event.target.value,
      DEFAULT_FILLED_POINT_DIAMETER,
    );
    if (filledPointDiameter === nextValue) {
      updatePathControls();
      updateAppearanceControls();
      return;
    }

    filledPointDiameter = nextValue;
    updatePathControls();
    updateAppearanceControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter,
        hollowPointDiameter: pointDiameter,
        hollowPointLineWidth,
        filledPointDiameter: nextValue,
        rectangleWidth,
        rectangleHeight,
        brezerStrokeWidth,
        unfocusedTransparency,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  filledPointDiameterSlider.addEventListener('change', async (event) => {
    const nextValue = normalizePointDiameter(
      event.target.value,
      DEFAULT_FILLED_POINT_DIAMETER,
    );
    if (filledPointDiameter !== nextValue) {
      filledPointDiameter = nextValue;
      updatePathControls();
      updateAppearanceControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, { filledPointDiameter: nextValue });
      } catch (error) {
        console.error('Failed to persist filled point diameter:', error);
      }
    }
  });
}

if (rectangleWidthSlider) {
  rectangleWidthSlider.addEventListener('input', (event) => {
    const nextValue = normalizeRectangleSize(event.target.value, DEFAULT_RECTANGLE_WIDTH);
    if (rectangleWidth === nextValue) {
      updatePathControls();
      return;
    }

    rectangleWidth = nextValue;
    updatePathControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter,
        rectangleWidth: nextValue,
        rectangleHeight,
        brezerStrokeWidth,
        unfocusedTransparency,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
        hollowPointLineWidth,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  rectangleWidthSlider.addEventListener('change', async (event) => {
    const nextValue = normalizeRectangleSize(event.target.value, DEFAULT_RECTANGLE_WIDTH);
    if (rectangleWidth !== nextValue) {
      rectangleWidth = nextValue;
      updatePathControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, { rectangleWidth: nextValue });
      } catch (error) {
        console.error('Failed to persist rectangle width:', error);
      }
    }
  });
}

if (rectangleHeightSlider) {
  rectangleHeightSlider.addEventListener('input', (event) => {
    const nextValue = normalizeRectangleSize(event.target.value, DEFAULT_RECTANGLE_HEIGHT);
    if (rectangleHeight === nextValue) {
      updatePathControls();
      return;
    }

    rectangleHeight = nextValue;
    updatePathControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter,
        rectangleWidth,
        rectangleHeight: nextValue,
        brezerStrokeWidth,
        unfocusedTransparency,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
        hollowPointLineWidth,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  rectangleHeightSlider.addEventListener('change', async (event) => {
    const nextValue = normalizeRectangleSize(event.target.value, DEFAULT_RECTANGLE_HEIGHT);
    if (rectangleHeight !== nextValue) {
      rectangleHeight = nextValue;
      updatePathControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, { rectangleHeight: nextValue });
      } catch (error) {
        console.error('Failed to persist rectangle height:', error);
      }
    }
  });
}

if (brezerStrokeWidthSlider) {
  brezerStrokeWidthSlider.addEventListener('input', (event) => {
    const nextValue = normalizeBrezerStrokeWidth(event.target.value);
    if (brezerStrokeWidth === nextValue) {
      updatePathControls();
      return;
    }

    brezerStrokeWidth = nextValue;
    updatePathControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter,
        rectangleWidth,
        rectangleHeight,
        brezerStrokeWidth: nextValue,
        unfocusedTransparency,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
        hollowPointLineWidth,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  brezerStrokeWidthSlider.addEventListener('change', async (event) => {
    const nextValue = normalizeBrezerStrokeWidth(event.target.value);
    if (brezerStrokeWidth !== nextValue) {
      brezerStrokeWidth = nextValue;
      updatePathControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, { brezerStrokeWidth: nextValue });
      } catch (error) {
        console.error('Failed to persist Brezer stroke width:', error);
      }
    }
  });
}

if (unfocusedTransparencySlider) {
  unfocusedTransparencySlider.addEventListener('input', (event) => {
    const nextValue = sliderValueToUnfocusedTransparency(event.target.value);
    if (unfocusedTransparency === nextValue) {
      updatePathControls();
      return;
    }

    unfocusedTransparency = nextValue;
    updatePathControls();

    const locationKey = getCurrentLocationKey();
    const normalizedKey = normalizeWallKey(locationKey);
    if (normalizedKey) {
      const previewSettings = normalizeWallSettings({
        pointDiameter,
        rectangleWidth,
        rectangleHeight,
        brezerStrokeWidth,
        unfocusedTransparency: nextValue,
        gradeBarBaseHeight,
        gradeBarMaxHeight,
        gradeBarWidth,
        gradeBarTransparency,
        hollowPointLineWidth,
      });
      wallSettingsCache.set(normalizedKey, previewSettings);
      updateRoutesForWall(normalizedKey, previewSettings);
    }

    redraw();
  });

  unfocusedTransparencySlider.addEventListener('change', async (event) => {
    const nextValue = sliderValueToUnfocusedTransparency(event.target.value);
    if (unfocusedTransparency !== nextValue) {
      unfocusedTransparency = nextValue;
      updatePathControls();
    }

    const locationKey = getCurrentLocationKey();
    if (locationKey) {
      try {
        await persistWallSettings(locationKey, { unfocusedTransparency: nextValue });
      } catch (error) {
        console.error('Failed to persist unfocused transparency:', error);
      }
    }
  });
}

if (createWallButton) {
  createWallButton.addEventListener('click', () => {
    void handleCreateWall();
  });
}

if (deleteWallButton) {
  deleteWallButton.addEventListener('click', () => {
    void handleDeleteWall();
  });
}

[newWallNameInput, newWallImageInput].forEach((input) => {
  if (!input) {
    return;
  }
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void handleCreateWall();
    }
  });
});

if (backgroundImage.complete) {
  backgroundReady = true;
  if (backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0) {
    const ratio = backgroundImage.naturalWidth / backgroundImage.naturalHeight;
    if (Number.isFinite(ratio) && ratio > 0) {
      canvasAspectRatio = ratio;
    }
  }
  resizeCanvas();
} else {
  resizeCanvas();
}

let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  const isLogin = authMode === 'login';
  authTitle.textContent = isLogin ? 'Sign in to continue' : 'Create your account';
  authSwitchLabel.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
  toggleAuthModeButton.textContent = isLogin ? 'Create one' : 'Sign in';
  authForm.querySelector('.auth-submit').textContent = isLogin ? 'Sign In' : 'Create Account';
  authPassword.setAttribute('autocomplete', isLogin ? 'current-password' : 'new-password');
  authError.textContent = '';
}

toggleAuthModeButton.addEventListener('click', () => {
  setAuthMode(authMode === 'login' ? 'register' : 'login');
});

async function lookupUsernameByUid(uid) {
  if (!uid) {
    return '';
  }

  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return '';
    }

    const data = userSnap.data() || {};
    return normalizeUsername(typeof data.username === 'string' ? data.username : '');
  } catch (error) {
    console.error('Failed to look up username by UID:', error);
    return '';
  }
}

async function resolveUsernameForUser(user) {
  if (!user) {
    return '';
  }

  const displayName = normalizeUsername(user.displayName);
  if (isValidUsername(displayName)) {
    return displayName;
  }

  const mapped = await lookupUsernameByUid(user.uid);
  if (isValidUsername(mapped)) {
    if (!displayName) {
      try {
        await updateProfile(user, { displayName: mapped });
      } catch (error) {
        console.warn('Unable to synchronise display name with username:', error);
      }
    }
    return mapped;
  }

  const syntheticEmail = typeof user.email === 'string' ? user.email : '';
  if (syntheticEmail.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) {
    const derived = normalizeUsername(
      syntheticEmail.slice(0, -(`@${SYNTHETIC_EMAIL_DOMAIN}`.length)),
    );
    if (isValidUsername(derived)) {
      return derived;
    }
  }

  return '';
}

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authError.textContent = '';
  const rawUsername = authUsername.value;
  const normalizedUsername = normalizeUsername(rawUsername);
  const password = authPassword.value;

  if (!normalizedUsername) {
    authError.textContent = 'Enter your username to continue.';
    return;
  }

  if (!isValidUsername(normalizedUsername)) {
    authError.textContent =
      'Usernames must be 3-20 characters using only letters, numbers, or underscores.';
    return;
  }

  const syntheticEmail = buildSyntheticEmail(normalizedUsername);

  try {
    if (authMode === 'login') {
      await signInWithEmailAndPassword(auth, syntheticEmail, password);
      return;
    }

    const credentials = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
    const { user } = credentials;

    try {
      await updateProfile(user, { displayName: normalizedUsername });
    } catch (profileError) {
      console.warn('Failed to update display name:', profileError);
    }

    try {
      await ensureUserRole(user, normalizedUsername);
    } catch (error) {
      console.error('Failed to initialize user record:', error);
      try {
        await deleteUser(user);
      } catch (cleanupError) {
        console.warn('Unable to clean up user after initialization failure:', cleanupError);
      }
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      const initializationError = new Error('Username unavailable');
      initializationError.code = 'auth/username-unavailable';
      throw initializationError;
    }
  } catch (error) {
    let message = 'Unable to complete the request. Please try again.';

    switch (error?.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        message = 'Invalid username or password.';
        break;
      case 'auth/email-already-in-use':
      case 'auth/username-unavailable':
      case 'permission-denied':
        message = 'That username is already taken. Choose another one.';
        break;
      case 'auth/invalid-email':
        message = 'Enter a valid username.';
        break;
      case 'auth/weak-password':
        message = 'Choose a stronger password (at least 6 characters).';
        break;
      default:
        if (error?.message) {
          message = error.message;
        }
    }

    authError.textContent = message;
  }
});

signOutButton.addEventListener('click', async () => {
  await signOutAndRedirectToIndex();
});

unauthorizedSignOut.addEventListener('click', async () => {
  await signOutAndRedirectToIndex();
});

async function ensureUserRole(user, username) {
  if (!user) {
    return null;
  }

  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return { role: null };
  }

  const userRef = doc(db, 'users', user.uid);

  try {
    const existingSnap = await getDoc(userRef);

    if (existingSnap.exists()) {
      const data = existingSnap.data() || {};
      const storedUsername = normalizeUsername(
        typeof data.username === 'string' ? data.username : '',
      );
      const trimmedRole =
        typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';

      const updates = {};

      if (storedUsername !== normalizedUsername) {
        const conflictSnapshot = await getDocs(
          query(collection(db, 'users'), where('username', '==', normalizedUsername), limit(1)),
        );

        if (!conflictSnapshot.empty && conflictSnapshot.docs[0].id !== user.uid) {
          const usernameError = new Error('Username unavailable');
          usernameError.code = 'auth/username-unavailable';
          throw usernameError;
        }

        updates.username = normalizedUsername;
        updates.updatedAt = serverTimestamp();
      } else if (!data.updatedAt) {
        updates.updatedAt = serverTimestamp();
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(userRef, updates, { merge: true });
      }

      return {
        ...data,
        ...(updates.username ? { username: normalizedUsername } : {}),
        ...(updates.updatedAt ? { updatedAt: updates.updatedAt } : {}),
        role: trimmedRole || null,
      };
    }

    const conflictSnapshot = await getDocs(
      query(collection(db, 'users'), where('username', '==', normalizedUsername), limit(1)),
    );

    if (!conflictSnapshot.empty) {
      const usernameError = new Error('Username unavailable');
      usernameError.code = 'auth/username-unavailable';
      throw usernameError;
    }

    const timestamp = serverTimestamp();
    const userData = {
      username: normalizedUsername,
      createdAt: timestamp,
      updatedAt: timestamp,
      role: null,
    };

    await setDoc(userRef, userData);

    return userData;
  } catch (error) {
    console.error('Failed to ensure user record:', error);
    throw error;
  }
}

async function resolveUserRole(user, username) {
  if (!user) {
    return null;
  }

  const normalizedUsername = normalizeUsername(username);
  if (!isValidUsername(normalizedUsername)) {
    return 'default';
  }

  try {
    const ensuredRole = await ensureUserRole(user, normalizedUsername);
    return typeof ensuredRole?.role === 'string' && ensuredRole.role.trim()
      ? ensuredRole.role.trim().toLowerCase()
      : 'default';
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code);
      if (code === 'permission-denied') {
        return 'default';
      }
    }
    console.error('Failed to fetch user role:', error);
    return 'default';
  }
}

function handleUnauthorized() {
  appContent.classList.add('hidden');
  unauthorizedNotice.classList.remove('hidden');
  routeSelector.disabled = true;
  deleteButton.disabled = true;
  clearStatus();
  updateAdminConsoleAccess('');
  cancelTutorialAutostart();
  void finishTutorial();
}

function handleAuthorized(role) {
  unauthorizedNotice.classList.add('hidden');
  appContent.classList.remove('hidden');
  routeSelector.disabled = false;
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
  updateAdminConsoleAccess(normalizedRole);
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserId = user.uid;
    authOverlay.classList.add('hidden');

    const resolvedUsername = await resolveUsernameForUser(user);
    if (!isValidUsername(resolvedUsername)) {
      authError.textContent =
        'Unable to resolve your username. Please contact another setter for assistance.';
      await signOutAndRedirectToIndex();
      return;
    }

    currentUsername = resolvedUsername;

    const role = await resolveUserRole(user, resolvedUsername);

    if (!role) {
      authError.textContent = 'Unable to determine your role. Please try again later.';
      await signOutAndRedirectToIndex();
      return;
    }

    if (role !== 'setter' && role !== 'admin') {
      handleUnauthorized();
      return;
    }

    handleAuthorized(role);

    try {
      await loadRoutesList(currentRouteKey);
      if (currentRouteKey && routesCache.has(currentRouteKey)) {
        applyRouteToCanvas(currentRouteKey, routesCache.get(currentRouteKey));
      } else {
        prepareNewRoute('Select a saved route or start drawing a new one.');
      }
    } catch (error) {
      console.error('Unable to initialise routes:', error);
    }

    scheduleTutorialAutostart();
  } else {
    currentUsername = '';
    currentUserId = null;
    authOverlay.classList.remove('hidden');
    appContent.classList.add('hidden');
    unauthorizedNotice.classList.add('hidden');
    routeSelector.disabled = true;
    deleteButton.disabled = true;
    authForm.reset();
    prepareNewRoute();
    clearStatus();
    setAuthMode('login');
    updateAdminConsoleAccess('');
    cancelTutorialAutostart();
    void finishTutorial();
  }
});

refreshWallSettingsCache()
  .then(() => {
    const locationKey = getCurrentLocationKey();
    const wallSettings = getWallSettingsForLocation(locationKey);
    pointDiameter = wallSettings.hollowPointDiameter ?? wallSettings.pointDiameter;
    filledPointDiameter = wallSettings.filledPointDiameter ?? wallSettings.pointDiameter;
    unfocusedTransparency = wallSettings.unfocusedTransparency;
    updatePathControls();
    updateRoutesForAllWalls();
    redraw();
  })
  .catch((error) => {
    console.warn('Unable to initialise wall settings cache:', error);
  });

setAuthMode('login');

prepareNewRoute();
