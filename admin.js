import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  deleteField,
  WALL_COLLECTION,
  ROUTE_COLLECTION,
  USER_COLLECTION,
  ROUTE_SCORE_SUBCOLLECTION,
  ROUTE_BETATIPS_COLLECTION,
  BETATIP_UPVOTES_SUBCOLLECTION,
  SUBCOLLECTIONS_FIELD,
} from './admin_api.js';

const authOverlay = document.getElementById('authOverlay');
const authForm = document.getElementById('authForm');
const authUsername = document.getElementById('authUsername');
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
const adminApp = document.getElementById('adminApp');
const adminStatusMessage = document.getElementById('adminStatusMessage');
const unauthorizedNotice = document.getElementById('unauthorizedNotice');
const unauthorizedSignOut = document.getElementById('unauthorizedSignOut');
const adminDumpButton = document.getElementById('adminDumpButton');
const adminImportButton = document.getElementById('adminImportButton');
const adminImportInput = document.getElementById('adminImportInput');
const adminClearButton = document.getElementById('adminClearButton');
const adminSignOutButton = document.getElementById('adminSignOutButton');
const adminSetterToolsButton = document.getElementById('adminSetterToolsButton');
const removeOrphanedAscentsButton = document.getElementById('removeOrphanedAscentsButton');
const grantSetterButton = document.getElementById('grantSetterButton');
const revokeSetterButton = document.getElementById('revokeSetterButton');
const deleteUserButton = document.getElementById('deleteUserButton');
const roleStatusMessage = document.getElementById('roleStatusMessage');
const userActionPopup = document.getElementById('userActionPopup');
const userActionPopupInner = document.getElementById('userActionPopupInner');
const userActionPopupClose = document.getElementById('userActionPopupClose');
const popupSelectedUserName = document.getElementById('popupSelectedUserName');
const popupSelectedUserRole = document.getElementById('popupSelectedUserRole');
const popupSelectedUserRoleBadge = document.getElementById('popupSelectedUserRoleBadge');
const refreshUserListButton = document.getElementById('refreshUserListButton');
const userListElement = document.getElementById('userList');
const userListStatus = document.getElementById('userListStatus');
const userAccessManager = document.getElementById('userAccessManager');

const SYNTHETIC_EMAIL_DOMAIN = 'users.anuascend.local';
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const ROLE_SORT_ORDER = { admin: 0, setter: 1, default: 2 };

let currentAdminUser = null;
let currentAdminUsername = '';
let selectedUser = null;
let selectedListItem = null;
let roleControlsEnabled = false;
let userActionPopupVisible = false;
let pendingPopupRepositionFrame = null;

const normalizeUsername = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const isValidUsername = (value) => USERNAME_PATTERN.test(normalizeUsername(value));

const buildSyntheticEmail = (username) => {
  const normalized = normalizeUsername(username);
  return normalized ? `${normalized}@${SYNTHETIC_EMAIL_DOMAIN}` : '';
};

const formatUserDisplayName = (user) => {
  if (!user) {
    return 'the selected user';
  }

  const normalizedUsername = normalizeUsername(user.username || '');
  if (normalizedUsername) {
    return `@${normalizedUsername}`;
  }

  if (typeof user.displayName === 'string' && user.displayName.trim()) {
    return user.displayName.trim();
  }

  return 'the selected user';
};

const resolveRoleLabel = (roleValue) => {
  const normalized = typeof roleValue === 'string' ? roleValue.trim().toLowerCase() : '';
  if (normalized === 'admin') {
    return 'Admin';
  }
  if (normalized === 'setter') {
    return 'Setter';
  }
  return 'Default';
};

function updateUserActionAvailability() {
  const allow = roleControlsEnabled && Boolean(currentAdminUser);
  const hasSelection = Boolean(selectedUser);
  const normalizedRole = hasSelection
    ? (typeof selectedUser.roleValue === 'string'
        ? selectedUser.roleValue.trim().toLowerCase()
        : 'default')
    : 'default';
  const hasUsername = hasSelection && Boolean(normalizeUsername(selectedUser?.username || ''));
  const isCurrentAdmin = Boolean(
    currentAdminUser && selectedUser && selectedUser.uid === currentAdminUser.uid,
  );
  const isAdminRole = normalizedRole === 'admin';
  const isSetterRole = normalizedRole === 'setter';

  if (grantSetterButton) {
    grantSetterButton.disabled = !(
      allow && hasSelection && hasUsername && !isAdminRole && !isSetterRole
    );
  }

  if (revokeSetterButton) {
    revokeSetterButton.disabled = !(
      allow && hasSelection && isSetterRole && !isAdminRole && !isCurrentAdmin
    );
  }

  if (deleteUserButton) {
    deleteUserButton.disabled = !(
      allow && hasSelection && !isAdminRole && !isCurrentAdmin
    );
  }

  if (userActionPopup) {
    let popupState = 'empty';
    if (hasSelection) {
      popupState = allow ? 'ready' : 'disabled';
    }

    if (popupState === 'ready') {
      userActionPopup.classList.remove('user-action-popup--disabled');
    } else if (popupState === 'disabled') {
      userActionPopup.classList.add('user-action-popup--disabled');
    } else {
      userActionPopup.classList.remove('user-action-popup--disabled');
    }

    userActionPopup.dataset.state = popupState;
    userActionPopup.setAttribute('aria-disabled', popupState === 'ready' ? 'false' : 'true');
  }
}

function clearSelectedListItem() {
  if (selectedListItem) {
    selectedListItem.classList.remove('user-list-item--selected');
    selectedListItem.removeAttribute('aria-selected');
    selectedListItem = null;
  }
}

function focusFirstAvailableActionButton() {
  const buttons = [grantSetterButton, revokeSetterButton, deleteUserButton];
  for (const button of buttons) {
    if (button && !button.disabled) {
      button.focus({ preventScroll: true });
      return;
    }
  }
}

function positionUserActionPopup(target) {
  if (!userActionPopup || !target) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  const popupRect = userActionPopup.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
  const spacing = 12;

  let top = targetRect.bottom + scrollTop + spacing;
  let placement = 'bottom';

  if (top + popupRect.height > scrollTop + viewportHeight) {
    const candidateTop = targetRect.top + scrollTop - popupRect.height - spacing;
    if (candidateTop >= scrollTop + spacing) {
      top = candidateTop;
      placement = 'top';
    } else {
      top = Math.max(scrollTop + spacing, scrollTop + viewportHeight - popupRect.height - spacing);
    }
  }

  let left = targetRect.left + scrollLeft;
  const minLeft = scrollLeft + spacing;
  const maxLeft = scrollLeft + viewportWidth - popupRect.width - spacing;
  if (left < minLeft) {
    left = minLeft;
  } else if (left > maxLeft) {
    left = maxLeft;
  }

  userActionPopup.style.top = `${Math.round(top)}px`;
  userActionPopup.style.left = `${Math.round(left)}px`;
  userActionPopup.dataset.placement = placement;

  const anchorCenter = targetRect.left + targetRect.width / 2;
  const popupLeftInViewport = left - scrollLeft;
  const relativeAnchor = anchorCenter - popupLeftInViewport;
  const maxAnchor = popupRect.width ? Math.max(popupRect.width - 24, 24) : relativeAnchor;
  const clampedAnchor = Math.min(Math.max(relativeAnchor, 24), maxAnchor);
  userActionPopup.style.setProperty(
    '--user-action-popup-anchor',
    `${Math.round(clampedAnchor)}px`,
  );
}

function openUserActionPopup(target) {
  if (!userActionPopup || !target) {
    return;
  }

  userActionPopup.classList.remove('hidden');
  userActionPopup.setAttribute('aria-hidden', 'false');
  userActionPopupVisible = true;
  userActionPopup.style.visibility = 'hidden';
  userActionPopup.style.pointerEvents = 'none';

  requestAnimationFrame(() => {
    if (!userActionPopupVisible) {
      return;
    }

    positionUserActionPopup(target);
    userActionPopup.style.visibility = '';
    userActionPopup.style.pointerEvents = '';
    focusFirstAvailableActionButton();
  });
}

function closeUserActionPopup({ clearSelection = false } = {}) {
  if (!userActionPopup) {
    return;
  }

  if (pendingPopupRepositionFrame !== null) {
    cancelAnimationFrame(pendingPopupRepositionFrame);
    pendingPopupRepositionFrame = null;
  }

  userActionPopup.classList.add('hidden');
  userActionPopup.setAttribute('aria-hidden', 'true');
  userActionPopup.style.top = '';
  userActionPopup.style.left = '';
  userActionPopup.style.visibility = '';
  userActionPopup.style.pointerEvents = '';
  userActionPopupVisible = false;

  if (clearSelection) {
    clearSelectedListItem();
    selectedUser = null;
    updateSelectedUserUI(null);
    if (!roleStatusMessage || roleStatusMessage.dataset.variant !== 'success') {
      setRoleStatus('Select a user from the list to manage their access.', 'info');
    }
  }
}

function scheduleUserActionPopupReposition() {
  if (!userActionPopupVisible || !selectedListItem) {
    return;
  }

  if (pendingPopupRepositionFrame !== null) {
    return;
  }

  pendingPopupRepositionFrame = requestAnimationFrame(() => {
    pendingPopupRepositionFrame = null;
    if (userActionPopupVisible && selectedListItem) {
      positionUserActionPopup(selectedListItem);
    }
  });
}

function updateSelectedUserUI(user) {
  if (!userActionPopup) {
    return;
  }

  if (!user) {
    if (popupSelectedUserName) {
      popupSelectedUserName.textContent = 'No user selected';
    }
    if (popupSelectedUserRole) {
      popupSelectedUserRole.textContent = 'Select a user to manage their access.';
    }
    if (popupSelectedUserRoleBadge) {
      popupSelectedUserRoleBadge.textContent = '';
      popupSelectedUserRoleBadge.classList.add('hidden');
      delete popupSelectedUserRoleBadge.dataset.role;
    }
  } else {
    const displayLabel = formatUserDisplayName(user);
    const roleLabel = resolveRoleLabel(user.roleValue);

    if (popupSelectedUserName) {
      popupSelectedUserName.textContent = displayLabel;
    }
    if (popupSelectedUserRole) {
      popupSelectedUserRole.textContent = `Current role: ${roleLabel}`;
    }
    if (popupSelectedUserRoleBadge) {
      popupSelectedUserRoleBadge.textContent = roleLabel;
      popupSelectedUserRoleBadge.dataset.role = user.roleValue || 'default';
      popupSelectedUserRoleBadge.classList.remove('hidden');
    }
  }

  updateUserActionAvailability();
}

function handleUserSelection(user, listItem) {
  if (!user || !listItem) {
    return;
  }

  if (selectedListItem === listItem && selectedUser?.uid === user.uid) {
    if (userActionPopupVisible) {
      closeUserActionPopup({ clearSelection: true });
    } else {
      openUserActionPopup(listItem);
    }
    return;
  }

  clearSelectedListItem();
  selectedUser = user;
  selectedListItem = listItem;
  listItem.classList.add('user-list-item--selected');
  listItem.setAttribute('aria-selected', 'true');
  updateSelectedUserUI(user);
  openUserActionPopup(listItem);

  if (!roleStatusMessage || roleStatusMessage.dataset.variant !== 'success') {
    setRoleStatus('Use the popup to manage access for this user.', 'info');
  }
}

function setAdminStatus(message, variant = 'info') {
  if (!adminStatusMessage) {
    return;
  }

  if (!message) {
    adminStatusMessage.textContent = '';
    adminStatusMessage.classList.add('hidden');
    delete adminStatusMessage.dataset.variant;
    return;
  }

  adminStatusMessage.textContent = message;
  adminStatusMessage.classList.remove('hidden');
  if (variant) {
    adminStatusMessage.dataset.variant = variant;
  } else {
    delete adminStatusMessage.dataset.variant;
  }
}

function clearAdminStatus() {
  setAdminStatus('');
}

function setRoleStatus(message, variant = 'info') {
  if (!roleStatusMessage) {
    return;
  }

  if (!message) {
    roleStatusMessage.textContent = '';
    roleStatusMessage.classList.add('hidden');
    delete roleStatusMessage.dataset.variant;
    return;
  }

  roleStatusMessage.textContent = message;
  roleStatusMessage.classList.remove('hidden');
  if (variant) {
    roleStatusMessage.dataset.variant = variant;
  } else {
    delete roleStatusMessage.dataset.variant;
  }
}

function clearRoleStatus() {
  setRoleStatus('');
}

function setRoleControlsEnabled(enabled) {
  roleControlsEnabled = Boolean(enabled);
  updateUserActionAvailability();
}

function resetRoleManagementUI(message = '', variant = 'info') {
  closeUserActionPopup();
  clearSelectedListItem();
  selectedUser = null;
  updateSelectedUserUI(null);

  if (message) {
    setRoleStatus(message, variant);
  } else {
    setRoleStatus('Select a user from the list to manage their access.', 'info');
  }
}

resetRoleManagementUI();
setRoleControlsEnabled(false);

function setUserListStatus(message, variant = 'info') {
  if (!userListStatus) {
    return;
  }

  if (!message) {
    userListStatus.textContent = '';
    userListStatus.classList.add('hidden');
    delete userListStatus.dataset.variant;
    return;
  }

  userListStatus.textContent = message;
  userListStatus.classList.remove('hidden');
  if (variant) {
    userListStatus.dataset.variant = variant;
  } else {
    delete userListStatus.dataset.variant;
  }
}

function clearUserListStatus() {
  setUserListStatus('');
}

function setUserListControlsEnabled(enabled) {
  if (refreshUserListButton) {
    refreshUserListButton.disabled = !enabled;
  }
}

function resetUserListUI(message = '', variant = 'info') {
  if (userListElement) {
    userListElement.innerHTML = '';
    userListElement.classList.add('hidden');
  }

  if (message) {
    setUserListStatus(message, variant);
  } else {
    clearUserListStatus();
  }
}

function renderUserList(users) {
  if (!userListElement) {
    return;
  }

  userListElement.innerHTML = '';

  if (!Array.isArray(users) || users.length === 0) {
    userListElement.classList.add('hidden');
    setUserListStatus('No user profiles found.', 'info');
    resetRoleManagementUI('No user profiles found to manage.', 'info');
    return;
  }

  const fragment = document.createDocumentFragment();
  let matchedSelectedUser = null;
  let matchedListItem = null;

  for (const user of users) {
    const listItem = document.createElement('li');
    listItem.className = 'user-list-item';
    listItem.title = user.username ? `@${user.username}` : user.uid;
    listItem.tabIndex = 0;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-list-name';
    nameSpan.textContent = user.displayName;
    listItem.appendChild(nameSpan);

    if (user.roleLabel) {
      const roleSpan = document.createElement('span');
      roleSpan.className = 'user-role-badge';
      roleSpan.dataset.role = user.roleValue;
      roleSpan.textContent = user.roleLabel;
      listItem.appendChild(roleSpan);
    }

    listItem.addEventListener('click', () => {
      handleUserSelection(user, listItem);
    });

    listItem.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleUserSelection(user, listItem);
      }
    });

    if (selectedUser && selectedUser.uid === user.uid) {
      matchedSelectedUser = user;
      matchedListItem = listItem;
      listItem.classList.add('user-list-item--selected');
      listItem.setAttribute('aria-selected', 'true');
    }

    fragment.appendChild(listItem);
  }

  userListElement.appendChild(fragment);
  userListElement.classList.remove('hidden');
  const label = users.length === 1 ? 'user' : 'users';
  setUserListStatus(`Showing ${users.length} ${label}.`, 'info');

  if (selectedUser) {
    if (matchedSelectedUser && matchedListItem) {
      selectedUser = matchedSelectedUser;
      selectedListItem = matchedListItem;
      updateSelectedUserUI(selectedUser);
      if (userActionPopupVisible) {
        positionUserActionPopup(matchedListItem);
      }
    } else {
      resetRoleManagementUI('The previously selected user is no longer available.', 'warning');
    }
  }
}

async function refreshUserList() {
  if (!currentAdminUser) {
    resetUserListUI('Admin access required to view user profiles.', 'warning');
    return;
  }

  if (userListElement) {
    userListElement.innerHTML = '';
    userListElement.classList.add('hidden');
  }
  setUserListStatus('Loading user profiles…', 'info');

  const previousDisabled = refreshUserListButton ? refreshUserListButton.disabled : false;
  if (refreshUserListButton) {
    refreshUserListButton.disabled = true;
  }

  try {
    const snapshot = await getDocs(collection(db, 'users'));
    const users = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      const storedUsername =
        typeof data.username === 'string' ? data.username.trim() : '';
      const normalizedUsername = normalizeUsername(storedUsername);
      const roleValueRaw =
        typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';

      const resolvedRole = roleValueRaw || 'default';
      const roleLabel = resolveRoleLabel(resolvedRole);

      return {
        uid: docSnap.id,
        username: normalizedUsername,
        displayName: normalizedUsername ? `@${normalizedUsername}` : '(no username)',
        roleValue: resolvedRole,
        roleLabel,
      };
    });

    users.sort((a, b) => {
      const roleDifference =
        (ROLE_SORT_ORDER[a.roleValue] ?? 3) - (ROLE_SORT_ORDER[b.roleValue] ?? 3);
      if (roleDifference !== 0) {
        return roleDifference;
      }

      const nameA = a.username || '';
      const nameB = b.username || '';
      if (nameA && nameB) {
        return nameA.localeCompare(nameB);
      }
      if (nameA) {
        return -1;
      }
      if (nameB) {
        return 1;
      }
      return a.uid.localeCompare(b.uid);
    });

    renderUserList(users);
  } catch (error) {
    console.error('Failed to load user list:', error);
    setUserListStatus('Failed to load user list. Please try again.', 'error');
  } finally {
    if (refreshUserListButton) {
      refreshUserListButton.disabled = previousDisabled || !currentAdminUser;
    }
  }
}

resetUserListUI('Sign in to load user profiles.', 'info');
setUserListControlsEnabled(false);

function setControlsEnabled(enabled) {
  const allow = Boolean(enabled);
  [
    adminDumpButton,
    adminImportButton,
    adminClearButton,
    removeOrphanedAscentsButton,
    refreshUserListButton,
  ].forEach((button) => {
    if (button) {
      button.disabled = !allow;
    }
  });
  if (adminImportInput) {
    adminImportInput.disabled = !allow;
  }
  setRoleControlsEnabled(allow && Boolean(currentAdminUser));
  setUserListControlsEnabled(allow && Boolean(currentAdminUser));
}

function showAuthOverlay(message = '') {
  if (message) {
    authError.textContent = message;
  }
  authOverlay.classList.remove('hidden');
  authOverlay.removeAttribute('aria-hidden');
  adminApp.classList.add('hidden');
  adminApp.setAttribute('aria-hidden', 'true');
  unauthorizedNotice.classList.add('hidden');
  clearAdminStatus();
  resetRoleManagementUI('Sign in to manage user access.', 'info');
  resetUserListUI('Sign in to load user profiles.', 'info');
  setControlsEnabled(false);
  setUserListControlsEnabled(false);
}

function showAdminApp() {
  authOverlay.classList.add('hidden');
  authOverlay.setAttribute('aria-hidden', 'true');
  unauthorizedNotice.classList.add('hidden');
  adminApp.classList.remove('hidden');
  adminApp.removeAttribute('aria-hidden');
  resetRoleManagementUI('Select a user from the list to manage their access.', 'info');
  setRoleControlsEnabled(Boolean(currentAdminUser));
  resetUserListUI('Loading user profiles…', 'info');
  setUserListControlsEnabled(Boolean(currentAdminUser));
}

function showUnauthorizedNotice() {
  adminApp.classList.add('hidden');
  adminApp.setAttribute('aria-hidden', 'true');
  unauthorizedNotice.classList.remove('hidden');
  setControlsEnabled(false);
  clearAdminStatus();
  resetRoleManagementUI('Admin access required to manage user access.', 'warning');
  resetUserListUI('Admin access required to view user profiles.', 'warning');
  setUserListControlsEnabled(false);
}

function resetImportInput() {
  if (adminImportInput) {
    adminImportInput.value = '';
  }
}

function serializeFirestoreValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const dateValue = value.toDate();
      if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
        return dateValue.toISOString();
      }
      return dateValue;
    }

    if (value instanceof Uint8Array) {
      return Array.from(value);
    }

    if (typeof value.path === 'string' && typeof value.firestore === 'object') {
      return { __ref: value.path };
    }

    const serializedObject = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      serializedObject[key] = serializeFirestoreValue(nestedValue);
    }
    return serializedObject;
  }

  return value;
}

function serializeFirestoreDocument(docSnap) {
  if (!docSnap?.exists?.()) {
    return null;
  }

  const rawData = docSnap.data();
  const serializedData = serializeFirestoreValue(rawData);

  if (serializedData && typeof serializedData === 'object' && !Array.isArray(serializedData)) {
    return { id: docSnap.id, ...serializedData };
  }

  return { id: docSnap.id, value: serializedData };
}

function looksLikeIsoDateString(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/.test(value);
}

function deserializeFirestoreValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deserializeFirestoreValue(item));
  }

  if (typeof value === 'string' && looksLikeIsoDateString(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return Timestamp.fromDate(parsed);
    }
  }

  if (value && typeof value === 'object') {
    if (typeof value.__ref === 'string') {
      try {
        const refPath = value.__ref.trim();
        if (refPath) {
          const segments = refPath.split('/').filter(Boolean);
          if (segments.length >= 2) {
            return doc(db, ...segments);
          }
        }
      } catch (error) {
        console.warn('Unable to restore document reference from dump:', value.__ref, error);
      }
    }

    const deserialized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      deserialized[key] = deserializeFirestoreValue(nestedValue);
    }
    return deserialized;
  }

  return value;
}

function buildFirestorePayloadFromDumpEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return {};
  }

  const { id: _ignoredId, [SUBCOLLECTIONS_FIELD]: _ignoredSubcollections, ...rest } = entry;
  const candidate = deserializeFirestoreValue(rest);

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { value: candidate ?? null };
  }

  return candidate;
}

function ensureEntryHasId(entry, fallbackId = '') {
  const normalizedFallback = typeof fallbackId === 'string' ? fallbackId.trim() : '';

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    if (!normalizedFallback) {
      return { value: entry ?? null };
    }

    return { id: normalizedFallback, value: entry ?? null };
  }

  const copy = { ...entry };
  const existingId = typeof copy.id === 'string' ? copy.id.trim() : '';

  if (existingId) {
    copy.id = existingId;
    return copy;
  }

  if (!normalizedFallback) {
    return copy;
  }

  copy.id = normalizedFallback;
  return copy;
}

function normalizeDumpEntries(entries) {
  if (!entries) {
    return [];
  }

  const normalized = [];

  const pushNormalizedEntry = (entry, fallbackId) => {
    const prepared = ensureEntryHasId(entry, fallbackId);
    if (prepared) {
      normalized.push(prepared);
    }
  };

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      pushNormalizedEntry(entry);
    }
    return normalized;
  }

  if (typeof entries === 'object') {
    for (const [key, entry] of Object.entries(entries)) {
      pushNormalizedEntry(entry, key);
    }
    return normalized;
  }

  return normalized;
}

async function importSubcollections(parentRef, subcollections) {
  if (!parentRef || !subcollections || typeof subcollections !== 'object') {
    return { imported: 0, failed: 0 };
  }

  let imported = 0;
  let failed = 0;

  for (const [subKey, entries] of Object.entries(subcollections)) {
    if (!subKey) {
      continue;
    }

    const normalizedEntries = normalizeDumpEntries(entries);

    for (const entry of normalizedEntries) {
      if (!entry || typeof entry !== 'object') {
        failed += 1;
        continue;
      }

      const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
      if (!rawId) {
        failed += 1;
        continue;
      }

      try {
        const payload = buildFirestorePayloadFromDumpEntry(entry);
        const targetRef = doc(collection(parentRef, subKey), rawId);
        await setDoc(targetRef, payload);
        imported += 1;

        const nestedSubcollections = entry[SUBCOLLECTIONS_FIELD];
        if (nestedSubcollections && typeof nestedSubcollections === 'object') {
          const { imported: nestedImported, failed: nestedFailed } = await importSubcollections(
            targetRef,
            nestedSubcollections,
          );
          imported += nestedImported;
          failed += nestedFailed;
        }
      } catch (error) {
        console.error(`Failed to import document ${rawId} in ${parentRef.path}/${subKey}:`, error);
        failed += 1;
      }
    }
  }

  return { imported, failed };
}

const isPlainObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function buildRouteScoreSubcollection(entries) {
  if (!entries) {
    return null;
  }

  const normalized = {};

  const appendScore = (userId, value) => {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!normalizedUserId) {
      return;
    }

    if (value === null || value === undefined) {
      return;
    }

    let candidate;

    if (isPlainObject(value)) {
      const { id: _ignoredId, userId: _ignoredUserId, uid: _ignoredUid, ...rest } = value;

      candidate = {};
      for (const [key, nestedValue] of Object.entries(rest)) {
        if (nestedValue !== undefined) {
          candidate[key] = nestedValue;
        }
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      candidate = { value };
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      candidate = { value: trimmed };
    } else {
      return;
    }

    if (!isPlainObject(candidate) || Object.keys(candidate).length === 0) {
      return;
    }

    normalized[normalizedUserId] = candidate;
  };

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (!isPlainObject(entry)) {
        continue;
      }

      const candidateId =
        (typeof entry.id === 'string' && entry.id.trim()) ||
        (typeof entry.userId === 'string' && entry.userId.trim()) ||
        (typeof entry.uid === 'string' && entry.uid.trim()) ||
        '';

      const { id: _ignoredId, userId: _ignoredUserId, uid: _ignoredUid, ...rest } = entry;

      appendScore(candidateId, rest);
    }
  } else if (isPlainObject(entries)) {
    for (const [userId, value] of Object.entries(entries)) {
      if (isPlainObject(value)) {
        const { id: _ignoredId, userId: _ignoredUserId, uid: _ignoredUid, ...rest } = value;
        appendScore(userId, rest);
      } else {
        appendScore(userId, value);
      }
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function moveRouteScoresToSubcollection(entry) {
  if (!isPlainObject(entry) || !('scores' in entry)) {
    return entry;
  }

  const existingSubcollections = entry[SUBCOLLECTIONS_FIELD];
  if (isPlainObject(existingSubcollections) && existingSubcollections.scores) {
    delete entry.scores;
    return entry;
  }

  const subcollectionEntries = buildRouteScoreSubcollection(entry.scores);
  delete entry.scores;

  if (!subcollectionEntries) {
    return entry;
  }

  if (!isPlainObject(entry[SUBCOLLECTIONS_FIELD])) {
    entry[SUBCOLLECTIONS_FIELD] = {};
  }

  entry[SUBCOLLECTIONS_FIELD].scores = subcollectionEntries;

  return entry;
}

async function importCollectionEntries(collectionKey, entries) {
  const normalizedEntries = normalizeDumpEntries(entries);

  let imported = 0;
  let failed = 0;

  for (const entry of normalizedEntries) {
    if (!entry || typeof entry !== 'object') {
      failed += 1;
      continue;
    }

    const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!rawId) {
      failed += 1;
      continue;
    }

    try {
      if (collectionKey === ROUTE_COLLECTION) {
        moveRouteScoresToSubcollection(entry);
      }

      const payload = buildFirestorePayloadFromDumpEntry(entry);

      if (shouldPreserveAdminIdentity(collectionKey, rawId, payload)) {
        console.info(
          `Skipping ${collectionKey}/${rawId} because it belongs to the currently authenticated admin.`,
        );
        continue;
      }

      const targetRef = doc(db, collectionKey, rawId);
      await setDoc(targetRef, payload);
      imported += 1;

      const subcollections = entry[SUBCOLLECTIONS_FIELD];
      if (subcollections && typeof subcollections === 'object') {
        const { imported: subImported, failed: subFailed } = await importSubcollections(
          targetRef,
          subcollections,
        );
        imported += subImported;
        failed += subFailed;
      }
    } catch (error) {
      console.error(`Failed to import document ${rawId} in ${collectionKey}:`, error);
      failed += 1;
    }
  }

  return { imported, failed };
}

function extractCollectionsFromDump(dump) {
  if (!dump || typeof dump !== 'object') {
    throw new Error('Invalid database dump.');
  }

  if (dump.collections && typeof dump.collections === 'object') {
    return dump.collections;
  }

  if (dump.data && typeof dump.data === 'object') {
    return dump.data;
  }

  throw new Error('Database dump is missing collection data.');
}

async function importDatabaseDump(dump) {
  const collections = extractCollectionsFromDump(dump);

  let processedCollections = 0;
  let totalImported = 0;
  let totalFailed = 0;

  for (const [collectionKey, entries] of Object.entries(collections)) {
    if (!collectionKey || !entries || (typeof entries === 'object' && entries.error)) {
      continue;
    }

    const { imported, failed } = await importCollectionEntries(collectionKey, entries);
    if (imported || failed) {
      processedCollections += 1;
      totalImported += imported;
      totalFailed += failed;
    }
  }

  return { processedCollections, totalImported, totalFailed };
}

async function demoteImportedAdmins() {
  const result = { demoted: 0, skipped: 0, failed: 0 };

  if (!currentAdminUser) {
    return result;
  }

  try {
    const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
    const snapshot = await getDocs(adminQuery);

    for (const docSnap of snapshot.docs) {
      if (!docSnap) {
        continue;
      }

      const targetUid = docSnap.id;
      if (targetUid === currentAdminUser.uid) {
        result.skipped += 1;
        continue;
      }

      try {
        await setDoc(
          doc(db, 'users', targetUid),
          {
            role: 'setter',
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        result.demoted += 1;
      } catch (docError) {
        console.error(`Failed to demote admin ${targetUid}:`, docError);
        result.failed += 1;
      }
    }
  } catch (error) {
    console.error('Failed to resolve admin roles after import:', error);
    result.failed += 1;
  }

  return result;
}

function normalizeDocDataCandidate(docData) {
  if (!docData || typeof docData !== 'object' || Array.isArray(docData)) {
    return {};
  }

  if (docData.value && typeof docData.value === 'object' && !Array.isArray(docData.value)) {
    return docData.value;
  }

  return docData;
}

function shouldPreserveAdminIdentity(collectionKey, docId, docData) {
  if (!docId) {
    return false;
  }

  const adminUid = currentAdminUser?.uid || '';
  const normalizedAdminUsername = normalizeUsername(currentAdminUsername);

  if (collectionKey === 'users') {
    if (adminUid && docId === adminUid) {
      return true;
    }

    try {
      const candidate = normalizeDocDataCandidate(docData);
      const storedUsername = normalizeUsername(
        typeof candidate.username === 'string' ? candidate.username : '',
      );

      if (normalizedAdminUsername && storedUsername === normalizedAdminUsername) {
        return true;
      }
    } catch (error) {
      console.warn('Unable to evaluate user document for preservation:', error);
    }
  }

  return false;
}

async function lookupUsernameByUid(uid) {
  if (!uid) {
    return '';
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', uid));

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

async function fetchUserRole(user, username) {
  if (!user) {
    return 'default';
  }

  const normalizedUsername = normalizeUsername(username);
  if (!isValidUsername(normalizedUsername)) {
    return 'default';
  }

  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return 'default';
    }

    const data = userSnap.data() || {};
    const storedRole = typeof data.role === 'string' ? data.role.trim().toLowerCase() : '';
    const storedUsername = normalizeUsername(
      typeof data.username === 'string' ? data.username : '',
    );

    if (storedUsername !== normalizedUsername) {
      try {
        const conflictSnapshot = await getDocs(
          query(collection(db, 'users'), where('username', '==', normalizedUsername), limit(1)),
        );

        if (conflictSnapshot.empty || conflictSnapshot.docs[0].id === user.uid) {
          await setDoc(
            userRef,
            {
              username: normalizedUsername,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      } catch (metadataError) {
        console.warn('Unable to update user metadata for role lookup:', metadataError);
      }
    } else if (!data.updatedAt) {
      try {
        await setDoc(
          userRef,
          { updatedAt: serverTimestamp() },
          { merge: true },
        );
      } catch (timestampError) {
        console.warn('Unable to update user timestamp for role lookup:', timestampError);
      }
    }

    return storedRole ? storedRole : 'default';
  } catch (error) {
    console.error('Failed to resolve user role:', error);
    return 'default';
  }
}

async function handleSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Failed to sign out:', error);
  }
  currentAdminUser = null;
  currentAdminUsername = '';
  showAuthOverlay();
}

adminSignOutButton?.addEventListener('click', () => {
  void handleSignOut();
});

unauthorizedSignOut?.addEventListener('click', () => {
  void handleSignOut();
});

adminSetterToolsButton?.addEventListener('click', () => {
  window.location.href = 'setter.html';
});

refreshUserListButton?.addEventListener('click', () => {
  void refreshUserList();
});

userActionPopupClose?.addEventListener('click', () => {
  closeUserActionPopup({ clearSelection: true });
});

document.addEventListener('click', (event) => {
  if (!userActionPopupVisible || !userActionPopup) {
    return;
  }

  const target = event.target;
  if (userActionPopup.contains(target)) {
    return;
  }

  if (selectedListItem && selectedListItem.contains(target)) {
    return;
  }

  if (userAccessManager && userAccessManager.contains(target)) {
    return;
  }

  closeUserActionPopup({ clearSelection: true });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && userActionPopupVisible) {
    event.preventDefault();
    closeUserActionPopup({ clearSelection: true });
  }
});

window.addEventListener('resize', scheduleUserActionPopupReposition);
window.addEventListener('scroll', scheduleUserActionPopupReposition, { passive: true });

function ensureImportIntentHandled() {
  const hash = window.location.hash.replace('#', '').toLowerCase();
  if (hash === 'import' && adminImportButton && !adminImportButton.disabled) {
    adminImportButton.focus();
  }
  if (hash === 'clear' && adminClearButton && !adminClearButton.disabled) {
    adminClearButton.focus();
  }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = url;
  tempLink.download = filename;
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(url);
}

if (grantSetterButton) {
  grantSetterButton.addEventListener('click', async () => {
    if (!selectedUser) {
      setRoleStatus('Select a user from the list to manage their access.', 'info');
      return;
    }

    const previousState = roleControlsEnabled;
    setRoleControlsEnabled(false);

    try {
      const targetLabel = formatUserDisplayName(selectedUser);
      setRoleStatus(`Granting setter role to ${targetLabel}…`, 'info');

      const userDocRef = doc(db, 'users', selectedUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setRoleStatus('The selected user no longer exists.', 'error');
        clearSelectedListItem();
        selectedUser = null;
        updateSelectedUserUI(null);
        void refreshUserList();
        return;
      }

      const userData = userDocSnap.data() || {};
      const existingRole =
        typeof userData.role === 'string' ? userData.role.trim().toLowerCase() : 'default';
      const normalizedUsername = normalizeUsername(
        typeof userData.username === 'string' ? userData.username : selectedUser.username,
      );

      const usernameLabel = normalizedUsername ? `@${normalizedUsername}` : targetLabel;

      if (!normalizedUsername) {
        setRoleStatus('The selected user does not have a username configured.', 'warning');
        return;
      }

      if (existingRole === 'admin') {
        setRoleStatus(`${usernameLabel} already has admin access.`, 'info');
        return;
      }

      if (existingRole === 'setter') {
        setRoleStatus(`${usernameLabel} is already a setter.`, 'success');
        return;
      }

      await setDoc(
        userDocRef,
        {
          role: 'setter',
          username: normalizedUsername,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setRoleStatus(`Setter role granted to ${usernameLabel}.`, 'success');
      selectedUser = {
        ...selectedUser,
        username: normalizedUsername,
        displayName: `@${normalizedUsername}`,
        roleValue: 'setter',
        roleLabel: 'Setter',
      };
      updateSelectedUserUI(selectedUser);
      void refreshUserList();
    } catch (error) {
      console.error('Failed to grant setter role:', error);
      setRoleStatus('Unable to grant setter role. Please try again.', 'error');
    } finally {
      setRoleControlsEnabled(previousState);
    }
  });
}

if (revokeSetterButton) {
  revokeSetterButton.addEventListener('click', async () => {
    if (!selectedUser) {
      setRoleStatus('Select a user from the list to manage their access.', 'info');
      return;
    }

    if (currentAdminUser && selectedUser.uid === currentAdminUser.uid) {
      setRoleStatus('You cannot revoke your own setter role.', 'warning');
      return;
    }

    const previousState = roleControlsEnabled;
    setRoleControlsEnabled(false);

    try {
      const targetLabel = formatUserDisplayName(selectedUser);
      setRoleStatus(`Revoking setter role from ${targetLabel}…`, 'info');

      const userDocRef = doc(db, 'users', selectedUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setRoleStatus('The selected user no longer exists.', 'error');
        clearSelectedListItem();
        selectedUser = null;
        updateSelectedUserUI(null);
        void refreshUserList();
        return;
      }

      const userData = userDocSnap.data() || {};
      const existingRole =
        typeof userData.role === 'string' ? userData.role.trim().toLowerCase() : 'default';
      const normalizedUsername = normalizeUsername(
        typeof userData.username === 'string' ? userData.username : selectedUser.username,
      );
      const usernameLabel = normalizedUsername ? `@${normalizedUsername}` : targetLabel;

      if (existingRole === 'admin') {
        setRoleStatus(
          `${usernameLabel} is an admin. Admin roles must be managed separately.`,
          'warning',
        );
        return;
      }

      if (existingRole !== 'setter') {
        setRoleStatus(`${usernameLabel} does not have setter access.`, 'info');
        return;
      }

      await setDoc(
        userDocRef,
        {
          role: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setRoleStatus(`Setter role revoked for ${usernameLabel}.`, 'success');
      selectedUser = {
        ...selectedUser,
        roleValue: 'default',
        roleLabel: 'Default',
      };
      updateSelectedUserUI(selectedUser);
      void refreshUserList();
    } catch (error) {
      console.error('Failed to revoke setter role:', error);
      setRoleStatus('Unable to revoke setter role. Please try again.', 'error');
    } finally {
      setRoleControlsEnabled(previousState);
    }
  });
}

if (deleteUserButton) {
  deleteUserButton.addEventListener('click', async () => {
    if (!selectedUser) {
      setRoleStatus('Select a user from the list to manage their access.', 'info');
      return;
    }

    if (currentAdminUser && selectedUser.uid === currentAdminUser.uid) {
      setRoleStatus('You cannot delete your own admin account.', 'warning');
      return;
    }

    const previousState = roleControlsEnabled;
    setRoleControlsEnabled(false);

    try {
      const targetLabel = formatUserDisplayName(selectedUser);
      setRoleStatus(`Deleting account for ${targetLabel}…`, 'info');

      const userDocRef = doc(db, 'users', selectedUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        setRoleStatus('The selected user no longer exists.', 'error');
        clearSelectedListItem();
        selectedUser = null;
        updateSelectedUserUI(null);
        void refreshUserList();
        return;
      }

      const userData = userDocSnap.data() || {};
      const existingRole =
        typeof userData.role === 'string' ? userData.role.trim().toLowerCase() : 'default';
      const normalizedUsername = normalizeUsername(
        typeof userData.username === 'string' ? userData.username : selectedUser.username,
      );
      const usernameLabel = normalizedUsername ? `@${normalizedUsername}` : targetLabel;

      if (existingRole === 'admin') {
        setRoleStatus('Admin accounts cannot be deleted. Demote the user first.', 'warning');
        return;
      }

      const confirmed = window.confirm(
        `Delete the user profile for "${usernameLabel}"? This action cannot be undone.`,
      );

      if (!confirmed) {
        setRoleStatus('User deletion cancelled.', 'info');
        return;
      }

      await deleteDoc(userDocRef);

      setRoleStatus(`Deleted user profile for ${usernameLabel}.`, 'success');
      clearSelectedListItem();
      selectedUser = null;
      updateSelectedUserUI(null);
      void refreshUserList();
    } catch (error) {
      console.error('Failed to delete user:', error);
      setRoleStatus('Unable to delete user. Please try again.', 'error');
    } finally {
      setRoleControlsEnabled(previousState);
    }
  });
}

adminDumpButton?.addEventListener('click', async () => {
  if (adminDumpButton.disabled) {
    return;
  }

  setAdminStatus('Preparing database dump…', 'info');
  setControlsEnabled(false);

  try {
    const collectionsToExport = [
      { key: WALL_COLLECTION, ref: collection(db, WALL_COLLECTION) },
      {
        key: ROUTE_COLLECTION,
        ref: collection(db, ROUTE_COLLECTION),
        subcollections: [ROUTE_SCORE_SUBCOLLECTION],
      },
      { key: USER_COLLECTION, ref: collection(db, USER_COLLECTION) },
      {
        key: ROUTE_BETATIPS_COLLECTION,
        ref: collection(db, ROUTE_BETATIPS_COLLECTION),
        subcollections: [BETATIP_UPVOTES_SUBCOLLECTION],
      },
    ];

    const exportPayload = {
      metadata: {
        exportedAt: new Date().toISOString(),
        collections: collectionsToExport.map((entry) => entry.key),
      },
      data: {},
    };

    let hadCollectionError = false;

    for (const { key, ref, subcollections } of collectionsToExport) {
      try {
        const snapshot = await getDocs(ref);
        const documents = [];

        for (const docSnap of snapshot.docs) {
          const serialized = serializeFirestoreDocument(docSnap);
          if (!serialized) {
            continue;
          }

          if (Array.isArray(subcollections) && subcollections.length > 0) {
            for (const subKey of subcollections) {
              if (!subKey) {
                continue;
              }

              try {
                const subSnapshot = await getDocs(collection(docSnap.ref, subKey));
                const subEntries = subSnapshot.docs
                  .map((subDoc) => serializeFirestoreDocument(subDoc))
                  .filter(Boolean);

                if (!serialized[SUBCOLLECTIONS_FIELD]) {
                  serialized[SUBCOLLECTIONS_FIELD] = {};
                }
                serialized[SUBCOLLECTIONS_FIELD][subKey] = subEntries;
              } catch (subError) {
                hadCollectionError = true;
                console.error(
                  `Failed to export ${subKey} for ${key} ${docSnap.id}:`,
                  subError,
                );
                if (!serialized[SUBCOLLECTIONS_FIELD]) {
                  serialized[SUBCOLLECTIONS_FIELD] = {};
                }
                serialized[SUBCOLLECTIONS_FIELD][subKey] = [];
              }
            }
          }

          documents.push(serialized);
        }

        exportPayload.data[key] = documents;
      } catch (error) {
        hadCollectionError = true;
        console.error(`Failed to export ${key}:`, error);
        exportPayload.data[key] = {
          error: true,
          code: typeof error?.code === 'string' ? error.code : null,
          message: error?.message || 'Unable to export this collection.',
        };
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ascend-database-${timestamp}.json`;
    downloadJson(filename, exportPayload);

    if (hadCollectionError) {
      setAdminStatus('Database dump downloaded with some missing collections. Check console for details.', 'warning');
    } else {
      setAdminStatus('Database dump downloaded successfully.', 'success');
    }
  } catch (error) {
    console.error('Failed to generate database dump:', error);
    setAdminStatus('Failed to create database dump. Please try again.', 'error');
  } finally {
    setControlsEnabled(true);
  }
});

adminImportButton?.addEventListener('click', () => {
  if (adminImportButton.disabled) {
    return;
  }

  resetImportInput();
  adminImportInput?.click();
});

adminImportInput?.addEventListener('change', async (event) => {
  const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
  if (!file) {
    resetImportInput();
    return;
  }

  const sanitizedName = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : 'selected file';
  setAdminStatus(`Importing database from “${sanitizedName}”…`, 'info');
  setControlsEnabled(false);

  try {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error('The selected file is not valid JSON.');
    }

    const { processedCollections, totalImported, totalFailed } = await importDatabaseDump(parsed);

    let statusVariant = 'info';
    let statusMessage = '';

    if (!processedCollections) {
      statusVariant = 'warning';
      statusMessage = 'No collections were imported from the selected file.';
    } else if (totalFailed > 0) {
      statusVariant = 'error';
      statusMessage = `Imported ${totalImported} documents with ${totalFailed} errors. Check the console for details.`;
    } else {
      statusVariant = 'success';
      statusMessage = `Imported ${totalImported} documents from ${processedCollections} collections.`;
    }

    const demotionSummary = await demoteImportedAdmins();
    if (demotionSummary) {
      if (demotionSummary.demoted > 0) {
        const demotedSuffix =
          demotionSummary.demoted === 1
            ? 'Demoted 1 admin role to setter.'
            : `Demoted ${demotionSummary.demoted} admin roles to setter.`;
        statusMessage = statusMessage ? `${statusMessage} ${demotedSuffix}` : demotedSuffix;
      }

      if (demotionSummary.failed > 0) {
        const failureSuffix =
          demotionSummary.failed === 1
            ? 'Failed to demote 1 admin role. Check the console for details.'
            : `Failed to demote ${demotionSummary.failed} admin roles. Check the console for details.`;
        statusMessage = statusMessage ? `${statusMessage} ${failureSuffix}` : failureSuffix;
        statusVariant = 'error';
      }
    }

    setAdminStatus(statusMessage, statusVariant);

  } catch (error) {
    console.error('Failed to import database dump:', error);
    const fallbackMessage = 'Failed to import database dump. Please try again.';
    const message = error && typeof error.message === 'string' && error.message.trim()
      ? error.message.trim()
      : fallbackMessage;
    setAdminStatus(message, 'error');
  } finally {
    resetImportInput();
    setControlsEnabled(true);
  }
});

removeOrphanedAscentsButton?.addEventListener('click', async () => {
  if (removeOrphanedAscentsButton.disabled) {
    return;
  }

  setAdminStatus(
    'Scanning route score records for user entries linked to missing accounts…',
    'info',
  );
  setControlsEnabled(false);

  try {
    const [usersSnapshot, routesSnapshot] = await Promise.all([
      getDocs(collection(db, USER_COLLECTION)),
      getDocs(collection(db, ROUTE_COLLECTION)),
    ]);

    const existingUserIds = new Set();
    usersSnapshot.forEach((userDoc) => {
      if (userDoc?.id) {
        existingUserIds.add(userDoc.id);
      }
    });

    let checkedRoutes = 0;
    let cleanedRoutes = 0;
    let removedEntries = 0;
    let failedRemovals = 0;

    for (const routeDoc of routesSnapshot.docs) {
      checkedRoutes += 1;

      let routeHadChanges = false;

      try {
        const scoresSnapshot = await getDocs(collection(routeDoc.ref, ROUTE_SCORE_SUBCOLLECTION));

        for (const scoreDoc of scoresSnapshot.docs) {
          const scoreUserId = typeof scoreDoc.id === 'string' ? scoreDoc.id.trim() : '';
          if (!scoreUserId) {
            continue;
          }

          const scoreData = scoreDoc.data ? scoreDoc.data() : {};
          const entryIsScore =
            scoreData === null ||
            (scoreData &&
              typeof scoreData === 'object' &&
              !Array.isArray(scoreData) &&
              ('grade' in scoreData || 'ascended' in scoreData || 'value' in scoreData));

          if (!entryIsScore) {
            continue;
          }

          if (!existingUserIds.has(scoreUserId)) {
            try {
              await deleteDoc(scoreDoc.ref);
              removedEntries += 1;
              routeHadChanges = true;
            } catch (entryError) {
              failedRemovals += 1;
              console.error(
                `Failed to delete score ${scoreDoc.id} for route ${routeDoc.id}:`,
                entryError,
              );
            }
          }
        }
      } catch (routeError) {
        console.error(`Failed to inspect scores for route ${routeDoc.id}:`, routeError);
      }

      if (routeHadChanges) {
        cleanedRoutes += 1;
      }
    }

    if (removedEntries === 0 && failedRemovals === 0) {
      setAdminStatus(`Checked ${checkedRoutes} routes. No orphaned user entries found.`, 'info');
    } else if (failedRemovals > 0) {
      const entryLabel = removedEntries === 1 ? 'entry' : 'entries';
      setAdminStatus(
        `Removed ${removedEntries} orphaned user ${entryLabel} with ${failedRemovals} errors. Check the console for details.`,
        'error',
      );
    } else {
      const routeLabel = cleanedRoutes === 1 ? 'route' : 'routes';
      const entryLabel = removedEntries === 1 ? 'entry' : 'entries';
      setAdminStatus(
        `Removed ${removedEntries} orphaned user ${entryLabel} across ${cleanedRoutes} ${routeLabel}.`,
        'success',
      );
    }
  } catch (error) {
    console.error('Failed to remove orphaned user entries:', error);
    setAdminStatus('Failed to remove orphaned user entries. Check console for details.', 'error');
  } finally {
    setControlsEnabled(true);
  }
});

adminClearButton?.addEventListener('click', async () => {
  if (adminClearButton.disabled) {
    return;
  }

  const confirmed = window.confirm(
    'Clear the database? This will permanently delete walls, routes, and user accounts. This cannot be undone.',
  );

  if (!confirmed) {
    return;
  }

  setAdminStatus('Clearing database…', 'info');
  setControlsEnabled(false);

  try {
    const collectionsToClear = [
      { key: WALL_COLLECTION, ref: collection(db, WALL_COLLECTION) },
      {
        key: ROUTE_COLLECTION,
        ref: collection(db, ROUTE_COLLECTION),
        subcollections: [ROUTE_SCORE_SUBCOLLECTION],
      },
      { key: USER_COLLECTION, ref: collection(db, USER_COLLECTION) },
      {
        key: ROUTE_BETATIPS_COLLECTION,
        ref: collection(db, ROUTE_BETATIPS_COLLECTION),
        subcollections: [BETATIP_UPVOTES_SUBCOLLECTION],
      },
    ];

    let deletedCount = 0;
    let failureCount = 0;

    for (const { key, ref, subcollections } of collectionsToClear) {
      try {
        const snapshot = await getDocs(ref);
        for (const docSnap of snapshot.docs) {
          if (shouldPreserveAdminIdentity(key, docSnap.id, docSnap.data ? docSnap.data() : {})) {
            continue;
          }
          try {
            if (Array.isArray(subcollections) && subcollections.length > 0) {
              for (const subKey of subcollections) {
                if (!subKey) {
                  continue;
                }

                try {
                  const subSnapshot = await getDocs(collection(docSnap.ref, subKey));
                  for (const subDoc of subSnapshot.docs) {
                    try {
                      await deleteDoc(subDoc.ref);
                      deletedCount += 1;
                    } catch (subDocError) {
                      console.error(
                        `Failed to delete ${subKey} document ${subDoc.id} for ${key} ${docSnap.id}:`,
                        subDocError,
                      );
                      failureCount += 1;
                    }
                  }
                } catch (subcollectionError) {
                  console.error(
                    `Failed to fetch ${subKey} for ${key} ${docSnap.id}:`,
                    subcollectionError,
                  );
                  failureCount += 1;
                }
              }
            }

            await deleteDoc(docSnap.ref);
            deletedCount += 1;
          } catch (docError) {
            console.error(`Failed to delete ${docSnap.id} in ${key}:`, docError);
            failureCount += 1;
          }
        }
      } catch (collectionError) {
        console.error(`Failed to clear ${key}:`, collectionError);
        failureCount += 1;
      }
    }

    if (deletedCount === 0 && failureCount === 0) {
      setAdminStatus('Database was already empty.', 'info');
    } else if (failureCount > 0) {
      setAdminStatus(
        `Cleared ${deletedCount} documents with ${failureCount} errors. Check the console for details.`,
        'error',
      );
    } else {
      setAdminStatus(`Cleared ${deletedCount} documents from the database.`, 'success');
    }
  } catch (error) {
    console.error('Failed to clear database:', error);
    setAdminStatus('Failed to clear database. Please try again.', 'error');
  } finally {
    setControlsEnabled(true);
  }
});

authForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const normalizedUsername = normalizeUsername(authUsername.value);
  const password = authPassword.value;

  if (!isValidUsername(normalizedUsername)) {
    authError.textContent = 'Enter a valid username (letters, numbers, underscores).';
    return;
  }

  if (!password) {
    authError.textContent = 'Enter your password to continue.';
    return;
  }

  authError.textContent = '';

  try {
    const email = buildSyntheticEmail(normalizedUsername);
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    let message = 'Unable to sign in. Please try again.';
    switch (error?.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        message = 'Invalid username or password.';
        break;
      case 'auth/too-many-requests':
        message = 'Too many attempts. Try again later.';
        break;
      default:
        if (error?.message) {
          message = error.message;
        }
    }
    authError.textContent = message;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentAdminUser = null;
    currentAdminUsername = '';
    showAuthOverlay();
    authForm?.reset();
    return;
  }

  const resolvedUsername = await resolveUsernameForUser(user);
  if (!isValidUsername(resolvedUsername)) {
    await handleSignOut();
    authError.textContent = 'Unable to resolve your username. Please contact an admin.';
    return;
  }

  const role = await fetchUserRole(user, resolvedUsername);
  if (role !== 'admin') {
    currentAdminUser = null;
    currentAdminUsername = '';
    showUnauthorizedNotice();
    return;
  }

  currentAdminUser = user;
  currentAdminUsername = resolvedUsername;
  showAdminApp();
  setControlsEnabled(true);
  void refreshUserList();
  clearAdminStatus();
  ensureImportIntentHandled();
});
