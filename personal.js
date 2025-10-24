import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser,
  getIdTokenResult,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  collectionGroup,
  getDocs,
  query,
  limit,
  where,
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
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const authTitle = document.getElementById('authTitle');
const authSwitchLabel = document.getElementById('authSwitchLabel');
const toggleAuthModeButton = document.getElementById('toggleAuthMode');
const signOutButton = document.getElementById('signOutButton');
const setterLink = document.getElementById('setterLink');
const setterLinkBaseHref = setterLink?.getAttribute('href') || 'setter.html';
const tooltip = document.getElementById('routeTooltip');
const TOOLTIP_HISTORY_STATE_KEY = 'ascend.routeTooltip.open';
let tooltipHistoryEntryActive = false;
let suppressNextTooltipPopstate = false;

let lastPrimaryPointerType = 'mouse';

function updateLastPrimaryPointerType(type) {
  if (typeof type === 'string' && type) {
    lastPrimaryPointerType = type;
  }
}

if ('PointerEvent' in window) {
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event?.isPrimary) {
        updateLastPrimaryPointerType(event.pointerType || 'mouse');
      }
    },
    true,
  );
} else {
  window.addEventListener(
    'mousedown',
    () => {
      updateLastPrimaryPointerType('mouse');
    },
    true,
  );
  window.addEventListener(
    'touchstart',
    () => {
      updateLastPrimaryPointerType('touch');
    },
    true,
  );
}
const routeOverlapPrompt = document.getElementById('routeOverlapPrompt');
const routeOverlapList = document.getElementById('routeOverlapList');
const routeOverlapCloseButton = document.getElementById('routeOverlapClose');
const infoButton = document.getElementById('infoButton');
const infoPopover = document.getElementById('infoPopover');
const startPersonalTutorialButton = document.getElementById('startPersonalTutorialButton');
const locationButton = document.getElementById('locationButton');
const viewToggleGroup = document.getElementById('viewToggleGroup');
const viewToggleButtons = Array.from(
  viewToggleGroup?.querySelectorAll('[data-view-mode]') ?? [],
);
const viewToggleButtonMap = new Map();
viewToggleButtons.forEach((button) => {
  const mode = button?.dataset?.viewMode;
  if (mode) {
    viewToggleButtonMap.set(mode, button);
  }
  const cycle = button?.dataset?.viewModeCycle;
  if (cycle) {
    cycle
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((cycleMode) => {
        viewToggleButtonMap.set(cycleMode, button);
      });
  }
});

function getViewToggleButtonForMode(mode) {
  if (!mode) {
    return null;
  }
  return viewToggleButtonMap.get(mode) ?? null;
}

function isViewToggleElement(element) {
  if (!element) {
    return false;
  }
  return viewToggleButtons.includes(element);
}
const progressionButton = document.getElementById('progressionButton');
const locationModal = document.getElementById('locationModal');
const locationOptions = document.getElementById('locationOptions');
const locationModalClose = document.getElementById('locationModalClose');
const progressionModal = document.getElementById('progressionModal');
const progressionModalClose = document.getElementById('progressionModalClose');
const progressionList = document.getElementById('progressionList');
const tutorialOverlay = document.getElementById('tutorialOverlay');
const tutorialDialogCard = document.getElementById('tutorialDialogCard');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialDescription = document.getElementById('tutorialDescription');
const tutorialPrimaryAction = document.getElementById('tutorialPrimaryAction');
const tutorialSecondaryAction = document.getElementById('tutorialSecondaryAction');
const tutorialProgress = document.getElementById('tutorialProgress');
const tutorialBrand = document.getElementById('tutorialBrand');

let infoHighlightsContainer = null;
let infoModeActive = false;
let awaitingInfoTargetSelection = false;
let activeInfoCallout = null;
let pendingInfoRepositionFrame = null;
let ephemeralCalloutDismissTimer = null;
let tutorialPointer = null;
let tutorialPointerTarget = null;
let tutorialHighlightedElement = null;
let tutorialHighlightedElementOptions = { illuminate: false };
let tutorialPreviousFocus = null;
let tutorialActive = false;
let tutorialStepIndex = -1;
let tutorialTransitionInProgress = false;
let tutorialSteps = [];
let tutorialSecondaryActionMode = 'back';
let tutorialHighlightedRouteId = null;
let tutorialPreviousViewMode = null;

let activeOverlapPromptContext = null;
let overlapPromptReturnFocus = null;

let tutorialOptOut = false;
let tutorialAutoStartTimer = null;

const PERSONAL_TUTORIAL_OPT_OUT_KEY = 'ascend.personalTutorial.optOut';
const PERSONAL_TUTORIAL_VERSION_KEY = 'ascend.personalTutorial.version';
const PERSONAL_TUTORIAL_VERSION = '2024-11-mobile-refresh';

function readStoredTutorialOptOut() {
  try {
    const storage = window.localStorage;
    if (!storage) {
      return false;
    }

    const storedVersion = storage.getItem(PERSONAL_TUTORIAL_VERSION_KEY);
    if (storedVersion !== PERSONAL_TUTORIAL_VERSION) {
      storage.setItem(PERSONAL_TUTORIAL_VERSION_KEY, PERSONAL_TUTORIAL_VERSION);
    }

    storage.removeItem(PERSONAL_TUTORIAL_OPT_OUT_KEY);
    return false;
  } catch (error) {
    console.warn('Failed to read tutorial preference:', error);
    return false;
  }
}

function persistTutorialOptOut() {
  try {
    const storage = window.localStorage;
    if (!storage) {
      return;
    }

    storage.setItem(PERSONAL_TUTORIAL_VERSION_KEY, PERSONAL_TUTORIAL_VERSION);

    storage.removeItem(PERSONAL_TUTORIAL_OPT_OUT_KEY);
  } catch (error) {
    console.warn('Failed to persist tutorial preference:', error);
  }
}

tutorialOptOut = readStoredTutorialOptOut();

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

function ensureInfoHighlightsContainer() {
  if (infoHighlightsContainer && document.body?.contains(infoHighlightsContainer)) {
    return infoHighlightsContainer;
  }

  if (!document.body) {
    return null;
  }

  const container = document.createElement('div');
  container.id = 'infoHighlights';
  container.className = 'info-highlights hidden';
  document.body.appendChild(container);
  infoHighlightsContainer = container;
  return container;
}

function clearInfoHighlights() {
  const container = ensureInfoHighlightsContainer();
  if (!container) {
    return;
  }

  if (pendingInfoRepositionFrame) {
    cancelAnimationFrame(pendingInfoRepositionFrame);
    pendingInfoRepositionFrame = null;
  }

  if (ephemeralCalloutDismissTimer) {
    clearTimeout(ephemeralCalloutDismissTimer);
    ephemeralCalloutDismissTimer = null;
  }

  container.innerHTML = '';
  container.classList.add('hidden');
  activeInfoCallout = null;
}

function createBasicCallout(title, lines = []) {
  const callout = document.createElement('div');
  callout.className = 'info-callout';

  if (title) {
    const heading = document.createElement('strong');
    heading.textContent = title;
    callout.appendChild(heading);
  }

  lines
    .filter((line) => typeof line === 'string' && line.trim().length)
    .forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      callout.appendChild(paragraph);
    });

  return callout;
}

function createGradeChartElement() {
  const wrapper = document.createElement('div');
  wrapper.className = 'info-callout-chart-wrapper';
  wrapper.setAttribute('aria-hidden', 'true');

  const chart = document.createElement('div');
  chart.className = 'info-callout-chart';
  wrapper.appendChild(chart);

  const gradeEntries = Array.from(GRADE_COLOR_MAP.entries());
  const totalGrades = gradeEntries.length;
  const minimumHeight = 22;
  const maximumHeight = 100;
  const heightRange = maximumHeight - minimumHeight;

  gradeEntries.forEach(([grade, color], index) => {
    const bar = document.createElement('span');
    bar.className = 'info-callout-chart-bar';
    const relative = totalGrades > 1 ? index / (totalGrades - 1) : 0;
    const heightPercent = minimumHeight + relative * heightRange;
    bar.style.height = `${heightPercent}%`;
    bar.style.backgroundColor = color;
    bar.dataset.grade = String(grade);
    chart.appendChild(bar);
  });

  if (gradeEntries.length) {
    const labels = document.createElement('div');
    labels.className = 'info-callout-chart-labels';

    const middleIndex = Math.round((gradeEntries.length - 1) / 2);

    const startLabel = document.createElement('span');
    startLabel.textContent = formatGradeDisplay(Number(gradeEntries[0]?.[0] ?? NaN));

    const middleLabel = document.createElement('span');
    middleLabel.textContent = formatGradeDisplay(Number(gradeEntries[middleIndex]?.[0] ?? NaN));

    const endLabel = document.createElement('span');
    endLabel.textContent = formatGradeDisplay(Number(gradeEntries[gradeEntries.length - 1]?.[0] ?? NaN));

    labels.appendChild(startLabel);
    labels.appendChild(middleLabel);
    labels.appendChild(endLabel);

    wrapper.appendChild(labels);
  }

  return wrapper;
}

function isElementVisible(element) {
  if (!element) {
    return false;
  }

  if (element.classList?.contains('hidden')) {
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
        } else if (typeof result === 'string') {
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

function renderTutorialStepContent() {
  if (!tutorialActive) {
    return;
  }

  const step = tutorialSteps[tutorialStepIndex];
  if (!step) {
    return;
  }

  setTutorialBrandVisibility(tutorialStepIndex === 0);

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
    let secondaryLabel = 'Back';
    let shouldShowSecondary = tutorialStepIndex > 0;
    tutorialSecondaryActionMode = 'back';

    if (tutorialStepIndex === 0) {
      secondaryLabel = 'Skip';
      shouldShowSecondary = true;
      tutorialSecondaryActionMode = 'skip';
    }

    tutorialSecondaryAction.textContent = secondaryLabel;
    tutorialSecondaryAction.dataset.mode = tutorialSecondaryActionMode;
    tutorialSecondaryAction.classList.toggle('hidden', !shouldShowSecondary);
  }
}

function setTutorialBrandVisibility(shouldShow) {
  if (!tutorialBrand) {
    return;
  }

  tutorialBrand.classList.toggle('hidden', !shouldShow);
  tutorialBrand.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

async function ensureRoutesAvailableForTutorial() {
  if (Array.isArray(routes) && routes.length) {
    return routes;
  }

  if (Array.isArray(allRoutes) && allRoutes.length) {
    return allRoutes;
  }

  try {
    await loadRoutes();
  } catch (error) {
    console.warn('Unable to refresh routes for tutorial:', error);
  }

  if (Array.isArray(routes) && routes.length) {
    return routes;
  }

  if (Array.isArray(allRoutes) && allRoutes.length) {
    return allRoutes;
  }

  return [];
}

async function showTutorialRouteTooltip() {
  const availableRoutes = await ensureRoutesAvailableForTutorial();
  if (!Array.isArray(availableRoutes) || availableRoutes.length === 0) {
    return;
  }

  const targetRoute = availableRoutes.find((route) => route && typeof route.id === 'string');
  if (!targetRoute) {
    return;
  }

  tutorialHighlightedRouteId = targetRoute.id;
  focusRoute(targetRoute);
  showTooltip(targetRoute, window.innerWidth / 2, window.innerHeight / 2, { pin: true });
}

function closeTutorialRouteTooltip() {
  if (tutorialHighlightedRouteId) {
    const targetRoute =
      (Array.isArray(routes) ? routes : []).find((route) => route?.id === tutorialHighlightedRouteId) ||
      (Array.isArray(allRoutes) ? allRoutes : []).find((route) => route?.id === tutorialHighlightedRouteId);

    if (targetRoute) {
      setRouteFocus(targetRoute, false);
    } else if (focusedRouteId === tutorialHighlightedRouteId) {
      focusedRouteId = null;
      updateClearFocusButton();
      redraw();
    }
  }

  tutorialHighlightedRouteId = null;
  hideTooltip({ force: true });
}

function buildPersonalTutorialSteps() {
  const steps = [
    {
      title: 'Welcome to your dashboard',
      body: [
        'This is your personal space for logging sends, saving projects, and keeping track of the climbs you care about.',
        'Use it to scan the wall, review your history, and stay focused on the problems you want to finish next.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('center');
        highlightTutorialElement(null);
        hideTutorialPointer();
        closeTutorialRouteTooltip();
      },
      onExit: () => {
        highlightTutorialElement(null);
      },
    },
    {
      title: 'Route details & tracking',
      body: [
        'Tap any climb to open its tooltip. You\'ll see the setter, community grade, and everything you\'ve logged.',
        'Mark Ascended when you send it to add the climb to your ticklist automatically.',
        'Double-click the climb to isolate it on the wall, then use Clear Focus when you\'re ready to see every route again.',
        'Fill in Your grade to capture how the problem felt and compare it with the gym consensus.',
      ],
      onEnter: async () => {
        setTutorialOverlayAlignment('bottom');
        highlightTutorialElement(null);
        hideTutorialPointer();
        await showTutorialRouteTooltip();
      },
      onExit: () => {
        hideTutorialPointer();
        closeTutorialRouteTooltip();
        setTutorialOverlayAlignment('center');
      },
    },
    {
      title: 'Spot your sends instantly',
      body: [
        'Tap the color button until it says Show if Ascended to light up the problems you have already sent in green.',
        'Projects still in progress stay grey until you mark them Ascended in the tooltip.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('center');
        highlightTutorialElement(null);
        const toggleButton =
          getViewToggleButtonForMode(VIEW_MODE_ASCENT_STATUS) || viewToggleButtons[0];
        tutorialPreviousViewMode = viewMode;
        if (viewMode !== VIEW_MODE_ASCENT_STATUS) {
          setViewMode(VIEW_MODE_ASCENT_STATUS);
        }
        if (toggleButton) {
          highlightTutorialElement(toggleButton, { illuminate: true });
          showTutorialPointerFor(toggleButton);
        } else {
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
        if (tutorialPreviousViewMode && tutorialPreviousViewMode !== viewMode) {
          setViewMode(tutorialPreviousViewMode);
        }
        tutorialPreviousViewMode = null;
      },
    },
    {
      title: 'Color the wall your way',
      body: [
        'Press the same button again to cycle through Show by Grade and Show by Color of Holds.',
        'Show by Grade gives you a consensus difficulty heatmap while ungraded problems stay bright white.',
        'Show by Color of Holds matches the tape on the wall when you just want the set colours.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('center');
        highlightTutorialElement(null);
        const toggleButton =
          getViewToggleButtonForMode(VIEW_MODE_GRADE_COLORS) || viewToggleButtons[0];
        tutorialPreviousViewMode = viewMode;
        if (viewMode !== VIEW_MODE_GRADE_COLORS) {
          setViewMode(VIEW_MODE_GRADE_COLORS);
        }
        if (toggleButton) {
          highlightTutorialElement(toggleButton, { illuminate: true });
          showTutorialPointerFor(toggleButton);
        } else {
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
        if (tutorialPreviousViewMode && tutorialPreviousViewMode !== viewMode) {
          setViewMode(tutorialPreviousViewMode);
        }
        tutorialPreviousViewMode = null;
      },
    },
    {
      title: 'Track your progression',
      body: [
        'Open the Progression button to review your ascents, see focused projects, and keep tabs on what\'s next.',
        'It pulls together the climbs you\'ve marked Ascended or focused so you can manage your training plan.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('bottom');
        if (progressionButton && isElementVisible(progressionButton)) {
          openProgressionModal();
          highlightTutorialElement(progressionButton, { illuminate: true });
          showTutorialPointerFor(progressionButton);
        } else {
          closeProgressionModal();
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
        closeProgressionModal();
        setTutorialOverlayAlignment('center');
      },
    },
  ];

  if (setterLink && !setterLink.classList.contains('hidden') && isElementVisible(setterLink)) {
    steps.push({
      title: 'Setter tools',
      body: [
        'Setters can jump straight into the workspace from here to plan new climbs and publish updates.',
        'Use it whenever you need to switch from climbing to setting mode without leaving the dashboard.',
      ],
      onEnter: () => {
        setTutorialOverlayAlignment('center');
        if (setterLink && isElementVisible(setterLink)) {
          highlightTutorialElement(setterLink, { illuminate: true });
          showTutorialPointerFor(setterLink);
        } else {
          highlightTutorialElement(null);
          hideTutorialPointer();
        }
      },
      onExit: () => {
        hideTutorialPointer();
        highlightTutorialElement(null);
      },
    });
  }

  return steps;
}

function detachTutorialKeydown() {
  document.removeEventListener('keydown', handleTutorialKeydown, true);
}

function attachTutorialKeydown() {
  document.addEventListener('keydown', handleTutorialKeydown, true);
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
  renderTutorialStepContent();

  const nextStep = tutorialSteps[tutorialStepIndex];
  if (nextStep && typeof nextStep.onEnter === 'function') {
    try {
      await nextStep.onEnter();
    } catch (error) {
      console.warn('Tutorial step setup failed:', error);
    }
  }

  tutorialTransitionInProgress = false;

  if (tutorialPrimaryAction && tutorialStepIndex === tutorialSteps.length - 1) {
    tutorialPrimaryAction.focus();
  }
}

async function startTutorial(options = {}) {
  const { force = false } = options ?? {};

  if (tutorialActive || tutorialTransitionInProgress) {
    return;
  }

  if (tutorialOptOut && !force) {
    return;
  }

  if (force && tutorialOptOut) {
    tutorialOptOut = false;
    persistTutorialOptOut();
  }

  if (tutorialAutoStartTimer !== null) {
    clearTimeout(tutorialAutoStartTimer);
    tutorialAutoStartTimer = null;
  }

  tutorialSteps = buildPersonalTutorialSteps();
  if (!Array.isArray(tutorialSteps) || tutorialSteps.length === 0) {
    return;
  }

  tutorialActive = true;
  tutorialStepIndex = -1;
  tutorialTransitionInProgress = false;
  openTutorialOverlay();
  attachTutorialKeydown();

  await goToTutorialStep(0);
}

async function finishTutorial() {
  if (!tutorialActive && !tutorialTransitionInProgress) {
    return;
  }

  tutorialTransitionInProgress = true;

  if (tutorialStepIndex >= 0 && tutorialStepIndex < tutorialSteps.length) {
    const finalStep = tutorialSteps[tutorialStepIndex];
    if (finalStep && typeof finalStep.onExit === 'function') {
      try {
        await finalStep.onExit();
      } catch (error) {
        console.warn('Tutorial step cleanup failed:', error);
      }
    }
  }

  tutorialActive = false;
  tutorialStepIndex = -1;
  tutorialTransitionInProgress = false;
  tutorialSteps = [];
  tutorialPreviousViewMode = null;

  highlightTutorialElement(null);
  hideTutorialPointer();
  closeTutorialRouteTooltip();
  setTutorialOverlayAlignment('center');
  detachTutorialKeydown();
  closeTutorialOverlay();

  if (tutorialProgress) {
    tutorialProgress.classList.add('hidden');
  }

  setTutorialBrandVisibility(false);
}

async function skipTutorial() {
  tutorialOptOut = true;
  persistTutorialOptOut();
  if (tutorialAutoStartTimer !== null) {
    clearTimeout(tutorialAutoStartTimer);
    tutorialAutoStartTimer = null;
  }
  await finishTutorial();
}

function requestTutorialAutoStart({ delay = 300 } = {}) {
  if (tutorialOptOut || tutorialActive || tutorialTransitionInProgress) {
    return;
  }

  if (tutorialAutoStartTimer !== null) {
    return;
  }

  const resolvedDelay = Number.isFinite(delay) && delay >= 0 ? delay : 0;

  tutorialAutoStartTimer = window.setTimeout(async () => {
    tutorialAutoStartTimer = null;

    if (tutorialOptOut || tutorialActive || tutorialTransitionInProgress) {
      return;
    }

    try {
      await startTutorial();
    } catch (error) {
      console.warn('Failed to start tutorial automatically:', error);
    }
  }, resolvedDelay);
}

function handleTutorialKeydown(event) {
  if (!tutorialActive) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    if (tutorialSecondaryActionMode === 'skip') {
      void skipTutorial();
    } else {
      void finishTutorial();
    }
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (tutorialStepIndex < tutorialSteps.length - 1) {
      void goToTutorialStep(tutorialStepIndex + 1);
    } else {
      finishTutorial();
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


function buildViewModeCallout(context = {}) {
  let target = null;
  if (context?.button instanceof Element && isElementVisible(context.button)) {
    target = context.button;
  } else {
    target =
      getViewToggleButtonForMode(viewMode) ||
      getViewToggleButtonForMode(VIEW_MODE_HOLD_COLORS) ||
      viewToggleButtons[0] ||
      null;
    if (!isElementVisible(target)) {
      target = null;
    }
  }

  if (!target) {
    return null;
  }

  const mode = target.dataset?.viewMode || viewMode;
  let title = 'Route colors';
  let lines = [];

  if (mode === VIEW_MODE_ASCENT_STATUS) {
    title = 'Show if Ascended';
    lines = [
      'Sends you have logged glow green so your ticklist stands out instantly.',
      'Projects still in progress stay grey until you tap Ascended in the tooltip.',
      'Tap the color button again any time to cycle to the other wall views.',
    ];
  } else if (mode === VIEW_MODE_GRADE_COLORS) {
    title = 'Show by Grade';
    lines = [
      'Routes are tinted by consensus difficulty right now.',
      'Problems without a community grade stay bright white until someone logs one.',
      'Tap the color button again to flip to hold colours or back to Show if Ascended.',
    ];
  } else {
    title = 'Show by Color of Holds';
    lines = [
      'Routes are showing the colour of each hold set.',
      'Tap the color button to view Show if Ascended or Show by Grade instead.',
    ];
  }

  const callout = createBasicCallout(title, lines);
  if (mode === VIEW_MODE_GRADE_COLORS) {
    callout.appendChild(createGradeChartElement());
  }

  return {
    target,
    element: callout,
    options: { placement: 'bottom', offset: 14 },
  };
}

function buildSetterCallout() {
  if (!setterLink || !isElementVisible(setterLink)) {
    return null;
  }

  const callout = createBasicCallout('Setter tools', [
    'Open the route-setting workspace to draw climbs for this wall.',
  ]);

  return {
    target: setterLink,
    element: callout,
    options: { placement: 'bottom', offset: 14 },
  };
}

function buildLocationCallout() {
  if (!locationButton) {
    return null;
  }

  const callout = createBasicCallout('Wall selector', [
    'Choose a different wall or angle to load its background and routes.',
  ]);

  return {
    target: locationButton,
    element: callout,
    options: { placement: 'bottom', offset: 14 },
  };
}

function buildProgressionCallout() {
  if (!progressionButton) {
    return null;
  }

  const callout = createBasicCallout('Progression tracker', [
    'Open a sortable list of every visible climb.',
    'Completed routes show a green tick beside their grade.',
  ]);

  return {
    target: progressionButton,
    element: callout,
    options: { placement: 'bottom', offset: 14 },
  };
}

function buildSignOutCallout() {
  if (!signOutButton || !isElementVisible(signOutButton)) {
    return null;
  }

  const callout = createBasicCallout('Sign out', [
    'Log out of Ascend and return to the sign-in screen.',
  ]);

  return {
    target: signOutButton,
    element: callout,
    options: { placement: 'bottom', offset: 14 },
  };
}

function buildRouteAscentCallout(context = {}) {
  const target = context?.target instanceof Element ? context.target : null;
  if (!target || !isElementVisible(target)) {
    return null;
  }

  const isMarkedAscended = target.getAttribute('aria-pressed') === 'true';
  const title = isMarkedAscended ? 'Marked ascended' : 'Not ascended';
  const callout = createBasicCallout(title, [
    'Toggle this when you send the climb to track your personal ascents.',
    'Turn it off again to keep projects on your list.',
  ]);

  return {
    target,
    element: callout,
    options: { placement: 'top', offset: 12 },
  };
}

function buildRouteFocusCallout(context = {}) {
  const target = context?.target instanceof Element ? context.target : null;
  if (!target || !isElementVisible(target)) {
    return null;
  }

  const hasFocusedRoute = Boolean(focusedRouteId);
  const callout = createBasicCallout('Focus view', [
    'Double-click any route to isolate it and study its holds without distractions.',
    hasFocusedRoute
      ? 'Select Clear Focus to bring the rest of the wall back into view.'
      : 'When a route is focused, a Clear Focus button appears here to restore the full wall.',
  ]);

  return {
    target,
    element: callout,
    options: { placement: 'top', offset: 12 },
  };
}

function buildRouteGradeCallout(context = {}) {
  const target = context?.target instanceof Element ? context.target : null;
  if (!target || !isElementVisible(target)) {
    return null;
  }

  const callout = createBasicCallout('Your grade', [
    'This is your personal grade — how you think the climb feels.',
    'Your grade helps shape the community average shown in the top right.',
  ]);

  return {
    target,
    element: callout,
    options: { placement: 'top', offset: 12 },
  };
}

function positionCallout(entry) {
  if (!entry?.target || !entry?.element) {
    return;
  }

  const targetRect = entry.target.getBoundingClientRect();
  if (targetRect.width === 0 && targetRect.height === 0) {
    entry.element.style.opacity = '0';
    return;
  }

  entry.element.style.opacity = '1';

  const placement = entry.options?.placement === 'top' ? 'top' : 'bottom';
  const offset = Number.isFinite(entry.options?.offset) ? entry.options.offset : 14;
  const margin = Number.isFinite(entry.options?.margin) ? entry.options.margin : 16;
  const targetCenterX = targetRect.left + targetRect.width / 2;

  if (placement === 'top') {
    entry.element.dataset.arrow = 'bottom';
    entry.element.style.top = `${targetRect.top - offset}px`;
    entry.element.style.transform = 'translate(-50%, -100%)';
  } else {
    entry.element.dataset.arrow = 'top';
    entry.element.style.top = `${targetRect.bottom + offset}px`;
    entry.element.style.transform = 'translate(-50%, 0)';
  }

  const calloutRect = entry.element.getBoundingClientRect();
  const calloutWidth = calloutRect.width;
  const minCenter = margin + calloutWidth / 2;
  const maxCenter = window.innerWidth - margin - calloutWidth / 2;
  const clampedCenter = clamp(targetCenterX, minCenter, maxCenter);
  entry.element.style.left = `${clampedCenter}px`;

  const updatedRect = entry.element.getBoundingClientRect();
  const arrowOffset = clamp(targetCenterX - updatedRect.left, 12, updatedRect.width - 12);
  entry.element.style.setProperty('--callout-arrow-offset', `${arrowOffset}px`);
}

function scheduleInfoHighlightsReposition() {
  if (!activeInfoCallout) {
    return;
  }

  if (pendingInfoRepositionFrame) {
    cancelAnimationFrame(pendingInfoRepositionFrame);
  }

  pendingInfoRepositionFrame = requestAnimationFrame(() => {
    pendingInfoRepositionFrame = null;
    if (activeInfoCallout) {
      positionCallout(activeInfoCallout);
    }
  });
}

function showInfoCallout(entry) {
  if (!entry?.element) {
    return;
  }

  const container = ensureInfoHighlightsContainer();
  if (!container) {
    return;
  }

  container.innerHTML = '';
  container.classList.remove('hidden');
  container.appendChild(entry.element);
  activeInfoCallout = entry;

  requestAnimationFrame(() => {
    if (activeInfoCallout === entry) {
      positionCallout(entry);
    }
  });
}

function showTemporaryInfoCallout(entry, duration = 8000) {
  if (!entry) {
    return;
  }

  showInfoCallout(entry);

  if (ephemeralCalloutDismissTimer) {
    clearTimeout(ephemeralCalloutDismissTimer);
  }

  const timeout = Number.isFinite(duration) && duration > 0 ? duration : 8000;
  ephemeralCalloutDismissTimer = window.setTimeout(() => {
    ephemeralCalloutDismissTimer = null;
    if (activeInfoCallout === entry) {
      clearInfoHighlights();
    }
  }, timeout);
}

function setInfoButtonActiveState(active) {
  if (!infoButton) {
    return;
  }

  infoButton.setAttribute('aria-pressed', active ? 'true' : 'false');
  infoButton.setAttribute('aria-expanded', active ? 'true' : 'false');
  infoButton.classList.toggle('is-active', active);
}

function hideInfoPopover() {
  if (!infoPopover) {
    return;
  }

  infoPopover.classList.add('hidden');
  infoPopover.setAttribute('aria-hidden', 'true');
}

function activateInfoMode() {
  infoModeActive = true;
  awaitingInfoTargetSelection = true;
  setInfoButtonActiveState(true);
  clearInfoHighlights();

  if (infoPopover) {
    infoPopover.classList.remove('hidden');
    infoPopover.setAttribute('aria-hidden', 'false');
    if (typeof infoPopover.focus === 'function') {
      infoPopover.focus({ preventScroll: true });
    }
  }
}

function deactivateInfoMode({ clearCallout = false } = {}) {
  awaitingInfoTargetSelection = false;

  if (infoModeActive) {
    infoModeActive = false;
  }

  setInfoButtonActiveState(false);
  hideInfoPopover();

  if (clearCallout) {
    clearInfoHighlights();
  }

}

function toggleInfoMode() {
  if (infoModeActive) {
    deactivateInfoMode({ clearCallout: true });
  } else {
    activateInfoMode();
  }
}

function handleInfoRequestFor(targetKey, event, context = {}) {
  if (!infoModeActive || !awaitingInfoTargetSelection) {
    return false;
  }

  awaitingInfoTargetSelection = false;

  if (event) {
    if (typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
  }

  let entry = null;
  switch (targetKey) {
    case 'view-toggle':
      entry = buildViewModeCallout(context);
      break;
    case 'setter-link':
      entry = buildSetterCallout();
      break;
    case 'location':
      entry = buildLocationCallout();
      break;
    case 'progression':
      entry = buildProgressionCallout();
      break;
    case 'sign-out':
      entry = buildSignOutCallout();
      break;
    case 'route-ascent':
      entry = buildRouteAscentCallout(context);
      break;
    case 'route-focus':
      entry = buildRouteFocusCallout(context);
      break;
    case 'route-grade':
      entry = buildRouteGradeCallout(context);
      break;
    default:
      break;
  }

  if (entry) {
    showInfoCallout(entry);
    deactivateInfoMode({ clearCallout: false });
  } else {
    deactivateInfoMode({ clearCallout: true });
  }

  return true;
}

const PATH_TYPE_BEZIER = 'bezier';
const LEGACY_PATH_TYPE_BEZIER = 'brezer';
const PATH_TYPE_HOLLOW_POINT = 'hollow-point';
const PATH_TYPE_FILLED_POINT = 'filled-point';
const PATH_TYPE_RECTANGLE = 'rectangle';
const OVERLAP_GROUP_TYPE_POINT = 'point-group';
const DEFAULT_PATH_TYPE = PATH_TYPE_BEZIER;
const MIN_POINT_DIAMETER = 12;
const MAX_POINT_DIAMETER = 160;
const DEFAULT_HOLLOW_POINT_DIAMETER = 48;
const DEFAULT_FILLED_POINT_DIAMETER = 48;
const DEFAULT_POINT_DIAMETER = DEFAULT_HOLLOW_POINT_DIAMETER;
const MIN_FILLED_POINT_TRANSPARENCY = 0;
const MAX_FILLED_POINT_TRANSPARENCY = 1;
const DEFAULT_FILLED_POINT_TRANSPARENCY = 1;
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
const MIN_GRADE_VALUE = 1;
const MAX_GRADE_VALUE = 31;
const MAX_BETATIP_LENGTH = 600;
const MIN_GRADE_BAR_BASE_HEIGHT = 0;
const MAX_GRADE_BAR_HEIGHT = 1000;
const DEFAULT_GRADE_BAR_BASE_HEIGHT = 40;
const DEFAULT_GRADE_BAR_MAX_HEIGHT = 220;
const MIN_GRADE_BAR_WIDTH = 4;
const MAX_GRADE_BAR_WIDTH = 160;
const DEFAULT_GRADE_BAR_WIDTH = 24;
const DEFAULT_GRADE_BAR_TRANSPARENCY = 0.85;
const MIN_UNFOCUSED_TRANSPARENCY = 0;
const MAX_UNFOCUSED_TRANSPARENCY = 1;
const DEFAULT_UNFOCUSED_TRANSPARENCY = 0.25;
const WALL_COLLECTION = 'walls';
const GRADE_COLOR_MAP = new Map([
  [1, '#2F7E13'],
  [2, '#378B14'],
  [3, '#3E9015'],
  [4, '#459616'],
  [5, '#4BA218'],
  [6, '#50AE1A'],
  [7, '#59B51A'],
  [8, '#60BA19'],
  [9, '#68BF16'],
  [10, '#71C314'],
  [11, '#87C112'],
  [12, '#92C510'],
  [13, '#C6D208'],
  [14, '#DDD805'],
  [15, '#F3DF01'],
  [16, '#F6C20E'],
  [17, '#EEA21C'],
  [18, '#EA9621'],
  [19, '#E78A27'],
  [20, '#E37B27'],
  [21, '#E06A23'],
  [22, '#DC5A1E'],
  [23, '#D94A1B'],
  [24, '#D63F18'],
  [25, '#D33314'],
  [26, '#D02711'],
  [27, '#CE1A0D'],
  [28, '#C90E0B'],
  [29, '#C50809'],
  [30, '#C10407'],
  [31, '#BD0306'],
]);
const DEFAULT_GRADELESS_COLOR = '#ffffff';
const MIN_BEZIER_STROKE_WIDTH = 2;
const MAX_BEZIER_STROKE_WIDTH = 40;
const DEFAULT_BEZIER_STROKE_WIDTH = 10;
const VIEW_MODE_ASCENT_STATUS = 'ascent-status';
const VIEW_MODE_HOLD_COLORS = 'hold-colors';
const VIEW_MODE_GRADE_COLORS = 'grade-colors';
const VIEW_MODE_SEQUENCE = [
  VIEW_MODE_ASCENT_STATUS,
  VIEW_MODE_GRADE_COLORS,
  VIEW_MODE_HOLD_COLORS,
];
const VIEW_MODE_META = {
  [VIEW_MODE_ASCENT_STATUS]: {
    label: 'Showing by Ascended',
    next: VIEW_MODE_GRADE_COLORS,
  },
  [VIEW_MODE_GRADE_COLORS]: {
    label: 'Showing by Grade',
    next: VIEW_MODE_HOLD_COLORS,
  },
  [VIEW_MODE_HOLD_COLORS]: {
    label: 'Showing by Color of Holds',
    next: VIEW_MODE_ASCENT_STATUS,
  },
};
const ASCENT_STATUS_ASCENDED_COLOR = '#7ed957';
const ASCENT_STATUS_PROJECT_COLOR = '#4b5563';

function normalizePathType(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '-');
    if (normalized === PATH_TYPE_BEZIER || normalized === LEGACY_PATH_TYPE_BEZIER) {
      return PATH_TYPE_BEZIER;
    }
    if (normalized === PATH_TYPE_RECTANGLE) {
      return PATH_TYPE_RECTANGLE;
    }
    if (normalized === PATH_TYPE_FILLED_POINT) {
      return PATH_TYPE_FILLED_POINT;
    }
    if (normalized === PATH_TYPE_HOLLOW_POINT || normalized === 'point') {
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

function normalizeBezierStrokeWidth(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_BEZIER_STROKE_WIDTH;
  }
  const clamped = Math.min(
    Math.max(Math.round(numeric), MIN_BEZIER_STROKE_WIDTH),
    MAX_BEZIER_STROKE_WIDTH,
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

function normalizeFilledPointTransparency(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_FILLED_POINT_TRANSPARENCY;
  }
  const clamped = Math.min(
    Math.max(numeric, MIN_FILLED_POINT_TRANSPARENCY),
    MAX_FILLED_POINT_TRANSPARENCY,
  );
  return Math.round(clamped * 1000) / 1000;
}

function normalizeWallSettings(raw = {}) {
  if (!raw || typeof raw !== 'object') {
    return {
      pointDiameter: DEFAULT_HOLLOW_POINT_DIAMETER,
      hollowPointDiameter: DEFAULT_HOLLOW_POINT_DIAMETER,
      hollowPointLineWidth: DEFAULT_HOLLOW_POINT_LINE_WIDTH,
      filledPointDiameter: DEFAULT_FILLED_POINT_DIAMETER,
      filledPointTransparency: DEFAULT_FILLED_POINT_TRANSPARENCY,
      rectangleWidth: DEFAULT_RECTANGLE_WIDTH,
      rectangleHeight: DEFAULT_RECTANGLE_HEIGHT,
      bezierStrokeWidth: DEFAULT_BEZIER_STROKE_WIDTH,
      gradeBarBaseHeight: DEFAULT_GRADE_BAR_BASE_HEIGHT,
      gradeBarMaxHeight: DEFAULT_GRADE_BAR_MAX_HEIGHT,
      gradeBarWidth: DEFAULT_GRADE_BAR_WIDTH,
      gradeBarTransparency: DEFAULT_GRADE_BAR_TRANSPARENCY,
      unfocusedTransparency: DEFAULT_UNFOCUSED_TRANSPARENCY,
    };
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
  const filledPointTransparency = normalizeFilledPointTransparency(
    raw.filledPointTransparency ?? raw.filledPointOpacity,
  );
  const pointDiameter = hollowPointDiameter;
  const rectangleWidth = normalizeRectangleSize(
    raw.rectangleWidth,
    DEFAULT_RECTANGLE_WIDTH,
  );
  const rectangleHeight = normalizeRectangleSize(
    raw.rectangleHeight,
    DEFAULT_RECTANGLE_HEIGHT,
  );
  const bezierStrokeWidth = normalizeBezierStrokeWidth(
    raw.bezierStrokeWidth ?? raw.brezerStrokeWidth,
  );
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
  const unfocusedTransparency = normalizeUnfocusedTransparency(
    raw.unfocusedTransparency ?? raw.unfocused_transparency,
  );

  return {
    pointDiameter,
    hollowPointDiameter,
    hollowPointLineWidth,
    filledPointDiameter,
    filledPointTransparency,
    rectangleWidth,
    rectangleHeight,
    bezierStrokeWidth,
    gradeBarBaseHeight,
    gradeBarMaxHeight,
    gradeBarWidth,
    gradeBarTransparency,
    unfocusedTransparency,
  };
}

function getWallPointDiameterForPathType(settings, pathTypeValue) {
  const normalized = normalizePathType(pathTypeValue);
  if (!settings || typeof settings !== 'object') {
    return getDefaultPointDiameterForPathType(normalized);
  }
  if (normalized === PATH_TYPE_FILLED_POINT) {
    return normalizePointDiameter(
      settings.filledPointDiameter ?? settings.pointDiameter,
      DEFAULT_FILLED_POINT_DIAMETER,
    );
  }
  if (normalized === PATH_TYPE_HOLLOW_POINT) {
    return normalizePointDiameter(
      settings.hollowPointDiameter ?? settings.pointDiameter,
      DEFAULT_HOLLOW_POINT_DIAMETER,
    );
  }
  return getDefaultPointDiameterForPathType(normalized);
}

function getRoutePointDiameterForPathType(route, pathTypeValue) {
  const normalized = normalizePathType(pathTypeValue ?? route?.pathType);
  if (!route || typeof route !== 'object') {
    return getDefaultPointDiameterForPathType(normalized);
  }
  if (normalized === PATH_TYPE_FILLED_POINT) {
    return normalizePointDiameter(
      route.filledPointDiameter ?? route.pointDiameter,
      DEFAULT_FILLED_POINT_DIAMETER,
    );
  }
  if (normalized === PATH_TYPE_HOLLOW_POINT) {
    return normalizePointDiameter(
      route.hollowPointDiameter ?? route.pointDiameter,
      DEFAULT_HOLLOW_POINT_DIAMETER,
    );
  }
  return getDefaultPointDiameterForPathType(normalized);
}

function getRouteHollowPointLineWidth(route) {
  const diameter = getRoutePointDiameterForPathType(route, PATH_TYPE_HOLLOW_POINT);
  return normalizeHollowPointLineWidth(route?.hollowPointLineWidth, diameter);
}

function getRouteFilledPointTransparency(route) {
  if (!route || typeof route !== 'object') {
    return DEFAULT_FILLED_POINT_TRANSPARENCY;
  }
  const value =
    route.filledPointTransparency ??
    route.pointTransparency ??
    route.filledPointOpacity ??
    route.pointOpacity;
  return normalizeFilledPointTransparency(value);
}

const wallSettingsCache = new Map();

const normalizeLocationName = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizeWallKey = (value) => normalizeLocationName(value);

function resolveWallSettings(locationKey, fallback = null) {
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

  return {
    pointDiameter: DEFAULT_POINT_DIAMETER,
    hollowPointDiameter: DEFAULT_HOLLOW_POINT_DIAMETER,
    hollowPointLineWidth: DEFAULT_HOLLOW_POINT_LINE_WIDTH,
    filledPointDiameter: DEFAULT_FILLED_POINT_DIAMETER,
    filledPointTransparency: DEFAULT_FILLED_POINT_TRANSPARENCY,
    rectangleWidth: DEFAULT_RECTANGLE_WIDTH,
    rectangleHeight: DEFAULT_RECTANGLE_HEIGHT,
    bezierStrokeWidth: DEFAULT_BEZIER_STROKE_WIDTH,
    gradeBarBaseHeight: DEFAULT_GRADE_BAR_BASE_HEIGHT,
    gradeBarMaxHeight: DEFAULT_GRADE_BAR_MAX_HEIGHT,
    gradeBarWidth: DEFAULT_GRADE_BAR_WIDTH,
    gradeBarTransparency: DEFAULT_GRADE_BAR_TRANSPARENCY,
    unfocusedTransparency: DEFAULT_UNFOCUSED_TRANSPARENCY,
  };
}

const findLocationByKey = (key) =>
  LOCATIONS.find((location) => location.key === key && isLocationVisible(location));

const findLocationByName = (name) => {
  const normalized = normalizeLocationName(name);
  return (
    LOCATIONS.find(
      (location) => normalizeLocationName(location.name) === normalized && isLocationVisible(location),
    ) || null
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
    console.warn('Unable to persist location preference:', error);
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
      existing.key !== normalizedKey || existing.name !== displayName || existing.image !== normalizedImage;

    if (!needsUpdate) {
      const hiddenChanged = Boolean(existing.hidden) !== normalizedHidden;
      if (hiddenChanged) {
        existing.hidden = normalizedHidden;
        return { entry: existing, changed: true };
      }
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

function ensureCurrentLocationVisible() {
  if (isLocationVisible(currentLocation)) {
    return;
  }

  const fallback = getDefaultLocation();
  if (fallback) {
    const changed = !currentLocation || currentLocation.key !== fallback.key;
    currentLocation = fallback;
    updateLocationButtonLabel();
    updateLocationOptionsState();
    updateBackgroundForCurrentLocation();
    const fallbackKey = getCurrentLocationKey();
    if (fallbackKey) {
      persistSelectedWall(fallbackKey);
      updateWallQueryParam(fallbackKey);
    } else {
      persistSelectedWall('');
      updateWallQueryParam('');
    }
    updateSetterLinkHref();
    if (changed) {
      applyLocationFilter();
    }
    return;
  }

  currentLocation = null;
  updateLocationButtonLabel();
  updateLocationOptionsState();
  updateBackgroundForCurrentLocation();
  persistSelectedWall('');
  updateWallQueryParam('');
  updateSetterLinkHref();
  applyLocationFilter();
}

function synchronizeCurrentLocationReference() {
  if (!currentLocation) {
    ensureCurrentLocationVisible();
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
    const refreshedKey = getCurrentLocationKey();
    if (refreshedKey) {
      persistSelectedWall(refreshedKey);
      updateWallQueryParam(refreshedKey);
    } else {
      persistSelectedWall('');
      updateWallQueryParam('');
    }
    updateSetterLinkHref();
  }

  ensureCurrentLocationVisible();
}

let currentLocation = getDefaultLocation();

function getCurrentLocationKey() {
  return normalizeWallKey(currentLocation?.key || currentLocation?.name);
}

function updateSetterLinkHref() {
  if (!setterLink) {
    return;
  }

  const wallKey = getCurrentLocationKey();
  setterLink.href = buildWallAwareHref(setterLinkBaseHref, wallKey);
}

let backgroundReady = false;
let backgroundImageSource = '';
let viewMode = VIEW_MODE_HOLD_COLORS;

const backgroundImage = new Image();

function getViewModeMetadata(mode) {
  if (mode && VIEW_MODE_META[mode]) {
    return VIEW_MODE_META[mode];
  }
  return VIEW_MODE_META[VIEW_MODE_HOLD_COLORS];
}

function getNextViewMode(mode) {
  const currentIndex = VIEW_MODE_SEQUENCE.indexOf(mode);
  if (currentIndex === -1) {
    return VIEW_MODE_SEQUENCE[0];
  }
  return VIEW_MODE_SEQUENCE[(currentIndex + 1) % VIEW_MODE_SEQUENCE.length];
}

function updateLocationButtonLabel() {
  const labelText = currentLocation?.name || 'Select wall';
  if (locationButton) {
    locationButton.setAttribute('aria-label', `Select wall: ${labelText}`);
    locationButton.setAttribute('title', labelText);
  }
}

function syncViewModeState() {
  if (!document.body) {
    return;
  }
  document.body.classList.toggle('view-mode-grade-colors', viewMode === VIEW_MODE_GRADE_COLORS);
  document.body.classList.toggle('view-mode-hold-colors', viewMode === VIEW_MODE_HOLD_COLORS);
  document.body.classList.toggle('view-mode-ascents', viewMode === VIEW_MODE_ASCENT_STATUS);
}

function updateViewToggleButtons() {
  if (!viewToggleButtons.length) {
    return;
  }

  viewToggleButtons.forEach((button) => {
    if (!button) {
      return;
    }

    if (button.dataset?.viewModeCycle) {
      const metadata = getViewModeMetadata(viewMode);
      const label = metadata?.label ?? '';
      const tooltipText = label || 'Showing routes';
      const nextMode = metadata?.next ?? getNextViewMode(viewMode);

      button.dataset.viewMode = viewMode;
      button.dataset.tooltip = tooltipText;
      button.dataset.nextViewMode = nextMode;

      if (tooltipText) {
        button.setAttribute('title', tooltipText);
        button.setAttribute('aria-label', tooltipText);
      } else {
        button.removeAttribute('title');
        button.removeAttribute('aria-label');
      }

      button.setAttribute('aria-pressed', 'true');
      button.classList.add('is-active');

      const srLabel = button.querySelector('[data-view-toggle-label]');
      if (srLabel) {
        srLabel.textContent = tooltipText;
      }

      return;
    }

    const mode = button.dataset?.viewMode;
    const tooltip = button.dataset?.tooltip;
    if (tooltip) {
      button.setAttribute('title', tooltip);
      button.setAttribute('aria-label', tooltip);
    }

    const isActive = mode === viewMode;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.classList.toggle('is-active', isActive);
  });
}

function setViewMode(mode) {
  const allowedModes = new Set([
    VIEW_MODE_ASCENT_STATUS,
    VIEW_MODE_GRADE_COLORS,
    VIEW_MODE_HOLD_COLORS,
  ]);
  const normalized = allowedModes.has(mode) ? mode : VIEW_MODE_HOLD_COLORS;
  if (viewMode === normalized) {
    return;
  }

  viewMode = normalized;
  syncViewModeState();
  updateViewToggleButtons();
  hideTooltip({ force: true });
  if (canvas) {
    canvas.style.cursor = '';
  }
  redraw();
}

function updateLocationOptionsState() {
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
}

function applyBodyBackground(imagePath) {
  if (!document.body) {
    return;
  }

  if (imagePath) {
    document.body.style.setProperty('--wall-background', `url('${imagePath}')`);
  } else {
    document.body.style.removeProperty('--wall-background');
  }
}

function updateBackgroundForCurrentLocation() {
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

function closeLocationModal() {
  if (!locationModal) {
    return;
  }

  if (!locationModal.classList.contains('hidden')) {
    locationModal.classList.add('hidden');
    locationModal.setAttribute('aria-hidden', 'true');
    locationButton?.setAttribute('aria-expanded', 'false');
  }
}

function openLocationModal() {
  if (!locationModal) {
    return;
  }

  locationModal.classList.remove('hidden');
  locationModal.setAttribute('aria-hidden', 'false');
  locationButton?.setAttribute('aria-expanded', 'true');
  updateLocationOptionsState();
}

function handleLocationSelection(locationKey) {
  const location = findLocationByKey(locationKey);
  if (!location) {
    return;
  }

  const changed = !currentLocation || currentLocation.key !== location.key;
  currentLocation = location;
  updateLocationButtonLabel();
  updateLocationOptionsState();
  updateBackgroundForCurrentLocation();

  const nextLocationKey = getCurrentLocationKey();
  if (nextLocationKey) {
    persistSelectedWall(nextLocationKey);
  }
  updateWallQueryParam(nextLocationKey);
  updateSetterLinkHref();

  if (changed) {
    applyLocationFilter();
  }

  closeLocationModal();
}

function renderLocationOptions() {
  if (!locationOptions) {
    return;
  }

  locationOptions.replaceChildren();

  LOCATIONS.filter(isLocationVisible).forEach((location) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'location-option';
    button.dataset.locationKey = location.key;
    button.setAttribute('role', 'option');

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
    button.appendChild(label);

    button.addEventListener('click', () => {
      handleLocationSelection(location.key);
    });

    locationOptions.appendChild(button);
  });

  updateLocationOptionsState();
}

const SYNTHETIC_EMAIL_DOMAIN = 'users.anuascend.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

const normalizeUsername = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

function cacheAuthenticatedUsername(username) {
  const normalized = normalizeUsername(username);
  authenticatedUsernameClaim = isValidUsername(normalized) ? normalized : '';
  return authenticatedUsernameClaim;
}

async function resolveAuthenticatedUsername(options = {}) {
  const { forceRefresh = false } = options;

  if (!currentUser) {
    authenticatedUsernameClaim = '';
    return isValidUsername(currentUsername) ? normalizeUsername(currentUsername) : '';
  }

  if (!forceRefresh) {
    const cachedClaim = normalizeUsername(authenticatedUsernameClaim);
    if (isValidUsername(cachedClaim)) {
      return cachedClaim;
    }
  }

  const fallbackUsername = isValidUsername(currentUsername)
    ? normalizeUsername(currentUsername)
    : '';

  try {
    const tokenResult = await getIdTokenResult(currentUser, forceRefresh);
    const claimUsername = normalizeUsername(tokenResult?.claims?.username);

    if (isValidUsername(claimUsername)) {
      return cacheAuthenticatedUsername(claimUsername);
    }
  } catch (error) {
    console.warn(
      forceRefresh
        ? 'Failed to refresh authenticated username claim:'
        : 'Failed to read authenticated username claim:',
      error,
    );
  }

  if (!forceRefresh) {
    return resolveAuthenticatedUsername({ forceRefresh: true });
  }

  if (fallbackUsername) {
    return cacheAuthenticatedUsername(fallbackUsername);
  }

  return '';
}

async function ensureUidUsernameMapping(user, username) {
  if (!user) {
    return;
  }

  const normalizedUsername = normalizeUsername(username);
  if (!isValidUsername(normalizedUsername)) {
    return;
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      try {
        await ensureUserRole(user, normalizedUsername);
      } catch (creationError) {
        console.warn(
          'Failed to create user record while synchronising username mapping:',
          creationError,
        );
        return;
      }
    }

    await setDoc(
      userRef,
      {
        username: normalizedUsername,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    uidUsernameCache.set(user.uid, normalizedUsername);
  } catch (error) {
    console.warn('Failed to synchronise username mapping for betatips:', error);
  }
}

const buildSyntheticEmail = (username) => {
  const normalized = normalizeUsername(username);
  return normalized ? `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}` : '';
};

const isValidUsername = (value) => USERNAME_PATTERN.test(normalizeUsername(value));

const tooltipColorCanvas = document.createElement('canvas');
const tooltipColorContext = tooltipColorCanvas.getContext('2d');

function getTextColor(bgColor) {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) {
    return '#fff';
  }

  context.fillStyle = '#000';
  context.fillStyle = bgColor;
  const values = context.fillStyle.match(/\d+/g);

  if (!values || values.length < 3) {
    return '#fff';
  }

  const [r, g, b] = values.map(Number);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000' : '#fff';
}

function parseTooltipColor(color) {
  if (!tooltipColorContext || typeof color !== 'string') {
    return null;
  }

  let normalized;
  try {
    tooltipColorContext.fillStyle = '#000000';
    tooltipColorContext.fillStyle = color;
    normalized = tooltipColorContext.fillStyle;
  } catch (error) {
    return null;
  }

  if (typeof normalized !== 'string' || !normalized) {
    return null;
  }

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    const r = parseInt(normalized.slice(1, 3), 16);
    const g = parseInt(normalized.slice(3, 5), 16);
    const b = parseInt(normalized.slice(5, 7), 16);
    return { r, g, b, hex: normalized };
  }

  const rgbaMatch = normalized
    .replace(/\s+/g, '')
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,(0|1|0?\.\d+))?\)$/i);

  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch;
    return {
      r: Number.parseInt(r, 10),
      g: Number.parseInt(g, 10),
      b: Number.parseInt(b, 10),
      hex: null,
    };
  }

  return null;
}

function deriveTooltipColorScheme(color) {
  const parsed = parseTooltipColor(color);

  if (!parsed) {
    return null;
  }

  const clamp = (value) => Math.max(0, Math.min(255, value));
  const r = clamp(parsed.r);
  const g = clamp(parsed.g);
  const b = clamp(parsed.b);
  const rgbString = `${r}, ${g}, ${b}`;
  const accent = parsed.hex ? parsed.hex : `rgb(${rgbString})`;
  const soft = `rgba(${rgbString}, 0.18)`;
  const strong = `rgba(${rgbString}, 0.85)`;
  const surfaceFactor = 0.22;
  const surfaceOffset = 18;
  const mixChannel = (channel) => clamp(Math.round(channel * surfaceFactor + surfaceOffset));
  const surface = `rgb(${mixChannel(r)}, ${mixChannel(g)}, ${mixChannel(b)})`;
  const onAccent = getTextColor(strong);
  const foreground = getTextColor(surface);
  const softForeground = foreground;
  const mutedForeground = foreground === '#000' ? '#333333' : '#d1d5db';

  return {
    accent,
    rgb: rgbString,
    soft,
    strong,
    onAccent,
    foreground,
    softForeground,
    mutedForeground,
    surface,
    border: accent,
  };
}

const FALLBACK_TOOLTIP_SCHEME = (() => {
  const defaultRgb = '126, 217, 87';
  const soft = 'rgba(126, 217, 87, 0.18)';
  const strong = 'rgba(126, 217, 87, 0.85)';
  const surface = 'rgb(43, 71, 47)';
  const foreground = getTextColor(surface);

  return {
    accent: '#7ed957',
    rgb: defaultRgb,
    soft,
    strong,
    onAccent: getTextColor(strong),
    foreground,
    softForeground: foreground,
    mutedForeground: foreground === '#000' ? '#333333' : '#d1d5db',
    surface,
    border: '#7ed957',
  };
})();

const DEFAULT_TOOLTIP_SCHEME =
  deriveTooltipColorScheme('#7ed957') ?? FALLBACK_TOOLTIP_SCHEME;

function applyTooltipColorScheme(route) {
  if (!tooltip) {
    return;
  }

  const base = DEFAULT_TOOLTIP_SCHEME;
  const scheme = deriveTooltipColorScheme(getRouteDisplayColor(route)) ?? base;

  const accent = scheme.accent ?? base.accent;
  const rgb = scheme.rgb ?? base.rgb;
  const soft = scheme.soft ?? base.soft;
  const strong = scheme.strong ?? base.strong;
  const onAccent = scheme.onAccent ?? base.onAccent;
  const foreground = scheme.foreground ?? base.foreground;
  const softForeground = scheme.softForeground ?? base.softForeground;
  const mutedForeground = scheme.mutedForeground ?? base.mutedForeground;
  const surface = scheme.surface ?? base.surface;
  const border = scheme.border ?? base.border ?? accent;

  tooltip.style.setProperty('--tooltip-accent', accent);
  tooltip.style.setProperty('--tooltip-accent-rgb', rgb);
  tooltip.style.setProperty('--tooltip-accent-soft', soft);
  tooltip.style.setProperty('--tooltip-accent-strong', strong);
  tooltip.style.setProperty('--tooltip-on-accent', onAccent);
  tooltip.style.setProperty('--tooltip-foreground', foreground);
  tooltip.style.setProperty('--tooltip-soft-foreground', softForeground);
  tooltip.style.setProperty('--tooltip-muted-foreground', mutedForeground);
  tooltip.style.setProperty('--tooltip-surface', surface);
  tooltip.style.setProperty('--tooltip-border-color', border);
}

if (infoButton) {
  infoButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleInfoMode();
  });
}

if (infoPopover) {
  infoPopover.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

if (startPersonalTutorialButton) {
  startPersonalTutorialButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (infoModeActive) {
      deactivateInfoMode({ clearCallout: true });
    } else {
      hideInfoPopover();
    }

    try {
      await startTutorial({ force: true });
    } catch (error) {
      console.warn('Unable to launch personal tutorial:', error);
    }
  });
}

document.addEventListener(
  'pointerdown',
  (event) => {
    if (!infoModeActive || !awaitingInfoTargetSelection) {
      return;
    }

    const targetElement =
      event.target instanceof Element ? event.target.closest('[data-info-target]') : null;
    if (!targetElement) {
      return;
    }

    const infoKey = targetElement.getAttribute('data-info-target');
    if (!infoKey) {
      return;
    }

    handleInfoRequestFor(infoKey, event, { target: targetElement });
  },
  true,
);

document.addEventListener(
  'keydown',
  (event) => {
    if (!infoModeActive || !awaitingInfoTargetSelection) {
      return;
    }

    const key = event.key;
    if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') {
      return;
    }

    const targetElement =
      event.target instanceof Element ? event.target.closest('[data-info-target]') : null;
    if (!targetElement) {
      return;
    }

    const infoKey = targetElement.getAttribute('data-info-target');
    if (!infoKey) {
      return;
    }

    handleInfoRequestFor(infoKey, event, { target: targetElement });
  },
  true,
);

renderLocationOptions();

const wallKeyFromQuery = getWallKeyFromQuery();
let initialLocation = wallKeyFromQuery
  ? findLocationByKey(wallKeyFromQuery) || findLocationByName(wallKeyFromQuery)
  : null;

let storedLocationKey = null;
if (!initialLocation) {
  try {
    storedLocationKey = window.localStorage?.getItem(LOCATION_STORAGE_KEY) || null;
  } catch (error) {
    console.warn('Unable to read location preference:', error);
  }

  if (storedLocationKey) {
    const normalizedStoredKey = normalizeWallKey(storedLocationKey);
    initialLocation =
      findLocationByKey(normalizedStoredKey) || findLocationByName(normalizedStoredKey);
  }
}

if (initialLocation) {
  currentLocation = initialLocation;
}

ensureCurrentLocationVisible();

const currentLocationKey = getCurrentLocationKey();
if (currentLocationKey) {
  persistSelectedWall(currentLocationKey);
}
updateWallQueryParam(currentLocationKey);
updateSetterLinkHref();

updateLocationButtonLabel();
updateLocationOptionsState();
if (locationButton) {
  locationButton.setAttribute('aria-expanded', 'false');
}
updateBackgroundForCurrentLocation();

if (locationButton) {
  locationButton.addEventListener('click', (event) => {
    if (handleInfoRequestFor('location', event)) {
      return;
    }
    if (activeInfoCallout?.target === locationButton) {
      clearInfoHighlights();
    }
    event.preventDefault();
    openLocationModal();
  });
}

if (viewToggleButtons.length) {
  viewToggleButtons.forEach((button) => {
    if (!button) {
      return;
    }

    button.addEventListener('click', (event) => {
      if (handleInfoRequestFor('view-toggle', event, { button })) {
        return;
      }
      if (activeInfoCallout?.target && isViewToggleElement(activeInfoCallout.target)) {
        clearInfoHighlights();
      }

      const targetMode = button.dataset?.viewModeCycle
        ? button.dataset?.nextViewMode || getNextViewMode(viewMode)
        : button.dataset?.viewMode;
      setViewMode(targetMode);
    });
  });
}

if (progressionButton) {
  progressionButton.addEventListener('click', (event) => {
    if (handleInfoRequestFor('progression', event)) {
      return;
    }
    if (activeInfoCallout?.target === progressionButton) {
      clearInfoHighlights();
    }
    event.preventDefault();
    if (isProgressionModalOpen()) {
      closeProgressionModal();
    } else {
      openProgressionModal();
    }
  });
}

if (setterLink) {
  setterLink.addEventListener('click', (event) => {
    if (handleInfoRequestFor('setter-link', event)) {
      return;
    }
    if (activeInfoCallout?.target === setterLink) {
      clearInfoHighlights();
    }
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
    if (mode === 'skip') {
      void skipTutorial();
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

if (progressionModalClose) {
  progressionModalClose.addEventListener('click', (event) => {
    event.preventDefault();
    closeProgressionModal();
  });
}

if (progressionModal) {
  progressionModal.addEventListener('click', (event) => {
    if (event.target === progressionModal) {
      closeProgressionModal();
    }
  });
}

window.addEventListener('resize', scheduleInfoHighlightsReposition);
window.addEventListener('scroll', scheduleInfoHighlightsReposition, true);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLocationModal();
    closeProgressionModal();
    if (infoModeActive) {
      deactivateInfoMode({ clearCallout: true });
      if (infoButton) {
        infoButton.focus();
      }
    } else if (activeInfoCallout) {
      clearInfoHighlights();
      if (infoButton) {
        infoButton.focus();
      }
    }
  }
});

let authMode = 'login';
let currentUser = null;
let currentUsername = '';
let authenticatedUsernameClaim = '';

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
  const normalizedUid = typeof uid === 'string' ? uid.trim() : '';
  if (!normalizedUid) {
    return '';
  }

  const cached = uidUsernameCache.get(normalizedUid);
  if (typeof cached === 'string') {
    return cached;
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', normalizedUid));

    if (!userSnap.exists()) {
      uidUsernameCache.set(normalizedUid, '');
      return '';
    }

    const data = userSnap.data() || {};
    const resolved = normalizeUsername(typeof data.username === 'string' ? data.username : '');
    const normalizedUsername = isValidUsername(resolved) ? resolved : '';
    uidUsernameCache.set(normalizedUid, normalizedUsername);
    return normalizedUsername;
  } catch (error) {
    console.error('Failed to look up username by UID:', error);
    uidUsernameCache.set(normalizedUid, '');
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

if (signOutButton) {
  signOutButton.addEventListener('click', async (event) => {
    if (handleInfoRequestFor('sign-out', event)) {
      return;
    }
    if (activeInfoCallout?.target === signOutButton) {
      clearInfoHighlights();
    }
    await signOutAndRedirectToIndex();
  });
}

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
  if (!normalizedUsername) {
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

  function updateNavigationForRole(role) {
    updateSetterLinkHref();
    if (!setterLink) {
      return;
    }

    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    const shouldHideSetterLink =
      normalizedRole !== 'setter' && normalizedRole !== 'admin';
    setterLink.classList.toggle('hidden', shouldHideSetterLink);

    if (shouldHideSetterLink && activeInfoCallout?.target === setterLink) {
      clearInfoHighlights();
    }
  }

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authOverlay.classList.add('hidden');

    currentUser = user;

    const resolvedUsername = await resolveUsernameForUser(user);
    if (!isValidUsername(resolvedUsername)) {
      authError.textContent =
        'Unable to resolve your username. Please contact a setter for assistance.';
      await signOutAndRedirectToIndex();
      return;
    }

    currentUsername = normalizeUsername(resolvedUsername);
    authenticatedUsernameClaim = '';
    const canonicalUsername = await resolveAuthenticatedUsername();
    if (isValidUsername(canonicalUsername)) {
      currentUsername = canonicalUsername;
    }

    await ensureUidUsernameMapping(user, currentUsername);

    const role = await resolveUserRole(user, currentUsername);

    updateNavigationForRole(role);
    appContent.classList.remove('hidden');

    await loadRoutes();
    await loadAscents({ uid: currentUser?.uid || '' });
    requestTutorialAutoStart({ delay: 300 });
  } else {
    authOverlay.classList.remove('hidden');
    appContent.classList.add('hidden');
    setterLink.classList.add('hidden');
    if (tutorialAutoStartTimer !== null) {
      clearTimeout(tutorialAutoStartTimer);
      tutorialAutoStartTimer = null;
    }
    void finishTutorial();
    if (infoModeActive) {
      deactivateInfoMode({ clearCallout: true });
    } else if (activeInfoCallout) {
      clearInfoHighlights();
    }
    authForm.reset();
    setAuthMode('login');
    routes = [];
    focusedRouteId = null;
    updateClearFocusButton();
    currentUser = null;
    currentUsername = '';
    authenticatedUsernameClaim = '';
    ascendedRoutes.clear();
    routeBetatipsCache.clear();
    uidUsernameCache.clear();
    hideTooltip({ force: true });
    redraw();
  }
});

setAuthMode('login');

const canvasContainer = document.querySelector('.canvas-container');
const canvas = document.getElementById('previewCanvas');
const clearFocusButton = document.getElementById('clearFocusButton');
const ctx = canvas.getContext('2d');

if (clearFocusButton) {
  clearFocusButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearRouteFocus();
  });
}

syncViewModeState();
updateViewToggleButtons();

const DEFAULT_CANVAS_ASPECT_RATIO = 1536 / 1024;
let canvasAspectRatio = DEFAULT_CANVAS_ASPECT_RATIO;
let isHorizontalScrollEnabled = false;

let allRoutes = [];
let routes = [];
let focusedRouteId = null;
let routeInteractionEntries = [];
let activeRouteId = null;
let pinnedRouteId = null;
let pinnedPosition = null;
const ascendedRoutes = new Set();
const routeBetatipsCache = new Map();
const uidUsernameCache = new Map();
let userAscentDetails = new Map();
let progressionPreviouslyFocusedElement = null;
const CLICK_DRAG_DISTANCE_THRESHOLD = 8;
const CLICK_DRAG_DISTANCE_THRESHOLD_SQUARED =
  CLICK_DRAG_DISTANCE_THRESHOLD * CLICK_DRAG_DISTANCE_THRESHOLD;
let activePointerInteraction = null;

const DOUBLE_FOCUS_TIME_THRESHOLD = 350;
const DOUBLE_FOCUS_DISTANCE_THRESHOLD = 32;
let lastFocusActivation = {
  time: 0,
  routeId: null,
  pointerType: '',
  x: 0,
  y: 0,
};

updateClearFocusButton();

function resetLastFocusActivation() {
  lastFocusActivation = {
    time: 0,
    routeId: null,
    pointerType: '',
    x: 0,
    y: 0,
  };
}

function resolvePointerType(event) {
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
}

function shouldFocusFromInteraction(event, entry) {
  if (!entry || !entry.route || typeof entry.route.id !== 'string') {
    resetLastFocusActivation();
    return false;
  }

  const pointerType = resolvePointerType(event);
  const now = typeof event?.timeStamp === 'number' ? event.timeStamp : Date.now();
  const clickCount = typeof event?.detail === 'number' ? event.detail : 0;
  let isDoubleActivation = clickCount >= 2;

  if (!isDoubleActivation && lastFocusActivation.routeId) {
    const elapsed = now - lastFocusActivation.time;
    if (elapsed <= DOUBLE_FOCUS_TIME_THRESHOLD) {
      const pointerMatches =
        !pointerType || !lastFocusActivation.pointerType
          ? true
          : pointerType === lastFocusActivation.pointerType;
      if (pointerMatches && entry.route.id === lastFocusActivation.routeId) {
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
    routeId: entry.route.id,
    pointerType,
    x: entry.canvasX ?? 0,
    y: entry.canvasY ?? 0,
  };

  return isDoubleActivation;
}

function synchroniseAscentsWithRoutes(options = {}) {
  const { shouldRedraw = true } = options;
  ascendedRoutes.clear();

  if (!Array.isArray(routes) || routes.length === 0) {
    renderProgressionList();
    if (shouldRedraw) {
      redraw();
    }
    return;
  }

  routes.forEach((route) => {
    if (!route?.id) {
      return;
    }

    const ascent = userAscentDetails.get(route.id);
    if (!ascent) {
      return;
    }

    if (ascent.ascended) {
      ascendedRoutes.add(route.id);
    }
  });

  renderProgressionList();

  if (shouldRedraw) {
    redraw();
  }
}

async function loadAscents({ uid }) {
  ascendedRoutes.clear();
  userAscentDetails = new Map();

  const normalizedUid = typeof uid === 'string' ? uid.trim() : '';
  if (!normalizedUid) {
    synchroniseAscentsWithRoutes();
    return;
  }

  const processCollection = (collection) => {
    if (!Array.isArray(collection)) {
      return;
    }

    collection.forEach((route) => {
      const routeId = getRouteId(route);
      if (!routeId || userAscentDetails.has(routeId)) {
        return;
      }

      const entry = getRouteScoreEntry(route, normalizedUid);
      if (!entry) {
        return;
      }

      const gradeValue = normalizeGradeValue(entry.grade);
      const ascended = entry.ascended === true;

      const ascentDetails = {
        ascended,
        grade: gradeValue,
      };

      userAscentDetails.set(routeId, ascentDetails);

      if (ascended) {
        ascendedRoutes.add(routeId);
      }
    });
  };

  processCollection(allRoutes);
  if (routes !== allRoutes) {
    processCollection(routes);
  }

  synchroniseAscentsWithRoutes();
}

function normalizeDate(value) {
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

function formatDisplayDate(isoString) {
  if (!isoString) {
    return 'Unknown';
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

const normalizeUpvoteIdentifier = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : '';
};

function normalizeUpvoteList(value) {
  const normalized = new Set();

  const addCandidate = (candidate) => {
    const normalizedId = normalizeUpvoteIdentifier(candidate);
    if (normalizedId) {
      normalized.add(normalizedId);
    }
  };

  if (value instanceof Set) {
    value.forEach(addCandidate);
  } else if (Array.isArray(value)) {
    value.forEach(addCandidate);
  } else if (value && typeof value === 'object') {
    Object.keys(value).forEach(addCandidate);
    Object.values(value).forEach(addCandidate);
  } else {
    addCandidate(value);
  }

  return normalized;
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
  if (!Array.isArray(rawPoints)) {
    return [];
  }

  return rawPoints.map(sanitizeNormalizedPoint).filter(Boolean);
}

function collectCandidatePoints(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value instanceof Map) {
    return Array.from(value.values());
  }

  if (value && typeof value === 'object') {
    return Object.values(value);
  }

  return [];
}

function normalizeRoutePointsByType(rawPoints, fallbackPathType) {
  const normalized = {};
  const fallbackType = normalizePathType(fallbackPathType) || DEFAULT_PATH_TYPE;

  const assignPoints = (pathTypeKey, value) => {
    const normalizedType = normalizePathType(pathTypeKey);
    if (!normalizedType || normalized[normalizedType]) {
      return;
    }

    normalized[normalizedType] = sanitizeNormalizedPointsArray(collectCandidatePoints(value));
  };

  if (rawPoints instanceof Map) {
    rawPoints.forEach((value, key) => assignPoints(key, value));
  } else if (rawPoints && typeof rawPoints === 'object' && !Array.isArray(rawPoints)) {
    Object.entries(rawPoints).forEach(([key, value]) => assignPoints(key, value));
  } else if (Array.isArray(rawPoints)) {
    assignPoints(fallbackType, rawPoints);
  }

  if (!Object.prototype.hasOwnProperty.call(normalized, fallbackType)) {
    normalized[fallbackType] = [];
  }

  return normalized;
}

function getRoutePointEntries(route) {
  const entries = [];
  if (!route) {
    return entries;
  }

  const seenTypes = new Set();
  const appendEntry = (pathTypeKey, pointsValue) => {
    const normalizedType = normalizePathType(pathTypeKey);
    if (!normalizedType || seenTypes.has(normalizedType)) {
      return;
    }

    const pointsArray = sanitizeNormalizedPointsArray(collectCandidatePoints(pointsValue));
    seenTypes.add(normalizedType);
    entries.push({
      pathType: normalizedType,
      points: pointsArray,
    });
  };

  const { pointsByType } = route;
  if (pointsByType instanceof Map) {
    pointsByType.forEach((value, key) => appendEntry(key, value));
  } else if (pointsByType && typeof pointsByType === 'object' && !Array.isArray(pointsByType)) {
    Object.entries(pointsByType).forEach(([key, value]) => appendEntry(key, value));
  }

  if (!entries.length) {
    const fallbackPoints = Array.isArray(route.points) ? route.points : [];
    appendEntry(route.pathType, fallbackPoints);
  }

  return entries.filter((entry) => Array.isArray(entry.points) && entry.points.length);
}

function selectNormalizedPointsForPath(rawPoints, pathType) {
  const normalizedType = normalizePathType(pathType) || PATH_TYPE_BEZIER;

  const extractPoints = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map(sanitizeNormalizedPoint).filter(Boolean);
  };

  if (rawPoints instanceof Map) {
    const points = rawPoints.get(normalizedType);
    if (points) {
      return extractPoints(points);
    }

    for (const [, value] of rawPoints.entries()) {
      if (Array.isArray(value)) {
        const candidate = extractPoints(value);
        if (candidate.length) {
          return candidate;
        }
      }
    }
    return [];
  }

  if (rawPoints && typeof rawPoints === 'object' && !Array.isArray(rawPoints)) {
    const activePoints = extractPoints(rawPoints[normalizedType]);
    if (activePoints.length || Array.isArray(rawPoints[normalizedType])) {
      return activePoints;
    }

    const fallbackTypes = [
      PATH_TYPE_BEZIER,
      PATH_TYPE_HOLLOW_POINT,
      PATH_TYPE_FILLED_POINT,
      PATH_TYPE_RECTANGLE,
    ];

    for (const type of fallbackTypes) {
      if (type === normalizedType) {
        continue;
      }
      const candidate = extractPoints(rawPoints[type]);
      if (candidate.length) {
        return candidate;
      }
    }

    return [];
  }

  if (Array.isArray(rawPoints)) {
    return extractPoints(rawPoints);
  }

  return [];
}

function getRouteId(route) {
  if (!route) {
    return '';
  }

  if (typeof route === 'string') {
    return route.trim();
  }

  if (typeof route === 'number' && Number.isFinite(route)) {
    return String(route);
  }

  if (typeof route !== 'object') {
    return '';
  }

  const candidateValues = [
    route.id,
    route.uid,
    route.routeId,
    route.routeID,
    route.route_id,
    route.slug,
    route.key,
  ];

  for (const candidate of candidateValues) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }

  if (typeof route.toString === 'function') {
    const serialized = String(route).trim();
    if (serialized && serialized !== '[object Object]') {
      return serialized;
    }
  }

  return '';
}

function findRouteById(routeId) {
  if (typeof routeId !== 'string' || !routeId.trim()) {
    return null;
  }

  const normalizedId = routeId.trim();
  const collections = [];

  if (Array.isArray(routes)) {
    collections.push(routes);
  }

  if (Array.isArray(allRoutes)) {
    collections.push(allRoutes);
  }

  for (const collection of collections) {
    const match = collection.find((entry) => getRouteId(entry) === normalizedId);
    if (match) {
      return match;
    }
  }

  return null;
}

function getRouteBetatipsMap(routeId) {
  if (typeof routeId !== 'string' || !routeId.trim()) {
    return new Map();
  }

  const normalizedId = routeId.trim();
  let map = routeBetatipsCache.get(normalizedId);
  if (!(map instanceof Map)) {
    map = new Map();
    routeBetatipsCache.set(normalizedId, map);
  }

  return map;
}

function normalizeRouteScoreEntry(details) {
  const grade = normalizeGradeValue(details?.grade);
  const ascended = details?.ascended === true;

  return {
    grade,
    ascended,
  };
}

function ensureRouteScoresMap(route) {
  if (!route) {
    return null;
  }

  if (route.scores instanceof Map) {
    return route.scores;
  }

  const map = new Map();

  if (Array.isArray(route.scores)) {
    route.scores.forEach((value) => {
      const userId = typeof value?.userId === 'string' ? value.userId.trim() : '';
      if (!userId) {
        return;
      }
      map.set(userId, normalizeRouteScoreEntry(value));
    });
  } else if (route.scores && typeof route.scores === 'object') {
    Object.entries(route.scores).forEach(([key, value]) => {
      if (typeof key === 'string' && key.trim()) {
        map.set(key.trim(), normalizeRouteScoreEntry(value));
      }
    });
  }

  route.scores = map;
  return map;
}

function getRouteScoreEntry(route, userId) {
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
  if (!route || !normalizedUserId) {
    return null;
  }

  const scoresMap = ensureRouteScoresMap(route);
  if (scoresMap instanceof Map) {
    return scoresMap.get(normalizedUserId) ?? null;
  }

  return null;
}

function updateRouteScoreEntry(routeId, userId, details) {
  const normalizedRouteId = typeof routeId === 'string' ? routeId.trim() : '';
  const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';

  if (!normalizedRouteId || !normalizedUserId) {
    return;
  }

  const normalizedEntry = details ? normalizeRouteScoreEntry(details) : null;

  const applyUpdate = (collection) => {
    if (!Array.isArray(collection)) {
      return;
    }

    collection.forEach((route) => {
      if (getRouteId(route) !== normalizedRouteId) {
        return;
      }

      const scoresMap = ensureRouteScoresMap(route);
      if (!(scoresMap instanceof Map)) {
        return;
      }

      if (normalizedEntry) {
        scoresMap.set(normalizedUserId, normalizedEntry);
      } else {
        scoresMap.delete(normalizedUserId);
      }
    });
  };

  applyUpdate(routes);
  if (allRoutes !== routes) {
    applyUpdate(allRoutes);
  }
}

function extractNumericGradesFromScoresMap(scoresMap) {
  const grades = [];

  const appendGrade = (candidate) => {
    const sourceValue =
      candidate && typeof candidate === 'object' ? candidate.grade : candidate;
    const gradeValue = normalizeGradeValue(sourceValue);
    if (typeof gradeValue === 'number' && Number.isFinite(gradeValue)) {
      grades.push(gradeValue);
    }
  };

  if (scoresMap instanceof Map) {
    scoresMap.forEach((value) => {
      appendGrade(value);
    });
    return grades;
  }

  if (Array.isArray(scoresMap)) {
    scoresMap.forEach((value) => {
      appendGrade(value);
    });
    return grades;
  }

  if (scoresMap && typeof scoresMap === 'object') {
    Object.values(scoresMap).forEach((value) => {
      appendGrade(value);
    });
  }

  return grades;
}

function computeMedianGrade(grades) {
  if (!Array.isArray(grades) || grades.length === 0) {
    return null;
  }

  const sorted = grades.slice().sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint];
  }

  return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function computeMedianGradeFromRouteScores(scores) {
  return computeMedianGrade(extractNumericGradesFromScoresMap(scores));
}

function computeMedianGradeForRoute(routeId) {
  if (!routeId) {
    return null;
  }

  const directRoute = findRouteById(routeId);
  if (directRoute) {
    return computeMedianGradeFromRouteScores(directRoute.scores);
  }

  return null;
}

async function loadBetatipUpvotes(betatipId) {
  if (typeof betatipId !== 'string' || !betatipId.trim()) {
    return new Set();
  }

  try {
    const snapshot = await getDocs(
      collection(db, 'routes_users_betatips', betatipId.trim(), 'upvotes'),
    );

    const upvoters = new Set();
    snapshot.forEach((docSnap) => {
      if (typeof docSnap.id === 'string' && docSnap.id.trim()) {
        upvoters.add(docSnap.id.trim());
      }
    });

    return upvoters;
  } catch (error) {
    console.error('Failed to load beta tip upvotes:', error);
    return new Set();
  }
}

function normalizeBetatipCacheValue(value, fallbackKey = '') {
  const fallback = typeof fallbackKey === 'string' ? fallbackKey.trim() : '';

  if (!value) {
    return {
      betatipId: fallback,
      userId: fallback,
      username: '',
      text: '',
      upvoters: new Set(),
      upvoteCount: 0,
    };
  }

  if (typeof value === 'string') {
    const text = value.replace(/\r\n/g, '\n').trim();
    return {
      betatipId: fallback,
      userId: fallback,
      username: '',
      text,
      upvoters: new Set(),
      upvoteCount: 0,
    };
  }

  if (typeof value === 'object') {
    const rawText =
      typeof value.betatip === 'string'
        ? value.betatip
        : typeof value.text === 'string'
        ? value.text
        : '';
    const text = rawText.replace(/\r\n/g, '\n').trim();
    const upvoteSource =
      value.upvoters instanceof Set || Array.isArray(value.upvoters)
        ? value.upvoters
        : value.betatipUpvotes ?? value.betatipupvotes;
    const upvoters = normalizeUpvoteList(upvoteSource);
    const normalizedUsername = isValidUsername(value.username)
      ? normalizeUsername(value.username)
      : '';
    const userId =
      typeof value.userId === 'string' && value.userId.trim()
        ? value.userId.trim()
        : fallback;
    const betatipId =
      typeof value.betatipId === 'string' && value.betatipId.trim()
        ? value.betatipId.trim()
        : fallback;
    const recordedCount =
      typeof value.upvoteCount === 'number' && Number.isFinite(value.upvoteCount)
        ? value.upvoteCount
        : upvoters.size;

    return {
      betatipId,
      userId,
      username: normalizedUsername,
      text,
      upvoters,
      upvoteCount: recordedCount,
    };
  }

  return {
    betatipId: fallback,
    userId: fallback,
    username: '',
    text: '',
    upvoters: new Set(),
    upvoteCount: 0,
  };
}

function formatGradeDisplay(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || '—';
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function resolveTooltipGradeValue(route) {
  if (!route) {
    return null;
  }

  const directMedian = computeMedianGradeFromRouteScores(route?.scores);
  if (typeof directMedian === 'number' && Number.isFinite(directMedian)) {
    return directMedian;
  }

  const routeId = getRouteId(route);
  const medianGrade = computeMedianGradeForRoute(routeId);
  return typeof medianGrade === 'number' && Number.isFinite(medianGrade)
    ? medianGrade
    : null;
}

function resolveProgressionGradeValue(route) {
  if (!route) {
    return null;
  }

  const directMedian = computeMedianGradeFromRouteScores(route?.scores);
  if (typeof directMedian === 'number' && Number.isFinite(directMedian)) {
    return directMedian;
  }

  const routeId = getRouteId(route);
  const medianGrade = computeMedianGradeForRoute(routeId);
  return typeof medianGrade === 'number' && Number.isFinite(medianGrade)
    ? medianGrade
    : null;
}

function renderProgressionList() {
  if (!progressionList) {
    return;
  }

  progressionList.innerHTML = '';

  const desiredLocation = normalizeLocationName(currentLocation?.name);
  const fallbackLocation = normalizeLocationName(getDefaultLocation()?.name);
  const targetLocation = desiredLocation || fallbackLocation || null;

  const relevantRoutes = Array.isArray(routes)
    ? routes.filter((route) => {
        if (!route) {
          return false;
        }

        if (!targetLocation) {
          return true;
        }

        const routeLocationKey =
          typeof route.locationKey === 'string' && route.locationKey
            ? route.locationKey
            : normalizeLocationName(route.location);

        return routeLocationKey === targetLocation;
      })
    : [];

  if (!relevantRoutes.length) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'progression-empty-message';
    emptyMessage.textContent = 'No routes available for this wall yet.';
    progressionList.appendChild(emptyMessage);
    return;
  }

  const sorted = relevantRoutes.slice().sort((routeA, routeB) => {
    const gradeA = resolveProgressionGradeValue(routeA);
    const gradeB = resolveProgressionGradeValue(routeB);

    const numberA =
      typeof gradeA === 'number' && Number.isFinite(gradeA) ? gradeA : null;
    const numberB =
      typeof gradeB === 'number' && Number.isFinite(gradeB) ? gradeB : null;

    if (numberA !== null || numberB !== null) {
      if (numberA === null) {
        return 1;
      }

      if (numberB === null) {
        return -1;
      }

      if (numberA !== numberB) {
        return numberA - numberB;
      }
    }

    const stringA = typeof gradeA === 'string' && gradeA ? gradeA : null;
    const stringB = typeof gradeB === 'string' && gradeB ? gradeB : null;

    if (stringA || stringB) {
      if (!stringA) {
        return 1;
      }

      if (!stringB) {
        return -1;
      }

      const compare = stringA.localeCompare(stringB, undefined, { sensitivity: 'base' });
      if (compare !== 0) {
        return compare;
      }
    }

    const nameA = (routeA.title || routeA.id || '').toLowerCase();
    const nameB = (routeB.title || routeB.id || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  sorted.forEach((route) => {
    if (!route) {
      return;
    }

    const listItem = document.createElement('div');
    listItem.className = 'progression-entry';
    listItem.setAttribute('role', 'listitem');
    listItem.setAttribute('tabindex', '0');

    if (route.id) {
      listItem.dataset.routeId = route.id;
    }

    const isFocused = typeof route.id === 'string' && route.id === focusedRouteId;
    if (isFocused) {
      listItem.classList.add('is-focused');
      listItem.setAttribute('aria-current', 'true');
    }

    const grade = document.createElement('span');
    grade.className = 'progression-entry-grade';
    const gradeValue = resolveProgressionGradeValue(route);
    grade.textContent = formatGradeDisplay(gradeValue);

    const gradeColor = getRouteGradeColor(route);
    if (gradeColor) {
      grade.style.color = gradeColor;
    }

    listItem.appendChild(grade);

    const details = document.createElement('div');
    const title = document.createElement('span');
    title.className = 'progression-entry-name';
    title.textContent = route.title || route.id || 'Untitled route';

    if (gradeColor) {
      title.style.color = gradeColor;
    }

    details.appendChild(title);
    listItem.appendChild(details);

    const status = document.createElement('span');
    status.className = 'progression-entry-status';
    const isAscended = Boolean(route.id && ascendedRoutes.has(route.id));

    if (isAscended) {
      status.textContent = '✓';
      status.classList.add('is-ascended');
      status.setAttribute('aria-label', 'Ascended');
      status.setAttribute('title', 'Ascended');
    } else {
      status.textContent = '';
      status.setAttribute('aria-hidden', 'true');
    }

    listItem.appendChild(status);

    listItem.addEventListener('click', (event) => {
      event.preventDefault();
      focusRoute(route);
    });

    listItem.addEventListener('keydown', (event) => {
      const { key } = event;
      if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        focusRoute(route);
      }
    });

    progressionList.appendChild(listItem);
  });
}

function isProgressionModalOpen() {
  if (!progressionModal) {
    return false;
  }

  return !progressionModal.classList.contains('hidden');
}

function closeProgressionModal() {
  if (!progressionModal) {
    return;
  }

  progressionModal.classList.add('hidden');
  progressionModal.setAttribute('aria-hidden', 'true');

  if (progressionButton) {
    progressionButton.setAttribute('aria-expanded', 'false');
  }

  document.removeEventListener('keydown', handleProgressionKeydown, true);

  if (progressionPreviouslyFocusedElement && typeof progressionPreviouslyFocusedElement.focus === 'function') {
    progressionPreviouslyFocusedElement.focus();
  }
  progressionPreviouslyFocusedElement = null;
}

function handleProgressionKeydown(event) {
  if (event.key === 'Escape' && isProgressionModalOpen()) {
    event.preventDefault();
    closeProgressionModal();
  }
}

function openProgressionModal() {
  if (!progressionModal) {
    return;
  }

  renderProgressionList();

  progressionPreviouslyFocusedElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  progressionModal.classList.remove('hidden');
  progressionModal.setAttribute('aria-hidden', 'false');

  if (progressionButton) {
    progressionButton.setAttribute('aria-expanded', 'true');
  }

  document.addEventListener('keydown', handleProgressionKeydown, true);

  const focusTarget =
    progressionModalClose && typeof progressionModalClose.focus === 'function'
      ? progressionModalClose
      : progressionModal;
  focusTarget.focus();
}

function getUserGradeForRoute(routeId) {
  if (!routeId) {
    return null;
  }

  const ascent = userAscentDetails.get(routeId);
  const grade = ascent?.grade;
  return typeof grade === 'number' && Number.isFinite(grade) ? grade : null;
}

function createTooltipCloseButton() {
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'tooltip-close-button';
  closeButton.setAttribute('aria-label', 'Close route details');
  closeButton.setAttribute('title', 'Close route details');
  closeButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6.34 6.34a1 1 0 0 1 1.32-.08l.1.08L12 10.59l4.24-4.25a1 1 0 0 1 1.5 1.32l-.08.1L13.41 12l4.25 4.24a1 1 0 0 1-1.32 1.5l-.1-.08L12 13.41l-4.24 4.25a1 1 0 0 1-1.5-1.32l.08-.1L10.59 12 6.34 7.76a1 1 0 0 1 0-1.42Z"
        fill="currentColor"
      />
    </svg>
  `;
  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideTooltip({ force: true });
  });
  return closeButton;
}

function shouldBlockSingleClick(event) {
  const pointerType = lastPrimaryPointerType;
  const isTouchLike = pointerType === 'touch' || pointerType === 'pen';
  const isKeyboardActivation = event?.detail === 0;

  if (isTouchLike || isKeyboardActivation) {
    return false;
  }

  if (!event || typeof event.detail !== 'number' || event.detail < 2) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    return true;
  }
  return false;
}

function buildGradeControls(route) {
  if (!route || !route.id) {
    return null;
  }

  const container = document.createElement('div');
  container.className = 'grade-section';

  const gradeForm = document.createElement('form');
  gradeForm.className = 'grade-form';
  gradeForm.noValidate = true;

  const gradeLabel = document.createElement('label');
  const labelText = document.createElement('span');
  labelText.textContent = `Your grade (${MIN_GRADE_VALUE}-${MAX_GRADE_VALUE})`;
  gradeLabel.appendChild(labelText);

  const gradeInput = document.createElement('input');
  gradeInput.type = 'number';
  gradeInput.min = String(MIN_GRADE_VALUE);
  gradeInput.max = String(MAX_GRADE_VALUE);
  gradeInput.step = '1';
  gradeInput.inputMode = 'numeric';
  const existingGrade = getUserGradeForRoute(route.id);
  gradeInput.value = existingGrade !== null ? String(existingGrade) : '';
  gradeInput.placeholder = '—';
  gradeInput.dataset.infoTarget = 'route-grade';

  gradeLabel.appendChild(gradeInput);

  gradeInput.readOnly = true;
  gradeInput.classList.add('requires-double-click');

  gradeInput.addEventListener(
    'mousedown',
    (event) => {
      if (shouldBlockSingleClick(event)) {
        return;
      }
    },
    true,
  );

  gradeInput.addEventListener('click', (event) => {
    if (shouldBlockSingleClick(event)) {
      if (document.activeElement === gradeInput) {
        gradeInput.blur();
      }
      return;
    }
    gradeInput.readOnly = false;
    gradeInput.focus();
    gradeInput.select();
  });

  const gradeInputRow = document.createElement('div');
  gradeInputRow.className = 'grade-input-row';
  gradeInputRow.appendChild(gradeLabel);

  gradeForm.appendChild(gradeInputRow);

  let isSubmittingGrade = false;
  let lastSubmittedValue = gradeInput.value.trim();

  const commitGradeFromInput = async () => {
    if (isSubmittingGrade) {
      return;
    }

    const rawValue = gradeInput.value.trim();
    if (rawValue === lastSubmittedValue) {
      return;
    }

    isSubmittingGrade = true;

    try {
      if (!rawValue) {
        gradeInput.setCustomValidity('');
        await applyUserRouteGrade(route, null);
        lastSubmittedValue = '';
        gradeInput.value = '';
        return;
      }

      const parsed = normalizeGradeValue(rawValue);
      if (parsed === null) {
        gradeInput.setCustomValidity(
          `Enter a whole number between ${MIN_GRADE_VALUE} and ${MAX_GRADE_VALUE}.`,
        );
        gradeInput.reportValidity();
        return;
      }

      gradeInput.setCustomValidity('');
      await applyUserRouteGrade(route, parsed);
      lastSubmittedValue = String(parsed);
      gradeInput.value = String(parsed);
    } finally {
      isSubmittingGrade = false;
    }
  };

  gradeInput.addEventListener('input', () => {
    gradeInput.setCustomValidity('');
  });

  gradeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      gradeForm.requestSubmit();
    }
  });

  gradeInput.addEventListener('blur', () => {
    gradeInput.readOnly = true;
    void commitGradeFromInput();
  });

  gradeForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await commitGradeFromInput();
  });

  container.appendChild(gradeForm);

  return container;
}

function buildBetatipsSection(route, ariaLines = []) {
  if (!route || !route.id) {
    return null;
  }

  const betatipsMap = getRouteBetatipsMap(route.id);
  const currentUid = typeof currentUser?.uid === 'string' ? currentUser.uid.trim() : '';
  const entries = [];
  const rewrittenEntries = [];
  let needsRewrite = false;

  if (betatipsMap instanceof Map) {
    betatipsMap.forEach((value, key) => {
      const normalized = normalizeBetatipCacheValue(value, key);
      const text = normalized.text;
      if (!text) {
        needsRewrite = true;
        return;
      }

      const betatipId = normalized.betatipId || (typeof key === 'string' ? key.trim() : '');
      const userId = normalized.userId || (typeof key === 'string' ? key.trim() : '');
      const upvoteSet = normalized.upvoters instanceof Set ? normalized.upvoters : new Set();
      const upvoteCount =
        typeof normalized.upvoteCount === 'number' && Number.isFinite(normalized.upvoteCount)
          ? normalized.upvoteCount
          : upvoteSet.size;
      const hasUpvoted = currentUid ? upvoteSet.has(currentUid) : false;
      const isCurrent = currentUid ? userId === currentUid : false;
      const normalizedUsername = isValidUsername(normalized.username)
        ? normalizeUsername(normalized.username)
        : '';
      const displayName = normalizedUsername
        ? `User ${normalizedUsername}`
        : 'Anonymous climber';

      entries.push({
        betatipId: betatipId || userId || '',
        userId,
        username: displayName,
        text,
        isCurrent,
        upvoteCount,
        hasUpvoted,
      });

      const nextKey = betatipId || userId || (typeof key === 'string' ? key.trim() : '');
      rewrittenEntries.push({
        key: nextKey,
        value: {
          betatipId: nextKey,
          userId,
          username: normalizedUsername,
          betatip: text,
          upvoters: upvoteSet,
          upvoteCount,
        },
      });

      if (
        typeof key !== 'string' ||
        !key.trim() ||
        nextKey !== key.trim() ||
        typeof value !== 'object' ||
        value.betatip !== text ||
        value.userId !== userId ||
        !(value.upvoters instanceof Set)
      ) {
        needsRewrite = true;
      }
    });
  }

  if (needsRewrite && betatipsMap instanceof Map) {
    betatipsMap.clear();
    rewrittenEntries.forEach(({ key, value }) => {
      if (typeof key === 'string' && key.trim()) {
        betatipsMap.set(key.trim(), value);
      }
    });
  }

  entries.sort((a, b) => {
    if (b.upvoteCount !== a.upvoteCount) {
      return b.upvoteCount - a.upvoteCount;
    }

    const nameComparison = a.username.localeCompare(b.username);
    if (nameComparison !== 0) {
      return nameComparison;
    }

    return a.text.localeCompare(b.text);
  });

  const section = document.createElement('section');
  section.className = 'tooltip-betatips';

  const heading = document.createElement('h3');
  heading.className = 'tooltip-betatips-heading';
  heading.textContent = 'Beta tips';
  section.appendChild(heading);

  if (Array.isArray(ariaLines)) {
    ariaLines.push('Beta tips');
  }

  const list = document.createElement('div');
  list.className = 'tooltip-betatips-list';

  if (entries.length) {
    entries.forEach(({ betatipId, userId, username, text, isCurrent, upvoteCount, hasUpvoted }) => {
      const entry = document.createElement('article');
      entry.className = 'betatip-entry';
      if (isCurrent) {
        entry.classList.add('is-current-user');
      }

      if (typeof betatipId === 'string' && betatipId) {
        entry.dataset.betatipId = betatipId;
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'betatip-username';
      nameEl.textContent = isCurrent ? `${username} (you)` : username;
      entry.appendChild(nameEl);

      const body = document.createElement('div');
      body.className = 'betatip-body';

      const countWrapper = document.createElement('span');
      countWrapper.className = 'betatip-upvote-count';
      const displayCount = upvoteCount > 0 ? String(upvoteCount) : '—';
      countWrapper.textContent = displayCount;
      countWrapper.setAttribute('aria-hidden', 'true');
      body.appendChild(countWrapper);

      const countSr = document.createElement('span');
      countSr.className = 'sr-only';
      let countMessage = '';
      if (upvoteCount === 0) {
        countMessage = 'No upvotes yet';
      } else if (upvoteCount === 1) {
        countMessage = '1 upvote';
      } else {
        countMessage = `${upvoteCount} upvotes`;
      }
      if (hasUpvoted) {
        countMessage = `${countMessage}. You upvoted this beta tip.`;
      }
      countSr.textContent = countMessage;
      body.appendChild(countSr);

      const textEl = document.createElement('p');
      textEl.className = 'betatip-text';
      textEl.textContent = text;
      body.appendChild(textEl);

      const actions = document.createElement('div');
      actions.className = 'betatip-actions';

      const upvoteButton = document.createElement('button');
      upvoteButton.type = 'button';
      upvoteButton.className = 'betatip-upvote-button';
      upvoteButton.setAttribute('aria-pressed', hasUpvoted ? 'true' : 'false');
      if (hasUpvoted) {
        upvoteButton.classList.add('is-upvoted');
      }

      const icon = document.createElement('span');
      icon.className = 'betatip-upvote-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '👍';
      if (hasUpvoted) {
        icon.classList.add('is-upvoted');
      }
      upvoteButton.appendChild(icon);

      const srLabel = document.createElement('span');
      srLabel.className = 'sr-only';
      if (!currentUser) {
        srLabel.textContent = 'Sign in to upvote beta tips.';
        upvoteButton.disabled = true;
        upvoteButton.title = 'Sign in to upvote beta tips';
      } else if (isCurrent) {
        srLabel.textContent = 'You cannot upvote your own beta tip.';
        upvoteButton.disabled = true;
        upvoteButton.title = 'You cannot upvote your own beta tip';
      } else if (hasUpvoted) {
        srLabel.textContent = `Remove your upvote from ${username}'s beta tip.`;
        upvoteButton.title = 'Remove your upvote';
      } else {
        srLabel.textContent = `Upvote ${username}'s beta tip.`;
        upvoteButton.title = 'Upvote this beta tip';
      }
      upvoteButton.appendChild(srLabel);

      if (currentUser && !isCurrent) {
        let isProcessingUpvote = false;
        upvoteButton.addEventListener('click', async (event) => {
          if (shouldBlockSingleClick(event)) {
            return;
          }
          event.preventDefault();
          if (isProcessingUpvote) {
            return;
          }

          isProcessingUpvote = true;
          upvoteButton.disabled = true;

          try {
            const scrollContainer = tooltip?.querySelector('.tooltip-content');
            const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
            await toggleBetatipUpvote(route, betatipId);
            if (tooltip) {
              updateTooltipContent(route);
              const nextScrollContainer = tooltip.querySelector('.tooltip-content');
              if (nextScrollContainer) {
                nextScrollContainer.scrollTop = previousScrollTop;
              }
            }
          } catch (error) {
            console.error('Failed to update beta tip upvote:', error);
          } finally {
            isProcessingUpvote = false;
          }
        });
      }

      actions.appendChild(upvoteButton);

      if (currentUser && isCurrent && typeof betatipId === 'string' && betatipId) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'betatip-delete-button';
        deleteButton.textContent = 'Delete tip';
        deleteButton.setAttribute('aria-label', 'Delete your beta tip');

        let isDeleting = false;
        deleteButton.addEventListener('click', async (event) => {
          if (shouldBlockSingleClick(event)) {
            return;
          }
          event.preventDefault();
          if (isDeleting) {
            return;
          }

          isDeleting = true;
          deleteButton.disabled = true;

          try {
            const scrollContainer = tooltip?.querySelector('.tooltip-content');
            const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
            await deleteBetatipForRoute(route, betatipId);
            if (tooltip) {
              updateTooltipContent(route);
              const nextScrollContainer = tooltip.querySelector('.tooltip-content');
              if (nextScrollContainer) {
                nextScrollContainer.scrollTop = previousScrollTop;
              }
            }
          } catch (error) {
            console.error('Failed to delete beta tip:', error);
            deleteButton.disabled = false;
            isDeleting = false;
          }
        });

        actions.appendChild(deleteButton);
      }

      if (actions.childElementCount > 0) {
        body.appendChild(actions);
      }

      entry.appendChild(body);

      list.appendChild(entry);

      if (Array.isArray(ariaLines)) {
        const upvoteSummary =
          upvoteCount === 0
            ? 'no upvotes'
            : upvoteCount === 1
            ? '1 upvote'
            : `${upvoteCount} upvotes`;
        const ariaText = text.replace(/\s+/g, ' ').trim();
        ariaLines.push(
          `Beta from ${username}${isCurrent ? ' (you)' : ''}: ${ariaText} (${upvoteSummary})`,
        );
      }
    });
  } else {
    const empty = document.createElement('p');
    empty.className = 'tooltip-betatips-empty';
    const emptyMessage = currentUser
      ? 'No beta tips yet. Share yours below.'
      : 'No beta tips yet.';
    empty.textContent = emptyMessage;
    list.appendChild(empty);
    if (Array.isArray(ariaLines)) {
      ariaLines.push('No beta tips yet.');
    }
  }

  section.appendChild(list);

  if (currentUser) {
    const form = document.createElement('form');
    form.className = 'tooltip-betatips-form';
    form.noValidate = true;

    const textareaId = `betatip-${route.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const label = document.createElement('label');
    label.className = 'tooltip-betatips-label';
    label.setAttribute('for', textareaId);

    const labelText = document.createElement('span');
    labelText.textContent = 'Share your beta';
    label.appendChild(labelText);

    const textarea = document.createElement('textarea');
    textarea.id = textareaId;
    textarea.className = 'tooltip-betatips-textarea';
    textarea.maxLength = MAX_BETATIP_LENGTH;
    textarea.placeholder = 'The trick is...to go up!';
    textarea.value = '';
    textarea.readOnly = true;
    textarea.classList.add('requires-double-click');

    textarea.addEventListener(
      'mousedown',
      (event) => {
        if (shouldBlockSingleClick(event)) {
          return;
        }
      },
      true,
    );

    textarea.addEventListener('click', (event) => {
      if (shouldBlockSingleClick(event)) {
        if (document.activeElement === textarea) {
          textarea.blur();
        }
        return;
      }
      textarea.readOnly = false;
      textarea.focus();
      textarea.select();
    });

    textarea.addEventListener('blur', () => {
      textarea.readOnly = true;
    });

    label.appendChild(textarea);
    form.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'tooltip-betatips-actions';

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.textContent = 'Save tip';
    actions.appendChild(saveButton);

    saveButton.addEventListener(
      'click',
      (event) => {
        if (shouldBlockSingleClick(event)) {
          return;
        }
      },
      true,
    );

    form.appendChild(actions);

    const status = document.createElement('p');
    status.className = 'tooltip-betatips-status';
    status.setAttribute('role', 'status');
    status.textContent = '';
    form.appendChild(status);

    const setSavingState = (saving) => {
      textarea.disabled = saving;
      saveButton.disabled = saving;
    };

    textarea.addEventListener('input', () => {
      status.textContent = '';
    });

    let isSaving = false;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (isSaving) {
        return;
      }

      const trimmedValue = textarea.value.replace(/\r\n/g, '\n').trim();
      if (!trimmedValue) {
        status.textContent = 'Add some beta before saving.';
        return;
      }

      status.textContent = '';
      isSaving = true;
      setSavingState(true);

      try {
        const scrollContainer = tooltip?.querySelector('.tooltip-content');
        const previousScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
        await saveBetatipForRoute(route, trimmedValue);
        if (tooltip) {
          updateTooltipContent(route);
          const nextScrollContainer = tooltip.querySelector('.tooltip-content');
          if (nextScrollContainer) {
            nextScrollContainer.scrollTop = previousScrollTop;
          }
        }
      } catch (error) {
        console.error('Failed to save beta tip:', error);
        status.textContent = 'We couldn’t save your beta. Please try again.';
        setSavingState(false);
        isSaving = false;
      }
    });

    section.appendChild(form);
  }

  return section;
}

async function applyUserRouteGrade(route, gradeValue) {
  const routeId = typeof route?.id === 'string' ? route.id.trim() : '';
  if (!routeId) {
    return;
  }

  if (!currentUser) {
    console.warn('Unable to save grade: no authenticated user.');
    return;
  }

  const userId = typeof currentUser.uid === 'string' ? currentUser.uid.trim() : '';
  if (!userId) {
    console.warn('Unable to save grade: user ID missing.');
    return;
  }

  const sanitizedGrade = gradeValue === null ? null : normalizeGradeValue(gradeValue);
  if (sanitizedGrade === null && gradeValue !== null) {
    console.warn('Unable to save grade: invalid grade value provided.');
    return;
  }

  const routeRef = doc(db, 'routes', routeId, 'scores', userId);
  const isAscended = ascendedRoutes.has(routeId);

  try {
    const userPayload = {
      grade: sanitizedGrade,
      ascended: isAscended,
    };

    await setDoc(routeRef, userPayload, { merge: true });

    const existingEntry = userAscentDetails.get(routeId) || {};

    if (sanitizedGrade === null) {
      const hadRecordedGrade =
        typeof existingEntry.grade === 'number' && Number.isFinite(existingEntry.grade);

      if (existingEntry.ascended || hadRecordedGrade) {
        userAscentDetails.set(routeId, { ...existingEntry, ascended: isAscended, grade: null });
      } else {
        userAscentDetails.delete(routeId);
      }
    } else {
      const nextEntry = { ...existingEntry, ascended: isAscended, grade: sanitizedGrade };
      userAscentDetails.set(routeId, nextEntry);
    }

    updateRouteScoreEntry(routeId, userId, userPayload);

    synchroniseAscentsWithRoutes({ shouldRedraw: false });
    updateTooltipContent(route);
  } catch (error) {
    console.error('Failed to update route grade:', error);
  }
}

async function saveBetatipForRoute(route, rawText) {
  if (!currentUser) {
    throw new Error('You must be signed in to share beta tips.');
  }

  const routeId = typeof route?.id === 'string' ? route.id.trim() : '';
  if (!routeId) {
    throw new Error('Unable to determine which route to update.');
  }

  const userId = typeof currentUser.uid === 'string' ? currentUser.uid.trim() : '';
  if (!userId) {
    throw new Error('Unable to determine your account.');
  }

  let username = '';
  try {
    username = await lookupUsernameByUid(currentUser.uid);
  } catch (error) {
    console.error('Failed to fetch username for betatip save:', error);
  }

  if (!isValidUsername(username)) {
    const resolved = await resolveAuthenticatedUsername();
    if (isValidUsername(resolved)) {
      username = normalizeUsername(resolved);
    }
  } else {
    username = normalizeUsername(username);
  }

  if (!isValidUsername(username)) {
    throw new Error('Unable to resolve your username.');
  }

  currentUsername = username;
  uidUsernameCache.set(userId, username);

  const normalizedText = typeof rawText === 'string' ? rawText.replace(/\r\n/g, '\n').trim() : '';
  if (!normalizedText) {
    throw new Error('Beta tip text is required.');
  }

  const limitedText = normalizedText.slice(0, MAX_BETATIP_LENGTH);
  const betatipsMap = getRouteBetatipsMap(routeId);

  const betatipData = {
    routeId,
    userId,
    betatip: limitedText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    upvoteCount: 0,
  };

  let betatipId = '';
  try {
    const betatipRef = await addDoc(collection(db, 'routes_users_betatips'), betatipData);
    betatipId = betatipRef.id;
  } catch (error) {
    console.error('Failed to save beta tip:', error);
    throw new Error('Unable to save your beta tip right now.');
  }

  const newEntry = {
    betatipId,
    userId,
    username,
    betatip: limitedText,
    upvoters: new Set(),
    upvoteCount: 0,
  };

  betatipsMap.set(betatipId, newEntry);

  [allRoutes, routes].forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }

    collection.forEach((entry) => {
      if (entry && entry.id === routeId) {
        entry.betatips = betatipsMap;
      }
    });
  });

  return limitedText;
}

async function toggleBetatipUpvote(route, betatipId) {
  if (!currentUser) {
    throw new Error('You must be signed in to upvote beta tips.');
  }

  const routeId = typeof route?.id === 'string' ? route.id.trim() : '';
  if (!routeId) {
    throw new Error('Unable to determine which route to update.');
  }

  const voterId = typeof currentUser.uid === 'string' ? currentUser.uid.trim() : '';
  if (!voterId) {
    throw new Error('Unable to determine your account.');
  }

  const normalizedBetatipId = typeof betatipId === 'string' ? betatipId.trim() : '';
  if (!normalizedBetatipId) {
    throw new Error('We could not determine which beta tip to upvote.');
  }

  const betatipsMap = getRouteBetatipsMap(routeId);
  const targetEntry =
    betatipsMap instanceof Map ? betatipsMap.get(normalizedBetatipId) : null;

  if (!targetEntry) {
    throw new Error('This beta tip is no longer available.');
  }

  if (targetEntry.userId === voterId) {
    throw new Error('You cannot upvote your own beta tip.');
  }

  const betatipRef = doc(db, 'routes_users_betatips', targetEntry.betatipId);
  const upvoteRef = doc(betatipRef, 'upvotes', voterId);
  const upvoters = targetEntry.upvoters instanceof Set ? new Set(targetEntry.upvoters) : new Set();
  const alreadyUpvoted = upvoters.has(voterId);

  try {
    if (alreadyUpvoted) {
      await deleteDoc(upvoteRef);
      upvoters.delete(voterId);
    } else {
      await setDoc(upvoteRef, { createdAt: serverTimestamp() });
      upvoters.add(voterId);
    }
  } catch (error) {
    console.error('Failed to update beta tip upvote:', error);
    throw new Error('Unable to update the beta tip upvote right now.');
  }

  const updatedEntry = {
    ...targetEntry,
    upvoters,
    upvoteCount: upvoters.size,
  };

  betatipsMap.set(normalizedBetatipId, updatedEntry);

  [allRoutes, routes].forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }

    collection.forEach((entry) => {
      if (entry && entry.id === routeId) {
        entry.betatips = betatipsMap;
      }
    });
  });

  return {
    hasUpvoted: !alreadyUpvoted,
    upvoteCount: updatedEntry.upvoteCount,
  };
}

async function deleteBetatipForRoute(route, betatipId) {
  if (!currentUser) {
    throw new Error('You must be signed in to delete beta tips.');
  }

  const routeId = typeof route?.id === 'string' ? route.id.trim() : '';
  if (!routeId) {
    throw new Error('Unable to determine which route to update.');
  }

  const userId = typeof currentUser.uid === 'string' ? currentUser.uid.trim() : '';
  if (!userId) {
    throw new Error('Unable to determine your account.');
  }

  const normalizedBetatipId = typeof betatipId === 'string' ? betatipId.trim() : '';
  if (!normalizedBetatipId) {
    throw new Error('We could not determine which beta tip to delete.');
  }

  const betatipsMap = getRouteBetatipsMap(routeId);
  const existingEntry =
    betatipsMap instanceof Map ? betatipsMap.get(normalizedBetatipId) : null;

  if (!existingEntry) {
    throw new Error('This beta tip is no longer available.');
  }

  if (existingEntry.userId !== userId) {
    throw new Error('You can only delete your own beta tips.');
  }

  try {
    const betatipRef = doc(db, 'routes_users_betatips', normalizedBetatipId);
    if (existingEntry.upvoters instanceof Set && existingEntry.upvoters.size) {
      await Promise.all(
        Array.from(existingEntry.upvoters).map((voter) =>
          deleteDoc(doc(betatipRef, 'upvotes', voter)),
        ),
      );
    }

    await deleteDoc(betatipRef);
  } catch (error) {
    console.error('Failed to delete beta tip:', error);
    throw new Error('Unable to delete this beta tip right now.');
  }

  betatipsMap.delete(normalizedBetatipId);

  [allRoutes, routes].forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }

    collection.forEach((entry) => {
      if (entry && entry.id === routeId) {
        entry.betatips = betatipsMap;
      }
    });
  });

  return true;
}

function updateTooltipContent(route) {
  if (!tooltip) {
    return;
  }

  applyTooltipColorScheme(route);

  const fragment = document.createDocumentFragment();
  const ariaLines = [];

  const header = document.createElement('div');
  header.className = 'tooltip-header';
  header.appendChild(createTooltipCloseButton());

  const displayTitle = (route.title || route.id || '').trim();
  const titleLine = document.createElement('strong');
  titleLine.className = 'tooltip-title';
  titleLine.textContent = displayTitle || 'Route details';
  header.appendChild(titleLine);
  fragment.appendChild(header);
  if (titleLine.textContent) {
    ariaLines.push(titleLine.textContent);
  }

  const tooltipGrade = resolveTooltipGradeValue(route);
  const gradeDisplay = formatGradeDisplay(tooltipGrade);
  const gradeBadge = document.createElement('div');
  gradeBadge.className = 'tooltip-grade-badge';
  gradeBadge.setAttribute('aria-hidden', 'true');
  gradeBadge.setAttribute('data-grade', gradeDisplay);
  const gradeValue = document.createElement('span');
  gradeValue.className = 'tooltip-grade-value';
  gradeValue.textContent = gradeDisplay;
  gradeBadge.appendChild(gradeValue);
  const isAscended = Boolean(route && ascendedRoutes.has(route.id));
  if (isAscended) {
    gradeBadge.classList.add('ascended');
  }
  const gradeStrokeWidth = Math.max(2, Math.round(calculateRouteStrokeWidth(route)) || 2);
  gradeBadge.style.setProperty('--tooltip-grade-stroke-width', `${gradeStrokeWidth}px`);
  tooltip.style.setProperty('--tooltip-grade-stroke-width', `${gradeStrokeWidth}px`);
  const gradeCluster = document.createElement('div');
  gradeCluster.className = 'tooltip-grade-cluster';
  gradeCluster.appendChild(gradeBadge);

  let gradeControls = null;
  let actionsContainer = null;

  if (currentUser) {
    gradeControls = buildGradeControls(route);

    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'tooltip-action-button ascend-toggle';
    actionButton.setAttribute('aria-pressed', isAscended ? 'true' : 'false');
    actionButton.textContent = isAscended ? 'Ascended' : 'Not ascended';
    actionButton.dataset.infoTarget = 'route-ascent';
    actionButton.addEventListener('click', (event) => {
      if (shouldBlockSingleClick(event)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      toggleRouteAscent(route);
    });

    actionsContainer = document.createElement('div');
    actionsContainer.className = 'tooltip-actions';
    actionsContainer.appendChild(actionButton);
  }

  ariaLines.push(`Grade: ${gradeDisplay}`);
  ariaLines.push(isAscended ? 'Ascended' : 'Not ascended');

  const infoContainer = document.createElement('div');
  infoContainer.className = 'tooltip-lines';

  const topSection = document.createElement('div');
  topSection.className = 'tooltip-top-section';
  topSection.appendChild(infoContainer);
  topSection.appendChild(gradeCluster);
  fragment.appendChild(topSection);

  const appendInfoLine = (text, className = '') => {
    if (!text) {
      return;
    }
    const line = document.createElement('div');
    line.className = className ? `tooltip-line ${className}` : 'tooltip-line';
    line.textContent = text;
    infoContainer.appendChild(line);
    ariaLines.push(text);
  };

  const setterValue = typeof route.setter === 'string' ? route.setter : '';
  appendInfoLine(`Setter: ${setterValue.trim() || 'Unknown'}`);

  const descriptionText =
    typeof route.description === 'string' ? route.description.trim() : '';
  appendInfoLine(descriptionText ? `Description: ${descriptionText}` : 'Description: —');

  appendInfoLine(`Date set: ${formatDisplayDate(route.date_set)}`);

  if (gradeControls) {
    fragment.appendChild(gradeControls);
  }
  if (actionsContainer) {
    fragment.appendChild(actionsContainer);
  }

  const betatipsSection = buildBetatipsSection(route, ariaLines);
  if (betatipsSection) {
    fragment.appendChild(betatipsSection);
  }

  const content = document.createElement('div');
  content.className = 'tooltip-content';
  content.appendChild(fragment);

  tooltip.replaceChildren(content);

  if (ariaLines.length) {
    tooltip.setAttribute('aria-label', ariaLines.join('\n'));
  } else {
    tooltip.removeAttribute('aria-label');
  }
}

function positionTooltip() {
  if (!tooltip) {
    return null;
  }

  const tooltipWidth = tooltip.offsetWidth || 0;
  const tooltipHeight = tooltip.offsetHeight || 0;
  const halfWidth = tooltipWidth / 2;

  const minHorizontalMargin = 12;
  const minLeft = halfWidth + minHorizontalMargin;
  const maxLeft = window.innerWidth - halfWidth - minHorizontalMargin;
  const desiredLeft = window.innerWidth / 2;
  const clampedLeft = maxLeft < minLeft ? window.innerWidth / 2 : Math.min(maxLeft, Math.max(minLeft, desiredLeft));

  const minVerticalMargin = 12;
  const maxTop = window.innerHeight - tooltipHeight - minVerticalMargin;
  const safeMaxTop = maxTop < minVerticalMargin ? Math.max(minVerticalMargin, maxTop) : maxTop;
  const desiredTop = (window.innerHeight - tooltipHeight) / 2;
  const clampedTop = Math.min(safeMaxTop, Math.max(minVerticalMargin, desiredTop));

  tooltip.style.left = `${clampedLeft}px`;
  tooltip.style.top = `${clampedTop}px`;

  return { x: clampedLeft, y: clampedTop };
}

function pushTooltipHistoryEntry() {
  if (tooltipHistoryEntryActive) {
    return;
  }

  if (!window.history || typeof window.history.pushState !== 'function') {
    return;
  }

  try {
    const baseState =
      window.history.state && typeof window.history.state === 'object'
        ? { ...window.history.state }
        : {};
    const nextState = { ...baseState, [TOOLTIP_HISTORY_STATE_KEY]: true };
    window.history.pushState(nextState, '', window.location.href);
    tooltipHistoryEntryActive = true;
  } catch (error) {
    console.warn('Unable to push tooltip history entry:', error);
  }
}

function showTooltip(route, clientX, clientY, options = {}) {
  if (!tooltip) {
    return;
  }

  const wasVisible = tooltip.classList.contains('visible');
  const { pin = false } = options;

  if (route.id !== activeRouteId) {
    updateTooltipContent(route);
  }

  const position = positionTooltip();
  tooltip.classList.add('visible');
  tooltip.setAttribute('aria-hidden', 'false');
  activeRouteId = route.id;

  if (!wasVisible) {
    pushTooltipHistoryEntry();
  }

  if (pin) {
    pinnedRouteId = route.id;
    pinnedPosition = position;
    tooltip.classList.add('pinned');
  } else {
    pinnedRouteId = null;
    pinnedPosition = null;
    tooltip.classList.remove('pinned');
  }
}

function hideTooltip(options = {}) {
  if (!tooltip) {
    return;
  }

  const { force = false, skipHistory = false } = options;

  if (!force && pinnedRouteId) {
    return;
  }

  const shouldRestoreHistory = tooltipHistoryEntryActive && !skipHistory;

  tooltip.classList.remove('visible');
  tooltip.classList.remove('pinned');
  tooltip.setAttribute('aria-hidden', 'true');
  activeRouteId = null;
  pinnedRouteId = null;
  pinnedPosition = null;

  if (skipHistory || shouldRestoreHistory) {
    tooltipHistoryEntryActive = false;
  }

  if (shouldRestoreHistory) {
    if (!suppressNextTooltipPopstate) {
      suppressNextTooltipPopstate = true;
    }

    try {
      window.history.back();
    } catch (error) {
      suppressNextTooltipPopstate = false;
      console.warn('Unable to restore history after closing tooltip:', error);
    }
  }
}

function handleTooltipPopState(event) {
  if (!tooltip) {
    tooltipHistoryEntryActive = false;
    return;
  }

  if (suppressNextTooltipPopstate) {
    suppressNextTooltipPopstate = false;
    return;
  }

  const state = event?.state;
  const tooltipStateActive = Boolean(
    state && typeof state === 'object' && state[TOOLTIP_HISTORY_STATE_KEY],
  );

  if (tooltipStateActive) {
    tooltipHistoryEntryActive = true;
    return;
  }

  tooltipHistoryEntryActive = false;

  if (tooltip.classList.contains('visible')) {
    hideTooltip({ force: true, skipHistory: true });
  }
}

function isRouteOverlapPromptOpen() {
  return Boolean(routeOverlapPrompt && !routeOverlapPrompt.classList.contains('hidden'));
}

function handleRouteOverlapPromptKeyDown(event) {
  if (!isRouteOverlapPromptOpen()) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeRouteOverlapPrompt();
    return;
  }

  if (event.key === 'Tab') {
    const optionButtons = routeOverlapList
      ? Array.from(routeOverlapList.querySelectorAll('button.route-overlap-option'))
      : [];
    const focusableElements = [routeOverlapCloseButton, ...optionButtons].filter(
      (element) => element instanceof HTMLElement,
    );

    if (!focusableElements.length) {
      event.preventDefault();
      return;
    }

    const activeElement = document.activeElement;
    const currentIndex = focusableElements.indexOf(activeElement);

    if (currentIndex === -1) {
      event.preventDefault();
      const target = event.shiftKey
        ? focusableElements[focusableElements.length - 1]
        : focusableElements[0];
      target.focus({ preventScroll: true });
      return;
    }

    if (event.shiftKey && currentIndex === 0) {
      event.preventDefault();
      focusableElements[focusableElements.length - 1].focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && currentIndex === focusableElements.length - 1) {
      event.preventDefault();
      focusableElements[0].focus({ preventScroll: true });
    }
  }
}

function handleRouteOverlapPromptPointerDown(event) {
  if (!isRouteOverlapPromptOpen() || !routeOverlapPrompt) {
    return;
  }

  const card = routeOverlapPrompt.querySelector('.route-overlap-card');
  if (!card || card.contains(event.target)) {
    return;
  }

  closeRouteOverlapPrompt();
}

function closeRouteOverlapPrompt(options = {}) {
  const { restoreFocus = true } = options;

  if (!routeOverlapPrompt) {
    activeOverlapPromptContext = null;
    overlapPromptReturnFocus = null;
    return;
  }

  if (!isRouteOverlapPromptOpen()) {
    activeOverlapPromptContext = null;
    overlapPromptReturnFocus = null;
    return;
  }

  routeOverlapPrompt.classList.add('hidden');
  routeOverlapPrompt.setAttribute('aria-hidden', 'true');

  if (routeOverlapList) {
    routeOverlapList.replaceChildren();
    routeOverlapList.scrollTop = 0;
  }

  document.removeEventListener('keydown', handleRouteOverlapPromptKeyDown, true);
  document.removeEventListener('pointerdown', handleRouteOverlapPromptPointerDown, true);

  const focusTarget = restoreFocus ? overlapPromptReturnFocus : null;
  overlapPromptReturnFocus = null;
  activeOverlapPromptContext = null;

  if (focusTarget && typeof focusTarget.focus === 'function') {
    focusTarget.focus({ preventScroll: true });
  }
}

function buildRouteOverlapOption(route) {
  const item = document.createElement('li');
  item.setAttribute('role', 'presentation');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'route-overlap-option';
  button.dataset.routeId = route.id;
  button.setAttribute('role', 'option');

  const backgroundColor = getRouteDisplayColor(route);
  const textColor = getRouteOverlapTextColor(backgroundColor);
  if (backgroundColor) {
    button.style.setProperty('--route-overlap-option-background', backgroundColor);
  }
  if (textColor) {
    button.style.setProperty('--route-overlap-option-color', textColor);
  }

  const name = document.createElement('span');
  name.className = 'route-overlap-option-name';
  const providedTitle =
    typeof route?.title === 'string' && route.title.trim() ? route.title.trim() : '';
  const providedName =
    typeof route?.name === 'string' && route.name.trim() ? route.name.trim() : '';
  const fallbackId = typeof route?.id === 'string' && route.id.trim() ? route.id.trim() : '';
  const routeName = providedTitle || providedName || fallbackId || 'Untitled Route';
  name.textContent = routeName;

  const grade = document.createElement('span');
  grade.className = 'route-overlap-option-grade';
  const gradeValue = resolveTooltipGradeValue(route);
  const gradeDisplay = formatGradeDisplay(gradeValue);
  grade.textContent = gradeDisplay;

  const ariaParts = [routeName];
  if (gradeDisplay && gradeDisplay !== '—') {
    ariaParts.push(`grade ${gradeDisplay}`);
  }
  button.setAttribute('aria-label', ariaParts.join(', '));

  button.append(name, grade);
  button.addEventListener('click', handleRouteOverlapOptionSelect);

  item.appendChild(button);
  return item;
}

function openRouteOverlapPrompt(routeIds, entry = null) {
  if (!routeOverlapPrompt || !routeOverlapList) {
    return false;
  }

  const uniqueRouteIds = Array.from(
    new Set(
      Array.isArray(routeIds)
        ? routeIds.filter((value) => typeof value === 'string' && value.trim())
        : [],
    ),
  );

  const resolvedRoutes = uniqueRouteIds
    .map((routeId) => routes.find((route) => route?.id === routeId))
    .filter(Boolean);

  if (resolvedRoutes.length <= 1) {
    return false;
  }

  closeRouteOverlapPrompt({ restoreFocus: false });

  overlapPromptReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  activeOverlapPromptContext = {
    routeIds: uniqueRouteIds,
    canvasX: entry?.canvasX ?? null,
    canvasY: entry?.canvasY ?? null,
  };

  const fragment = document.createDocumentFragment();
  resolvedRoutes.forEach((route) => {
    fragment.appendChild(buildRouteOverlapOption(route));
  });

  routeOverlapList.replaceChildren(fragment);
  routeOverlapList.scrollTop = 0;

  routeOverlapPrompt.classList.remove('hidden');
  routeOverlapPrompt.setAttribute('aria-hidden', 'false');

  const firstOption = routeOverlapList.querySelector('button.route-overlap-option');
  if (firstOption) {
    firstOption.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', handleRouteOverlapPromptKeyDown, true);
  document.addEventListener('pointerdown', handleRouteOverlapPromptPointerDown, true);

  hideTooltip({ force: true });

  return true;
}

function handleRouteOverlapOptionSelect(event) {
  const button = event.currentTarget;
  if (!button || typeof button.dataset?.routeId !== 'string') {
    closeRouteOverlapPrompt();
    return;
  }

  const selectedRoute = routes.find((route) => route?.id === button.dataset.routeId);
  const context = activeOverlapPromptContext;
  closeRouteOverlapPrompt();

  if (!selectedRoute) {
    return;
  }

  resetLastFocusActivation();
  focusRoute(selectedRoute);

  const clientX = Number.isFinite(context?.canvasX) ? context.canvasX : 0;
  const clientY = Number.isFinite(context?.canvasY) ? context.canvasY : 0;
  showTooltip(selectedRoute, clientX, clientY, { pin: true });
}

function updateClearFocusButton() {
  if (!clearFocusButton) {
    return;
  }

  const hasFocusedRoute = Boolean(focusedRouteId);
  clearFocusButton.classList.toggle('hidden', !hasFocusedRoute);
  clearFocusButton.setAttribute('aria-hidden', hasFocusedRoute ? 'false' : 'true');

  if (hasFocusedRoute) {
    clearFocusButton.removeAttribute('disabled');
  } else {
    clearFocusButton.setAttribute('disabled', 'true');
    if (document.activeElement === clearFocusButton && typeof clearFocusButton.blur === 'function') {
      clearFocusButton.blur();
    }
  }
}

function clearRouteFocus() {
  if (!focusedRouteId) {
    return;
  }

  resetLastFocusActivation();

  const activeRoutes = Array.isArray(routes) ? routes : [];
  const fallbackRoutes = Array.isArray(allRoutes) ? allRoutes : [];
  const route =
    activeRoutes.find((entry) => entry?.id === focusedRouteId) ||
    fallbackRoutes.find((entry) => entry?.id === focusedRouteId) ||
    null;

  if (route) {
    setRouteFocus(route, false);
    return;
  }

  focusedRouteId = null;
  updateClearFocusButton();
  redraw();
  renderProgressionList();
}

function setRouteFocus(route, shouldFocus) {
  if (!route || typeof route.id !== 'string') {
    return;
  }

  const nextFocusedId = shouldFocus ? route.id : null;
  const shouldRestoreProgressionFocus = Boolean(
    shouldFocus && progressionList && isProgressionModalOpen()
  );

  if (focusedRouteId === nextFocusedId) {
    updateClearFocusButton();
    redraw();

    if (tooltip && tooltip.classList.contains('visible') && activeRouteId === route.id) {
      updateTooltipContent(route);
    }

    renderProgressionList();

    if (shouldRestoreProgressionFocus) {
      const entry = progressionList.querySelector(
        `[data-route-id="${route.id}"]`,
      );
      if (entry && typeof entry.focus === 'function') {
        entry.focus();
      }
    }
    return;
  }

  focusedRouteId = nextFocusedId;
  updateClearFocusButton();

  redraw();

  if (tooltip && tooltip.classList.contains('visible') && activeRouteId === route.id) {
    updateTooltipContent(route);
  }

  renderProgressionList();

  if (shouldRestoreProgressionFocus) {
    const entry = progressionList.querySelector(`[data-route-id="${route.id}"]`);
    if (entry && typeof entry.focus === 'function') {
      entry.focus();
    }
  }
}

function focusRoute(route) {
  const shouldCloseProgression = isProgressionModalOpen();
  setRouteFocus(route, true);

  if (shouldCloseProgression) {
    closeProgressionModal();
  }
}

function extractClientPoint(event) {
  if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = event.touches?.[0] ?? event.changedTouches?.[0];
  if (touch) {
    return { x: touch.clientX, y: touch.clientY };
  }

  return null;
}

function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function isPointNearSegment(px, py, x1, y1, x2, y2, padding = 0) {
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
}

function getRouteEntryAtClientPoint(clientX, clientY) {
  if (!Array.isArray(routeInteractionEntries) || routeInteractionEntries.length === 0) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  for (let index = routeInteractionEntries.length - 1; index >= 0; index -= 1) {
    const entry = routeInteractionEntries[index];
    if (
      !entry ||
      (!entry.route && (!Array.isArray(entry.routes) || entry.routes.length === 0))
    ) {
      continue;
    }

    if (entry.type === 'overlap-circle') {
      const radius = Number(entry.r) || 0;
      const cx = Number(entry.cx);
      const cy = Number(entry.cy);
      if (radius > 0) {
        const distance = distanceSquared(x, y, cx, cy);
        if (distance <= radius * radius) {
          return {
            route: entry.route ?? null,
            routes: Array.isArray(entry.routes) ? [...entry.routes] : [],
            canvasX: entry.canvasX ?? cx,
            canvasY: entry.canvasY ?? cy,
            overlap: true,
          };
        }
      }
    } else if (entry.type === 'overlap-rect') {
      const left = Number(entry.left);
      const right = Number(entry.right);
      const top = Number(entry.top);
      const bottom = Number(entry.bottom);
      if (x >= left && x <= right && y >= top && y <= bottom) {
        return {
          route: entry.route ?? null,
          routes: Array.isArray(entry.routes) ? [...entry.routes] : [],
          canvasX: entry.canvasX ?? (left + right) / 2,
          canvasY: entry.canvasY ?? (top + bottom) / 2,
          overlap: true,
        };
      }
    } else if (entry.type === 'circle') {
      const radius = Number(entry.r) || 0;
      if (radius > 0) {
        const distance = distanceSquared(x, y, Number(entry.cx), Number(entry.cy));
        if (distance <= radius * radius) {
          return { route: entry.route, canvasX: entry.cx, canvasY: entry.cy };
        }
      }
    } else if (entry.type === 'rect') {
      const left = Number(entry.left);
      const right = Number(entry.right);
      const top = Number(entry.top);
      const bottom = Number(entry.bottom);
      if (x >= left && x <= right && y >= top && y <= bottom) {
        return {
          route: entry.route,
          canvasX: (left + right) / 2,
          canvasY: (top + bottom) / 2,
        };
      }
    } else if (entry.type === 'segment') {
      const padding = Number(entry.padding) || 0;
      const x1 = Number(entry.x1);
      const y1 = Number(entry.y1);
      const x2 = Number(entry.x2);
      const y2 = Number(entry.y2);
      if (isPointNearSegment(x, y, x1, y1, x2, y2, padding)) {
        return {
          route: entry.route,
          canvasX: (x1 + x2) / 2,
          canvasY: (y1 + y2) / 2,
        };
      }
    }
  }

  return null;
}

function beginPointerInteraction(event) {
  const point = extractClientPoint(event);
  if (!point) {
    activePointerInteraction = null;
    return;
  }

  const pointerId = 'pointerId' in event ? event.pointerId : null;
  activePointerInteraction = {
    pointerId,
    startX: point.x,
    startY: point.y,
    latestX: point.x,
    latestY: point.y,
    dragging: false,
  };
}

function updatePointerInteraction(event) {
  if (!activePointerInteraction) {
    return;
  }

  if (
    'pointerId' in event &&
    activePointerInteraction.pointerId !== null &&
    event.pointerId !== activePointerInteraction.pointerId
  ) {
    return;
  }

  const point = extractClientPoint(event);
  if (!point) {
    return;
  }

  activePointerInteraction.latestX = point.x;
  activePointerInteraction.latestY = point.y;

  if (!activePointerInteraction.dragging) {
    const movementSquared = distanceSquared(
      activePointerInteraction.startX,
      activePointerInteraction.startY,
      point.x,
      point.y,
    );

    if (movementSquared > CLICK_DRAG_DISTANCE_THRESHOLD_SQUARED) {
      activePointerInteraction.dragging = true;
    }
  }
}

function concludePointerInteraction(event) {
  if (!activePointerInteraction) {
    return null;
  }

  if (
    'pointerId' in event &&
    activePointerInteraction.pointerId !== null &&
    event.pointerId !== activePointerInteraction.pointerId
  ) {
    return null;
  }

  const point = extractClientPoint(event);
  const resolvedX = point?.x ?? activePointerInteraction.latestX;
  const resolvedY = point?.y ?? activePointerInteraction.latestY;

  const result = {
    x: resolvedX,
    y: resolvedY,
    dragging: activePointerInteraction.dragging,
  };

  activePointerInteraction = null;
  return result;
}

function cancelPointerInteraction() {
  activePointerInteraction = null;
  resetLastFocusActivation();
}

function applyLocationFilter() {
  const desiredLocation = normalizeLocationName(currentLocation?.name);
  const fallbackLocation = normalizeLocationName(getDefaultLocation()?.name);
  const targetLocation = desiredLocation || fallbackLocation;

  if (!targetLocation) {
    routes = [...allRoutes];
  } else {
    routes = allRoutes.filter((route) => {
      const routeLocation =
        typeof route?.locationKey === 'string'
          ? route.locationKey
          : normalizeLocationName(route?.location);
      return routeLocation === targetLocation;
    });
  }

  if (focusedRouteId) {
    const hasFocusedRoute = routes.some((route) => route.id === focusedRouteId);
    if (!hasFocusedRoute) {
      focusedRouteId = null;
      updateClearFocusButton();
      hideTooltip({ force: true });
    }
  }

  synchroniseAscentsWithRoutes({ shouldRedraw: false });
  redraw();
}

async function loadRoutes() {
  try {
    const [routesSnapshot, wallSnapshot, scoresSnapshot, betatipsSnapshot] =
      await Promise.all([
        getDocs(collection(db, 'routes')),
        getDocs(collection(db, WALL_COLLECTION)),
        getDocs(collectionGroup(db, 'scores')),
        getDocs(collection(db, 'routes_users_betatips')),
      ]);

    const routeScoresByRoute = new Map();
    routeBetatipsCache.clear();

    scoresSnapshot.forEach((docSnap) => {
      const routeRef = docSnap.ref?.parent?.parent;
      const routeUid =
        typeof routeRef?.id === 'string' && routeRef.id.trim() ? routeRef.id.trim() : '';
      const userUid = typeof docSnap.id === 'string' ? docSnap.id.trim() : '';

      if (!routeUid || !userUid) {
        return;
      }

      const normalizedEntry = normalizeRouteScoreEntry(docSnap.data() || {});
      let scoresMap = routeScoresByRoute.get(routeUid);
      if (!(scoresMap instanceof Map)) {
        scoresMap = new Map();
        routeScoresByRoute.set(routeUid, scoresMap);
      }
      scoresMap.set(userUid, normalizedEntry);
    });

    const betatipEntries = [];
    betatipsSnapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const routeId = typeof data.routeId === 'string' ? data.routeId.trim() : '';
      const userId = typeof data.userId === 'string' ? data.userId.trim() : '';

      if (!routeId || !userId) {
        return;
      }

      const text =
        typeof data.betatip === 'string'
          ? data.betatip.replace(/\r\n/g, '\n').trim()
          : '';
      const upvoteCount =
        typeof data.upvoteCount === 'number' && Number.isFinite(data.upvoteCount)
          ? data.upvoteCount
          : 0;

      if (!text) {
        return;
      }

      betatipEntries.push({
        id: docSnap.id,
        routeId,
        userId,
        text,
        upvoteCount,
      });
    });

    await Promise.all(
      betatipEntries.map(async (entry) => {
        const resolvedUsername = await lookupUsernameByUid(entry.userId);
        const normalizedUsername = isValidUsername(resolvedUsername)
          ? normalizeUsername(resolvedUsername)
          : '';
        const betatipsMap = getRouteBetatipsMap(entry.routeId);
        const upvoters = await loadBetatipUpvotes(entry.id);
        const calculatedCount = upvoters.size;
        const normalizedCount = Math.max(entry.upvoteCount, calculatedCount);
        betatipsMap.set(entry.id, {
          betatipId: entry.id,
          userId: entry.userId,
          username: normalizedUsername,
          betatip: entry.text,
          upvoters,
          upvoteCount: normalizedCount,
        });
      }),
    );

    wallSettingsCache.clear();
    const hiddenWallKeys = new Set();
    let locationsChanged = false;
    wallSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const settings = normalizeWallSettings(data);
      const normalizedId = normalizeWallKey(docSnap.id);
      const normalizedName = normalizeWallKey(data?.name);
      const normalizedKeyField = normalizeWallKey(data?.key);
      const isHidden = data?.hidden === true;

      if (normalizedId) {
        wallSettingsCache.set(normalizedId, settings);
        if (isHidden) {
          hiddenWallKeys.add(normalizedId);
        }
      }

      if (normalizedName) {
        wallSettingsCache.set(normalizedName, settings);
        if (isHidden) {
          hiddenWallKeys.add(normalizedName);
        }
      }

      if (normalizedKeyField) {
        wallSettingsCache.set(normalizedKeyField, settings);
        if (isHidden) {
          hiddenWallKeys.add(normalizedKeyField);
        }
      }

      const { changed } = upsertLocation({
        key: typeof data?.key === 'string' ? data.key : docSnap.id,
        name: typeof data?.name === 'string' ? data.name : '',
        image: typeof data?.background_url === 'string' ? data.background_url : '',
        fallbackName: typeof data?.name === 'string' && data.name ? data.name : docSnap.id,
        hidden: isHidden,
      });

      if (changed) {
        locationsChanged = true;
      }
    });

    if (locationsChanged) {
      renderLocationOptions();
      synchronizeCurrentLocationReference();
    } else {
      ensureCurrentLocationVisible();
    }

    allRoutes = routesSnapshot.docs
      .map((docSnap) => {
        const data = docSnap.data() ?? {};
        const routeUid =
          typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : docSnap.id;
        const betatipsMap = getRouteBetatipsMap(routeUid);
        const scoresMap =
          routeScoresByRoute.get(routeUid) instanceof Map
            ? new Map(routeScoresByRoute.get(routeUid))
            : new Map();
        if (data.hiddenFromClimbers === true) {
          return null;
        }

        const grade = normalizeRouteGradeField(data.grade);

        const pointsByType = normalizeRoutePointsByType(
          data.points,
          data.pathType,
        );
        const normalizedPoints = selectNormalizedPointsForPath(
          pointsByType,
          data.pathType,
        );

        const rawLocationValue = typeof data.location === 'string' ? data.location.trim() : '';
        const defaultLocation = getDefaultLocation();
        const normalizedLocation =
          normalizeLocationName(rawLocationValue) || normalizeLocationName(defaultLocation?.name);
        const displayLocation = rawLocationValue || defaultLocation?.name || '';

        if (normalizedLocation && hiddenWallKeys.has(normalizedLocation)) {
          return null;
        }

        const fallbackWallSettings = {
          pointDiameter: data.pointDiameter,
          hollowPointDiameter: data.hollowPointDiameter ?? data.pointDiameter,
          hollowPointLineWidth: normalizeHollowPointLineWidth(
            data.hollowPointLineWidth,
            data.hollowPointDiameter ?? data.pointDiameter,
          ),
          filledPointDiameter: data.filledPointDiameter ?? data.pointDiameter,
          filledPointTransparency: data.filledPointTransparency ?? data.filledPointOpacity,
          rectangleWidth: data.rectangleWidth,
          rectangleHeight: data.rectangleHeight,
          bezierStrokeWidth: data.bezierStrokeWidth ?? data.brezerStrokeWidth,
          gradeBarBaseHeight: data.gradeBarBaseHeight,
          gradeBarMaxHeight: data.gradeBarMaxHeight,
          gradeBarWidth: data.gradeBarWidth,
          transparency: data.transparency ?? data.gradeBarTransparency,
          unfocusedTransparency: data.unfocusedTransparency,
        };
        const wallSettings = resolveWallSettings(normalizedLocation, fallbackWallSettings);

        return {
          id: routeUid,
          uid: routeUid,
          strokeColor: typeof data.strokeColor === 'string' ? data.strokeColor : '#ffde59',
          points: normalizedPoints,
          pointsByType,
          title: typeof data.title === 'string' ? data.title : '',
          setter: typeof data.setter === 'string' ? data.setter : '',
          description: typeof data.description === 'string' ? data.description : '',
          date_set: normalizeDate(data.date_set),
          date_removed: normalizeDate(data.date_removed),
          location: displayLocation,
          locationKey: normalizedLocation,
          grade,
          pathType: normalizePathType(data.pathType),
          pointDiameter: wallSettings.pointDiameter,
          hollowPointDiameter: wallSettings.hollowPointDiameter,
          hollowPointLineWidth: wallSettings.hollowPointLineWidth,
          filledPointDiameter: wallSettings.filledPointDiameter,
          filledPointTransparency: wallSettings.filledPointTransparency,
          rectangleWidth: wallSettings.rectangleWidth,
          rectangleHeight: wallSettings.rectangleHeight,
          bezierStrokeWidth: wallSettings.bezierStrokeWidth,
          gradeBarBaseHeight: wallSettings.gradeBarBaseHeight,
          gradeBarMaxHeight: wallSettings.gradeBarMaxHeight,
          gradeBarWidth: wallSettings.gradeBarWidth,
          gradeBarTransparency: wallSettings.gradeBarTransparency,
          unfocusedTransparency: wallSettings.unfocusedTransparency,
          betatips: betatipsMap,
          scores: scoresMap,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const nameA = (a.title || a.uid || a.id).toLowerCase();
        const nameB = (b.title || b.uid || b.id).toLowerCase();
        return nameA.localeCompare(nameB);
      });

    applyLocationFilter();
  } catch (error) {
    console.error('Failed to load routes:', error);
    allRoutes = [];
    routes = [];
    focusedRouteId = null;
    updateClearFocusButton();
    routeBetatipsCache.clear();
    renderProgressionList();
    redraw();
  }
}

async function toggleRouteAscent(route) {
  if (!currentUser) {
    return;
  }

  const userId = typeof currentUser.uid === 'string' ? currentUser.uid.trim() : '';
  if (!userId) {
    console.warn('Unable to mark ascent: user ID missing.');
    return;
  }

  const routeId = typeof route?.id === 'string' ? route.id.trim() : '';
  if (!routeId) {
    console.warn('Unable to mark ascent: route ID missing.');
    return;
  }

  const routeRef = doc(db, 'routes', routeId, 'scores', userId);
  const isAscended = ascendedRoutes.has(routeId);
  const targetRoute = findRouteById(routeId) || route;
  const previousDetails = getRouteScoreEntry(targetRoute, userId);
  const persistedGrade = normalizeGradeValue(previousDetails?.grade);
  const fallbackGrade = getUserGradeForRoute(routeId);
  const normalizedGrade =
    typeof persistedGrade === 'number' && Number.isFinite(persistedGrade)
      ? persistedGrade
      : fallbackGrade;
  const sanitizedGrade =
    typeof normalizedGrade === 'number' && Number.isFinite(normalizedGrade)
      ? normalizedGrade
      : null;

  try {
    const nextAscended = !isAscended;
    const userPayload = {
      grade: sanitizedGrade,
      ascended: nextAscended,
    };

    await setDoc(routeRef, userPayload, { merge: true });

    userAscentDetails.set(routeId, {
      ascended: nextAscended,
      grade: sanitizedGrade,
    });

    updateRouteScoreEntry(routeId, userId, userPayload);

    synchroniseAscentsWithRoutes({ shouldRedraw: false });
    updateTooltipContent(route);
    redraw();
  } catch (error) {
    console.error('Failed to update ascent:', error);
  }
}

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
      if (!isHorizontalScrollEnabled) {
        canvasContainer.scrollLeft = Math.max(0, maxScrollLeft / 2);
      } else if (canvasContainer.scrollLeft > maxScrollLeft) {
        canvasContainer.scrollLeft = maxScrollLeft;
      }
    } else if (isHorizontalScrollEnabled) {
      canvasContainer.scrollLeft = 0;
    }
  }

  isHorizontalScrollEnabled = enableScroll;
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

  routeInteractionEntries = [];
  let isFocusActive = false;
  let resolvedFocusRoute = null;
  let focusedRoutePointKeys = null;

  if (focusedRouteId) {
    resolvedFocusRoute = routes.find((route) => route.id === focusedRouteId) || null;
    if (resolvedFocusRoute) {
      isFocusActive = true;
      focusedRoutePointKeys = buildNormalizedPointKeySet(resolvedFocusRoute.points);
    } else {
      focusedRouteId = null;
      updateClearFocusButton();
    }
  }

  const shouldPreservePinned = Boolean(
    pinnedRouteId &&
      pinnedPosition &&
      (!isFocusActive || pinnedRouteId === focusedRouteId),
  );
  const pinnedRoute = shouldPreservePinned
    ? routes.find((route) => route.id === pinnedRouteId)
    : null;

  if (!shouldPreservePinned) {
    hideTooltip();
  } else if (!pinnedRoute) {
    hideTooltip({ force: true });
  }

  const overlapGroups = buildOverlappingShapeGroups(routes);
  const routeAlphaMap = new Map();

  routes.forEach((route) => {
    if (!route || typeof route.id !== 'string') {
      return;
    }
    const isFocused = isFocusActive && route.id === focusedRouteId;
    const routeAlpha = isFocused
      ? 1
      : isFocusActive
        ? normalizeUnfocusedTransparency(route.unfocusedTransparency)
        : 1;
    routeAlphaMap.set(route.id, routeAlpha);
  });

  const handledOverlapKeys = new Set();

  routes.forEach((route) => {
    const isFocused = isFocusActive && route.id === focusedRouteId;
    const routeAlpha = routeAlphaMap.get(route?.id) ?? 1;
    const omitOverlaps = !isFocused && focusedRoutePointKeys?.size ? focusedRoutePointKeys : null;
    drawRoute(route, {
      alpha: routeAlpha,
      omitOverlappingPointKeys: omitOverlaps,
      overlapGroups,
      handledOverlapKeys,
      routeAlphaMap,
      isFocused,
    });
  });
  if (pinnedRoute && tooltip) {
    updateTooltipContent(pinnedRoute);
    tooltip.classList.add('visible');
    tooltip.classList.add('pinned');
    tooltip.setAttribute('aria-hidden', 'false');
    const updatedPosition = positionTooltip();
    if (updatedPosition) {
      pinnedPosition = updatedPosition;
    }
  }
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

function buildNormalizedPointKeySet(points = []) {
  const keys = new Set();
  if (!Array.isArray(points) || !points.length) {
    return keys;
  }

  points.forEach((point) => {
    const x = Number(point?.x);
    const y = Number(point?.y);
    const key = createNormalizedPointKey(x, y);
    if (key) {
      keys.add(key);
    }
  });

  return keys;
}

function getRouteStrokeColor(route) {
  const rawColor = route?.strokeColor;
  if (typeof rawColor === 'string' && rawColor.trim()) {
    return rawColor;
  }
  return '#ffde59';
}

function getGradeColorForValue(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) {
    return null;
  }

  const clamped = Math.min(Math.max(rounded, MIN_GRADE_VALUE), MAX_GRADE_VALUE);
  return GRADE_COLOR_MAP.get(clamped) ?? null;
}

function getRouteGradeColor(route) {
  if (!route) {
    return null;
  }

  const routeId = getRouteId(route);
  const grade = computeMedianGradeForRoute(routeId);
  return getGradeColorForValue(grade);
}

function getRouteDisplayColor(route) {
  if (viewMode === VIEW_MODE_ASCENT_STATUS) {
    const routeId = route?.id;
    const isAscended = Boolean(routeId && ascendedRoutes.has(routeId));
    return isAscended ? ASCENT_STATUS_ASCENDED_COLOR : ASCENT_STATUS_PROJECT_COLOR;
  }
  if (viewMode === VIEW_MODE_GRADE_COLORS) {
    const gradeColor = getRouteGradeColor(route);
    return gradeColor ?? DEFAULT_GRADELESS_COLOR;
  }
  return getRouteStrokeColor(route);
}

const overlapColorCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (overlapColorCanvas) {
  overlapColorCanvas.width = 1;
  overlapColorCanvas.height = 1;
}
const overlapColorContext = overlapColorCanvas ? overlapColorCanvas.getContext('2d') : null;

function parseColorToRGB(color) {
  if (!overlapColorContext || typeof color !== 'string') {
    return null;
  }

  const trimmed = color.trim();
  if (!trimmed) {
    return null;
  }

  try {
    overlapColorContext.fillStyle = '#000000';
    overlapColorContext.fillStyle = trimmed;
  } catch (error) {
    return null;
  }

  const resolved = overlapColorContext.fillStyle;
  if (typeof resolved !== 'string' || !resolved) {
    return null;
  }

  if (resolved.startsWith('#')) {
    let hex = resolved.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split('')
        .map((char) => char + char)
        .join('');
    } else if (hex.length === 6 || hex.length === 8) {
      hex = hex.slice(0, 6);
    } else {
      return null;
    }

    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);

    if ([r, g, b].some((value) => Number.isNaN(value))) {
      return null;
    }

    return { r, g, b };
  }

  if (resolved.startsWith('rgb')) {
    const match = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) {
      return null;
    }

    const r = Number.parseInt(match[1], 10);
    const g = Number.parseInt(match[2], 10);
    const b = Number.parseInt(match[3], 10);

    if ([r, g, b].some((value) => Number.isNaN(value))) {
      return null;
    }

    return { r, g, b };
  }

  return null;
}

function computeRelativeLuminance(rgb) {
  if (!rgb) {
    return 0;
  }

  const transformChannel = (channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  const r = transformChannel(rgb.r ?? 0);
  const g = transformChannel(rgb.g ?? 0);
  const b = transformChannel(rgb.b ?? 0);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getRouteOverlapTextColor(backgroundColor) {
  const rgb = parseColorToRGB(backgroundColor);
  if (!rgb) {
    return '#0f172a';
  }

  const luminance = computeRelativeLuminance(rgb);
  return luminance > 0.6 ? '#0f172a' : '#f8fafc';
}

function getOverlapGroupPathType(pathType) {
  const normalized = normalizePathType(pathType);
  if (normalized === PATH_TYPE_HOLLOW_POINT || normalized === PATH_TYPE_FILLED_POINT) {
    return OVERLAP_GROUP_TYPE_POINT;
  }
  return normalized;
}

function createOverlapGroupKey(pathType, pointKey) {
  if (!pathType || !pointKey) {
    return null;
  }

  const normalizedPathType = getOverlapGroupPathType(pathType);
  if (!normalizedPathType) {
    return null;
  }

  return `${normalizedPathType}::${pointKey}`;
}

function buildOverlappingShapeGroups(routeList = []) {
  const groups = new Map();

  if (!Array.isArray(routeList) || !routeList.length) {
    return groups;
  }

  routeList.forEach((route) => {
    if (!route) {
      return;
    }

    const pointEntries = getRoutePointEntries(route);
    if (!pointEntries.length) {
      return;
    }

    const displayColor = getRouteDisplayColor(route);
    const normalizedRectangleWidth = normalizeRectangleSize(
      route.rectangleWidth,
      DEFAULT_RECTANGLE_WIDTH,
    );
    const normalizedRectangleHeight = normalizeRectangleSize(
      route.rectangleHeight,
      DEFAULT_RECTANGLE_HEIGHT,
    );
    const normalizedHollowPointLineWidth = getRouteHollowPointLineWidth(route);

    pointEntries.forEach(({ pathType, points }) => {
      if (
        !Array.isArray(points) ||
        !points.length
      ) {
        return;
      }

      const normalizedPathType = normalizePathType(pathType);
      if (
        (!isNormalizedPointPathType(normalizedPathType) && normalizedPathType !== PATH_TYPE_RECTANGLE)
      ) {
        return;
      }

      const normalizedPointDiameter = getRoutePointDiameterForPathType(route, normalizedPathType);

      points.forEach((point) => {
        const normalizedX = Number(point?.x);
        const normalizedY = Number(point?.y);
        const pointKey = createNormalizedPointKey(normalizedX, normalizedY);
        if (!pointKey) {
          return;
        }

        const groupKey = createOverlapGroupKey(normalizedPathType, pointKey);
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
          routeId: route.id,
          color: displayColor,
          pathType: normalizedPathType,
          pointDiameter: normalizedPointDiameter,
          rectangleWidth: normalizedRectangleWidth,
          rectangleHeight: normalizedRectangleHeight,
          hollowPointLineWidth: normalizedHollowPointLineWidth,
          filledPointTransparency: getRouteFilledPointTransparency(route),
        });
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

function drawOverlappingPointGroup(ctx, center, entries) {
  if (!ctx || !center || !entries || entries.length <= 1) {
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
    const transparency = normalizeFilledPointTransparency(entry.filledPointTransparency);
    const effectiveAlpha = entryAlpha * transparency;
    const fillColor = entry.color || '#ffde59';

    ctx.globalAlpha = effectiveAlpha;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, fillRadius, angleStart, angleEnd);
    ctx.closePath();
    ctx.fill();
  });

  entries.forEach((entry, index) => {
    const strokeWidth = strokeWidths[index] ?? Math.max(
      2,
      Math.round(
        normalizePointDiameter(
          entry?.pointDiameter,
          entry?.pathType === PATH_TYPE_FILLED_POINT
            ? DEFAULT_FILLED_POINT_DIAMETER
            : DEFAULT_HOLLOW_POINT_DIAMETER,
        ) / 10,
      ) || 2,
    );
    const angleStart = startAngle + step * index;
    const angleEnd = angleStart + step;

    const entryAlpha = Number.isFinite(entry.alpha) ? entry.alpha : 1;
    const transparency = normalizeFilledPointTransparency(entry.filledPointTransparency);
    ctx.globalAlpha = entryAlpha * transparency;
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = entry.color || '#ffde59';
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, angleStart, angleEnd);
    ctx.stroke();
  });

  ctx.restore();
}

function drawOverlappingRectangleGroup(ctx, center, entries) {
  if (!ctx || !center || !entries || entries.length <= 1) {
    return;
  }

  const widths = entries.map((entry) => Math.max(1, Number(entry.rectangleWidth) || 0));
  const heights = entries.map((entry) => Math.max(1, Number(entry.rectangleHeight) || 0));
  const width = Math.max(...widths, 4);
  const height = Math.max(...heights, 4);
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const perimeter = 2 * (width + height);

  if (!Number.isFinite(perimeter) || perimeter <= 0) {
    return;
  }

  const segmentLength = perimeter / entries.length;
  const edges = [
    { length: width, startX: center.x - halfWidth, startY: center.y - halfHeight, dx: 1, dy: 0 },
    { length: height, startX: center.x + halfWidth, startY: center.y - halfHeight, dx: 0, dy: 1 },
    { length: width, startX: center.x + halfWidth, startY: center.y + halfHeight, dx: -1, dy: 0 },
    { length: height, startX: center.x - halfWidth, startY: center.y + halfHeight, dx: 0, dy: -1 },
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
      Math.round(Math.max(Number(entry.rectangleWidth) || 0, Number(entry.rectangleHeight) || 0) / 10) || 2,
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

function calculateRouteStrokeWidth(route, pathTypeOverride = undefined) {
  const pathType = normalizePathType(pathTypeOverride ?? route?.pathType);
  if (pathType === PATH_TYPE_BEZIER) {
    return normalizeBezierStrokeWidth(route?.bezierStrokeWidth);
  }
  if (pathType === PATH_TYPE_HOLLOW_POINT) {
    return getRouteHollowPointLineWidth(route);
  }
  if (pathType === PATH_TYPE_FILLED_POINT) {
    const diameter = getRoutePointDiameterForPathType(route, PATH_TYPE_FILLED_POINT);
    return Math.max(2, Math.round(diameter / 10));
  }
  if (pathType === PATH_TYPE_RECTANGLE) {
    const width = normalizeRectangleSize(route?.rectangleWidth, DEFAULT_RECTANGLE_WIDTH);
    const height = normalizeRectangleSize(route?.rectangleHeight, DEFAULT_RECTANGLE_HEIGHT);
    return Math.max(2, Math.round(Math.max(width, height) / 10));
  }
  return DEFAULT_BEZIER_STROKE_WIDTH;
}

function drawRoute(route, options = {}) {
  const strokeColor = getRouteDisplayColor(route);
  const pointEntries = getRoutePointEntries(route);

  const alphaValue = Number(options.alpha);
  const routeAlpha = Number.isFinite(alphaValue)
    ? Math.min(Math.max(alphaValue, 0), 1)
    : 1;

  const omitOverlapKeys =
    options?.omitOverlappingPointKeys instanceof Set ? options.omitOverlappingPointKeys : null;
  const overlapGroups =
    options?.overlapGroups instanceof Map ? options.overlapGroups : null;
  const handledOverlapKeys =
    options?.handledOverlapKeys instanceof Set ? options.handledOverlapKeys : null;
  const routeAlphaMap =
    options?.routeAlphaMap instanceof Map ? options.routeAlphaMap : null;
  const isFocusedRoute = Boolean(options?.isFocused);

  if (!pointEntries.length) {
    return;
  }

  const interactionRegions = [];

  pointEntries.forEach(({ pathType, points }) => {
    if (!Array.isArray(points) || !points.length) {
      return;
    }

    const supportsOverlapPattern =
      isNormalizedPointPathType(pathType) || pathType === PATH_TYPE_RECTANGLE;
    const shouldFilterOverlaps =
      omitOverlapKeys && omitOverlapKeys.size > 0 && supportsOverlapPattern;

    const pathPoints = [];
    const visiblePoints = [];

    points.forEach((point) => {
      const normalizedX = Number(point?.x);
      const normalizedY = Number(point?.y);
      if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
        return;
      }

      const scaledPoint = {
        x: normalizedX * canvas.width,
        y: normalizedY * canvas.height,
      };
      pathPoints.push(scaledPoint);

      const pointKey = supportsOverlapPattern
        ? createNormalizedPointKey(normalizedX, normalizedY)
        : null;

      if (shouldFilterOverlaps && pointKey && omitOverlapKeys.has(pointKey)) {
        return;
      }

      const overlapKey =
        pointKey && overlapGroups ? createOverlapGroupKey(pathType, pointKey) : null;
      const overlapGroup =
        overlapKey && overlapGroups ? overlapGroups.get(overlapKey) : null;

      if (
        overlapGroup &&
        Array.isArray(overlapGroup.entries) &&
        overlapGroup.entries.length > 1 &&
        !isFocusedRoute
      ) {
        const overlapRouteIds = overlapGroup.entries
          .map((entry) => (entry && typeof entry.routeId === 'string' ? entry.routeId : null))
          .filter((value) => typeof value === 'string');
        const uniqueRouteIds = Array.from(new Set(overlapRouteIds));

        if (uniqueRouteIds.length > 1) {
          if (handledOverlapKeys && handledOverlapKeys.has(overlapKey)) {
            return;
          }

          const entriesWithAlpha = overlapGroup.entries.map((entry) => {
            const mappedAlpha = routeAlphaMap?.get(entry.routeId);
            const entryAlpha = Number.isFinite(mappedAlpha) ? mappedAlpha : 1;
            const transparency =
              entry.pathType === PATH_TYPE_FILLED_POINT
                ? normalizeFilledPointTransparency(entry.filledPointTransparency)
                : 1;
            return {
              ...entry,
              alpha: entryAlpha,
              filledPointTransparency: transparency,
            };
          });

          if (handledOverlapKeys) {
            handledOverlapKeys.add(overlapKey);
          }

          let overlapRegion = null;

          if (isNormalizedPointPathType(pathType)) {
            drawOverlappingPointGroup(ctx, scaledPoint, entriesWithAlpha);
            const radii = entriesWithAlpha.map((entry) =>
              Math.max(1, Number(entry.pointDiameter) / 2),
            );
            const baseRadius = radii.length ? Math.max(...radii, 4) : 6;
            const detectionRadius = baseRadius + 12;
            overlapRegion = {
              type: 'overlap-circle',
              cx: scaledPoint.x,
              cy: scaledPoint.y,
              r: detectionRadius,
              canvasX: scaledPoint.x,
              canvasY: scaledPoint.y,
              routes: uniqueRouteIds,
              overlap: true,
            };
          } else if (pathType === PATH_TYPE_RECTANGLE) {
            drawOverlappingRectangleGroup(ctx, scaledPoint, entriesWithAlpha);
            const widths = entriesWithAlpha.map((entry) =>
              Math.max(1, Number(entry.rectangleWidth) || 0),
            );
            const heights = entriesWithAlpha.map((entry) =>
              Math.max(1, Number(entry.rectangleHeight) || 0),
            );
            const width = widths.length ? Math.max(...widths, 4) : 4;
            const height = heights.length ? Math.max(...heights, 4) : 4;
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            const padding = Math.max(8, Math.max(width, height) * 0.25);
            overlapRegion = {
              type: 'overlap-rect',
              left: scaledPoint.x - halfWidth - padding,
              right: scaledPoint.x + halfWidth + padding,
              top: scaledPoint.y - halfHeight - padding,
              bottom: scaledPoint.y + halfHeight + padding,
              canvasX: scaledPoint.x,
              canvasY: scaledPoint.y,
              routes: uniqueRouteIds,
              overlap: true,
            };
          }

          if (overlapRegion) {
            interactionRegions.push(overlapRegion);
          }
          return;
        }
      }

      visiblePoints.push(scaledPoint);
    });

    if (!pathPoints.length) {
      return;
    }

    const resolvedPointDiameter = getRoutePointDiameterForPathType(route, pathType);
    const rectangleWidth = normalizeRectangleSize(route.rectangleWidth, DEFAULT_RECTANGLE_WIDTH);
    const rectangleHeight = normalizeRectangleSize(route.rectangleHeight, DEFAULT_RECTANGLE_HEIGHT);

    ctx.save();
    ctx.globalAlpha = routeAlpha;

    if (pathType === PATH_TYPE_HOLLOW_POINT) {
      const circleRadius = Math.max(1, resolvedPointDiameter / 2);
      const strokeWidth = getRouteHollowPointLineWidth(route);
      if (visiblePoints.length) {
        const path = new Path2D();

        visiblePoints.forEach((point) => {
          path.moveTo(point.x + circleRadius, point.y);
          path.arc(point.x, point.y, circleRadius, 0, Math.PI * 2);
        });

        ctx.save();
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(path);
        ctx.restore();

        const padding = Math.max(4, strokeWidth / 2);
        visiblePoints.forEach((point) => {
          interactionRegions.push({
            type: 'circle',
            cx: point.x,
            cy: point.y,
            r: circleRadius + padding,
          });
        });
      }
    } else if (pathType === PATH_TYPE_FILLED_POINT) {
      const circleRadius = Math.max(1, resolvedPointDiameter / 2);
      if (visiblePoints.length) {
        const path = new Path2D();

        visiblePoints.forEach((point) => {
          path.moveTo(point.x + circleRadius, point.y);
          path.arc(point.x, point.y, circleRadius, 0, Math.PI * 2);
        });

        ctx.save();
        const filledTransparency = getRouteFilledPointTransparency(route);
        ctx.globalAlpha = routeAlpha * filledTransparency;
        ctx.fillStyle = strokeColor;
        ctx.fill(path);
        ctx.restore();

        const padding = Math.max(4, circleRadius / 2);
        visiblePoints.forEach((point) => {
          interactionRegions.push({
            type: 'circle',
            cx: point.x,
            cy: point.y,
            r: circleRadius + padding,
          });
        });
      }
    } else if (pathType === PATH_TYPE_RECTANGLE) {
      const rectWidth = Math.max(1, rectangleWidth);
      const rectHeight = Math.max(1, rectangleHeight);
      const halfWidth = Math.max(1, rectWidth / 2);
      const halfHeight = Math.max(1, rectHeight / 2);
      const strokeWidth = Math.max(2, Math.round(Math.max(rectWidth, rectHeight) / 10));
      if (visiblePoints.length) {
        const path = new Path2D();

        visiblePoints.forEach((point) => {
          path.rect(point.x - halfWidth, point.y - halfHeight, rectWidth, rectHeight);
        });

        ctx.save();
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = strokeColor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(path);
        ctx.restore();

        const padding = Math.max(4, strokeWidth / 2);
        visiblePoints.forEach((point) => {
          interactionRegions.push({
            type: 'rect',
            left: point.x - halfWidth - padding,
            right: point.x + halfWidth + padding,
            top: point.y - halfHeight - padding,
            bottom: point.y + halfHeight + padding,
          });
        });
      }
    } else if (pathType === PATH_TYPE_BEZIER && pathPoints.length >= 2) {
      const path = new Path2D();
      path.moveTo(pathPoints[0].x, pathPoints[0].y);

      for (let i = 0; i < pathPoints.length - 1; i++) {
        const p0 = i === 0 ? pathPoints[0] : pathPoints[i - 1];
        const p1 = pathPoints[i];
        const p2 = pathPoints[i + 1];
        const p3 = i + 2 < pathPoints.length ? pathPoints[i + 2] : pathPoints[i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }

      ctx.save();
      const strokeWidth = Math.max(6, Math.round(calculateRouteStrokeWidth(route, pathType)) || 6);
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = strokeColor;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(path);
      ctx.restore();

      const padding = Math.max(6, strokeWidth / 2 + 4);
      for (let i = 0; i < pathPoints.length - 1; i += 1) {
        const start = pathPoints[i];
        const end = pathPoints[i + 1];
        if (!start || !end) {
          continue;
        }

        interactionRegions.push({
          type: 'segment',
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          padding,
        });
      }
    }

    ctx.restore();
  });

  if (interactionRegions.length) {
    interactionRegions.forEach((region) => {
      if (!region) {
        return;
      }
      const interactionEntry = { ...region };
      if (!Object.prototype.hasOwnProperty.call(interactionEntry, 'route')) {
        interactionEntry.route = route;
      }
      routeInteractionEntries.push(interactionEntry);
    });
  }
}
function handlePointerMove(event) {
  updatePointerInteraction(event);

  if ('pointerType' in event) {
    const pointerType = event.pointerType;
    if (pointerType && pointerType !== 'mouse' && pointerType !== 'pen') {
      canvas.style.cursor = '';
      return;
    }
  }

  const point = extractClientPoint(event);
  if (!point) {
    canvas.style.cursor = '';
    return;
  }

  const entry = getRouteEntryAtClientPoint(point.x, point.y);

  if (entry && (entry.route || (Array.isArray(entry.routes) && entry.routes.length))) {
    canvas.style.cursor = 'pointer';
  } else {
    canvas.style.cursor = '';
    if (!pinnedRouteId) {
      hideTooltip();
    }
  }
}

function handlePointerLeave() {
  canvas.style.cursor = '';
  if (!pinnedRouteId) {
    hideTooltip();
  }
}

function handleCanvasPointerDown(event) {
  beginPointerInteraction(event);
}

function handleCanvasPointerUp(event) {
  const interaction = concludePointerInteraction(event);
  if (!interaction) {
    return;
  }

  if (interaction.dragging) {
    return;
  }

  const entry = getRouteEntryAtClientPoint(interaction.x, interaction.y);

  let resolvedEntry = entry;

  if (entry) {
    const candidateRoutes = Array.isArray(entry.routes)
      ? entry.routes.filter((value) => typeof value === 'string')
      : [];
    const resolvedRoutes = candidateRoutes
      .map((routeId) => routes.find((route) => route?.id === routeId))
      .filter(Boolean);

    if (resolvedRoutes.length > 1) {
      resetLastFocusActivation();
      const opened = openRouteOverlapPrompt(candidateRoutes, entry);
      if (opened) {
        return;
      }
    }

    if ((!entry.route || typeof entry.route !== 'object') && resolvedRoutes.length >= 1) {
      resolvedEntry = {
        ...entry,
        route: resolvedRoutes[0],
      };
    }
  }

  if (resolvedEntry && resolvedEntry.route) {
    const shouldFocusRoute = shouldFocusFromInteraction(event, resolvedEntry);
    showTooltip(resolvedEntry.route, interaction.x, interaction.y, { pin: true });
    if (shouldFocusRoute) {
      focusRoute(resolvedEntry.route);
    }
  } else {
    resetLastFocusActivation();
    hideTooltip({ force: true });
  }
}

function handleCanvasPointerCancel() {
  cancelPointerInteraction();
}

function handleDocumentPointerDown(event) {
  if (!tooltip) {
    return;
  }

  if (isRouteOverlapPromptOpen()) {
    return;
  }

  if (tooltip.contains(event.target)) {
    return;
  }

  hideTooltip({ force: true });
}

if (routeOverlapCloseButton) {
  routeOverlapCloseButton.addEventListener('click', () => {
    closeRouteOverlapPrompt();
  });
}

if (window.history && typeof window.history.pushState === 'function') {
  window.addEventListener('popstate', handleTooltipPopState);
}

if ('PointerEvent' in window) {
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('pointerdown', handleCanvasPointerDown);
  document.addEventListener('pointerup', handleCanvasPointerUp);
  document.addEventListener('pointercancel', handleCanvasPointerCancel);
  document.addEventListener('pointerdown', handleDocumentPointerDown);
} else {
  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseleave', handlePointerLeave);
  canvas.addEventListener('mousedown', handleCanvasPointerDown);
  document.addEventListener('mouseup', handleCanvasPointerUp);
  canvas.addEventListener('touchstart', handleCanvasPointerDown);
  canvas.addEventListener('touchmove', handlePointerMove);
  document.addEventListener('touchend', handleCanvasPointerUp);
  document.addEventListener('touchcancel', handleCanvasPointerCancel);
  document.addEventListener('mousedown', handleDocumentPointerDown);
  document.addEventListener('touchstart', handleDocumentPointerDown);
}

window.addEventListener('resize', resizeCanvas);

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
