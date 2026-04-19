const $ = id => document.getElementById(id);

const state = {
  user: loadSession(),
  pins: [],
  library: {
    likedPinIds: [],
    savedPinIds: [],
    boards: [],
    followingEmails: [],
  },
  activePage: 'home',
  activeCategory: 'all',
  searchQuery: '',
  currentDetailPin: null,
  savedSearches: loadSavedSearches(),
  notifications: loadNotifications(),
  commentReplyParentId: null,
};

const elements = {
  pinsContainer: $('pinsContainer'),
  explorePinsContainer: $('explorePinsContainer'),
  searchInput: $('searchInput'),
  navLinks: Array.from(document.querySelectorAll('.nav-link')),
  categories: Array.from(document.querySelectorAll('.category')),
  loginBtn: $('loginBtn'),
  signupBtn: $('signupBtn'),
  loginModal: $('loginModal'),
  signupModal: $('signupModal'),
  createModal: $('createModal'),
  pinDetailModal: $('pinDetailModal'),
  createBoardModal: $('createBoardModal'),
  editProfileModal: $('editProfileModal'),
  loginForm: $('loginForm'),
  signupForm: $('signupForm'),
  createPinForm: $('createPinForm'),
  createBoardForm: $('createBoardForm'),
  editProfileForm: $('editProfileForm'),
  imageUploadContainer: $('imageUploadContainer'),
  imageUpload: $('imageUpload'),
  imagePreview: $('imagePreview'),
  loggedOutActions: $('loggedOutActions'),
  loggedInActions: $('loggedInActions'),
  profilePage: $('profilePage'),
  profileCreatedPins: $('profileCreatedPins'),
  profileSavedPins: $('profileSavedPins'),
  profileBoardsGrid: $('profileBoardsGrid'),
  profileName: $('profileName'),
  profileEmail: $('profileEmail'),
  profileBio: $('profileBio'),
  profileInitial: $('profileInitial'),
  profileAvatar: $('profileAvatar'),
  profilePinsCount: $('profilePinsCount'),
  profileBoardsCount: $('profileBoardsCount'),
  profileSavesCount: $('profileSavesCount'),
  avatarInitial: $('avatarInitial'),
  detailImage: $('detailImage'),
  detailTitle: $('detailTitle'),
  detailDesc: $('detailDesc'),
  detailCreatorAvatar: $('detailCreatorAvatar'),
  detailCreatorName: $('detailCreatorName'),
  detailCreatorSub: $('detailCreatorSub'),
  detailFollowBtn: $('detailFollowBtn'),
  detailLikeBtn: $('detailLikeBtn'),
  detailShareBtn: $('detailShareBtn'),
  detailMoreBtn: $('detailMoreBtn'),
  detailSaveBtn: $('detailSaveBtn'),
  commentsList: $('commentsList'),
  commentInputWrapper: $('commentInputWrapper'),
  commentInput: $('commentInput'),
  commentSubmitBtn: $('commentSubmitBtn'),
  boardSelect: $('boardSelect'),
  notifBtn: $('notifBtn'),
  msgBtn: $('msgBtn'),
  editProfileBtn: $('editProfileBtn'),
  logoutBtn: $('logoutBtn'),
  profileBtn: $('profileBtn'),
  logoLink: $('logoLink'),
  heroSection: $('heroSection'),
  heroWords: document.querySelector('.hero-words'),
  heroDots: Array.from(document.querySelectorAll('.hero-dots .dot')),
  mainFooter: $('mainFooter'),
  toastContainer: $('toastContainer'),
  pinStatus: $('pinStatus'),
  pinPublishAt: $('pinPublishAt'),
  pinPublishAtGroup: $('pinPublishAtGroup'),
  pinTags: $('pinTags'),
  boardVisibility: $('boardVisibility'),
  saveSearchPresetBtn: $('saveSearchPresetBtn'),
  savedSearchPresets: $('savedSearchPresets'),
  themeToggleBtn: $('themeToggleBtn'),
  notificationsModal: $('notificationsModal'),
  notificationsList: $('notificationsList'),
  clearNotificationsBtn: $('clearNotificationsBtn'),
};

let uploadedImage = null;
let heroInterval = null;
let hasShownApiFallbackNotice = false;

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('beforeunload', persistSession);

async function init() {
  wireEvents();
  applyTheme(loadThemePreference());
  syncAuthUI();
  updatePublishingMode();
  renderSavedSearches();
  await Promise.all([loadPins(), hydrateUserContext()]);
  applyFilters();
  startHeroRotation();
}

function loadSavedSearches() {
  try {
    const raw = localStorage.getItem('mypins.savedSearches');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadNotifications() {
  try {
    const raw = localStorage.getItem('mypins.notifications');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistNotifications() {
  localStorage.setItem('mypins.notifications', JSON.stringify(state.notifications.slice(0, 40)));
}

function persistSavedSearches() {
  localStorage.setItem('mypins.savedSearches', JSON.stringify(state.savedSearches.slice(0, 10)));
}

function loadSession() {
  try {
    const saved = localStorage.getItem('mypins.session');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function loadThemePreference() {
  return localStorage.getItem('mypins.theme') || 'light';
}

function applyTheme(theme) {
  const normalized = theme === 'dark' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', normalized);
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.innerHTML = normalized === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    elements.themeToggleBtn.setAttribute('aria-label', normalized === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    elements.themeToggleBtn.title = normalized === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('mypins.theme', next);
  applyTheme(next);
}

function persistSession() {
  if (state.user) {
    localStorage.setItem('mypins.session', JSON.stringify(state.user));
  } else {
    localStorage.removeItem('mypins.session');
  }
}

function clearSession() {
  state.user = null;
  state.library = { likedPinIds: [], savedPinIds: [], boards: [], followingEmails: [] };
  state.currentDetailPin = null;
  localStorage.removeItem('mypins.session');
}

function apiHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (state.user?.token) {
    headers.Authorization = `Bearer ${state.user.token}`;
  }
  return headers;
}

async function apiRequest(url, options = {}) {
  const headers = apiHeaders(options.headers || {});
  const finalOptions = { ...options, headers };

  if (finalOptions.body && !(finalOptions.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, finalOptions);
  const contentType = response.headers.get('content-type') || '';
  const rawText = await response.text();
  let payload = {};

  if (rawText) {
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = {};
      }
    } else {
      payload = { message: rawText };
    }
  }

  if (!response.ok) {
    const raw = String(rawText || '').trim();
    const likelyHtml = /^<!doctype html|^<html/i.test(raw);

    if (likelyHtml) {
      if (response.status === 404) {
        throw new Error('API endpoint not found. Start the backend with npm run dev.');
      }
      throw new Error('API unavailable. Please make sure the backend server is running.');
    }

    throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

async function loadPinsFromStaticFallback() {
  try {
    const response = await fetch('./pins.json', { cache: 'no-store' });
    if (!response.ok) return false;

    const pins = await response.json();
    if (!Array.isArray(pins)) return false;

    state.pins = pins;
    applyFilters();
    return true;
  } catch {
    return false;
  }
}

async function loadPins() {
  try {
    const { pins } = await apiRequest('/api/pins');
    state.pins = Array.isArray(pins) ? pins : [];
    applyFilters();
  } catch (error) {
    const loadedFromFallback = await loadPinsFromStaticFallback();
    if (loadedFromFallback) {
      if (!hasShownApiFallbackNotice) {
        showToast('API unavailable, showing local pins data.');
        hasShownApiFallbackNotice = true;
      }
      return;
    }

    showToast(error.message, 'error');
    state.pins = [];
    applyFilters();
  }
}

async function hydrateUserContext() {
  if (!state.user?.token) {
    updateProfileSkeleton();
    return;
  }

  try {
    const [me, library] = await Promise.all([
      apiRequest('/api/me'),
      apiRequest('/api/me/library'),
    ]);

    state.user = { ...state.user, ...me.user };
    state.library = {
      likedPinIds: library.likedPinIds || [],
      savedPinIds: library.savedPinIds || [],
      boards: library.boards || [],
      followingEmails: library.followingEmails || [],
    };
    persistSession();
    syncAuthUI();
    renderProfile(me);
    populateBoardSelect();
    renderDetailButtons();
  } catch (error) {
    clearSession();
    syncAuthUI();
    showToast('Your session expired. Please sign in again.', 'error');
  }
}

function updateProfileSkeleton() {
  if (elements.profileName) elements.profileName.textContent = 'User';
  if (elements.profileEmail) elements.profileEmail.textContent = '@username';
  if (elements.profileBio) elements.profileBio.textContent = '';
  if (elements.profilePinsCount) elements.profilePinsCount.textContent = '0';
  if (elements.profileBoardsCount) elements.profileBoardsCount.textContent = '0';
  if (elements.profileSavesCount) elements.profileSavesCount.textContent = '0';
}

function syncAuthUI() {
  const loggedIn = Boolean(state.user?.token);

  elements.loggedOutActions?.classList.toggle('hidden', loggedIn);
  elements.loggedInActions?.classList.toggle('hidden', !loggedIn);

  const existingCreate = document.querySelector('.create-nav-btn');
  if (loggedIn && !existingCreate) {
    const createLink = document.createElement('a');
    createLink.href = '#';
    createLink.className = 'nav-link create-nav-btn';
    createLink.textContent = 'Create';
    createLink.addEventListener('click', event => {
      event.preventDefault();
      openModal(elements.createModal);
    });
    $('mainNav')?.appendChild(createLink);
  }

  if (!loggedIn && existingCreate) {
    existingCreate.remove();
  }

  const initial = getInitialFromUser(state.user);
  if (elements.avatarInitial) elements.avatarInitial.textContent = initial;
  if (elements.profileInitial) elements.profileInitial.textContent = initial;
  if (elements.detailCreatorAvatar && !elements.detailCreatorAvatar.textContent.trim()) {
    elements.detailCreatorAvatar.textContent = initial;
  }

  if (elements.heroSection) {
    elements.heroSection.classList.toggle('hidden', loggedIn || state.activePage !== 'home');
  }
}

function getInitialFromUser(user) {
  if (!user) return 'U';
  const name = user.displayName || user.email || 'U';
  return String(name).trim()[0]?.toUpperCase() || 'U';
}

function wireEvents() {
  elements.loginBtn?.addEventListener('click', () => openModal(elements.loginModal));
  elements.signupBtn?.addEventListener('click', () => openModal(elements.signupModal));
  elements.logoutBtn?.addEventListener('click', logout);
  elements.profileBtn?.addEventListener('click', () => {
    if (!state.user?.token) {
      openModal(elements.loginModal);
      return;
    }
    showPage('profile');
    hydrateUserContext();
  });
  elements.editProfileBtn?.addEventListener('click', () => {
    if (!state.user?.token) return openModal(elements.loginModal);
    populateEditProfileForm();
    openModal(elements.editProfileModal);
  });
  elements.notifBtn?.addEventListener('click', () => {
    renderNotifications();
    openModal(elements.notificationsModal);
  });
  elements.msgBtn?.addEventListener('click', () => showToast('Messages are ready for the next release.'));
  elements.clearNotificationsBtn?.addEventListener('click', clearNotifications);
  elements.logoLink?.addEventListener('click', event => {
    event.preventDefault();
    showPage('home');
  });

  elements.navLinks.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      if (link.classList.contains('create-nav-btn')) {
        if (!state.user?.token) return openModal(elements.loginModal);
        openModal(elements.createModal);
        return;
      }
      showPage(link.dataset.page || 'home');
    });
  });

  elements.categories.forEach(category => {
    category.addEventListener('click', () => {
      elements.categories.forEach(item => item.classList.remove('active'));
      category.classList.add('active');
      state.activeCategory = category.dataset.category || 'all';
      applyFilters();
    });
  });

  elements.searchInput?.addEventListener('input', event => {
    state.searchQuery = String(event.target.value || '').trim().toLowerCase();
    applyFilters();
  });

  elements.loginForm?.addEventListener('submit', handleLogin);
  elements.signupForm?.addEventListener('submit', handleSignup);
  elements.createPinForm?.addEventListener('submit', handleCreatePin);
  elements.createBoardForm?.addEventListener('submit', handleCreateBoard);
  elements.editProfileForm?.addEventListener('submit', handleEditProfile);
  elements.pinStatus?.addEventListener('change', updatePublishingMode);
  elements.saveSearchPresetBtn?.addEventListener('click', saveCurrentSearchPreset);
  elements.themeToggleBtn?.addEventListener('click', toggleTheme);

  elements.imageUploadContainer?.addEventListener('click', () => elements.imageUpload?.click());
  elements.imageUpload?.addEventListener('change', handleImagePreview);

  $('closeLoginModal')?.addEventListener('click', () => closeModal(elements.loginModal));
  $('closeSignupModal')?.addEventListener('click', () => closeModal(elements.signupModal));
  $('closeCreateModal')?.addEventListener('click', () => resetCreateModal());
  $('closeCreateBoardModal')?.addEventListener('click', () => closeModal(elements.createBoardModal));
  $('closeEditProfileModal')?.addEventListener('click', () => closeModal(elements.editProfileModal));
  $('closeNotificationsModal')?.addEventListener('click', () => closeModal(elements.notificationsModal));
  $('switchToSignup')?.addEventListener('click', event => {
    event.preventDefault();
    closeModal(elements.loginModal);
    openModal(elements.signupModal);
  });
  $('switchToLogin')?.addEventListener('click', event => {
    event.preventDefault();
    closeModal(elements.signupModal);
    openModal(elements.loginModal);
  });

  elements.detailLikeBtn?.addEventListener('click', () => toggleLike());
  elements.detailSaveBtn?.addEventListener('click', () => toggleSave());
  elements.detailShareBtn?.addEventListener('click', () => shareCurrentPin());
  elements.detailMoreBtn?.addEventListener('click', () => deleteCurrentPin());
  elements.detailFollowBtn?.addEventListener('click', () => toggleFollowCreator());
  elements.commentSubmitBtn?.addEventListener('click', submitComment);
  elements.commentInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitComment();
    }
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement !== elements.searchInput) {
      event.preventDefault();
      elements.searchInput?.focus();
      return;
    }
    if (event.key.toLowerCase() === 'c' && state.user?.token) {
      event.preventDefault();
      openModal(elements.createModal);
      return;
    }
    if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      showPage('explore');
      return;
    }
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(modal => closeModal(modal));
    }
  });

  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.profile-tab').forEach(item => item.classList.remove('active'));
      tab.classList.add('active');
      switchProfileTab(tab.dataset.tab || 'created');
    });
  });
}

function openModal(modal) {
  modal?.classList.add('active');
}

function closeModal(modal) {
  modal?.classList.remove('active');
}

function showPage(page) {
  state.activePage = page;

  document.querySelectorAll('.page-content').forEach(section => {
    section.classList.add('hidden');
    section.style.display = 'none';
  });

  elements.navLinks.forEach(link => link.classList.remove('active'));

  if (page === 'home') {
    $('homePage')?.classList.remove('hidden');
    $('homePage') && ($('homePage').style.display = 'block');
    document.querySelector('[data-page="home"]')?.classList.add('active');
  } else if (page === 'explore') {
    $('explorePage')?.classList.remove('hidden');
    $('explorePage') && ($('explorePage').style.display = 'block');
    document.querySelector('[data-page="explore"]')?.classList.add('active');
  } else if (page === 'profile') {
    elements.profilePage?.classList.remove('hidden');
    elements.profilePage && (elements.profilePage.style.display = 'block');
    document.querySelector('[data-page="home"]')?.classList.add('active');
    hydrateUserContext();
    loadProfileContent();
  }

  if (elements.heroSection) {
    elements.heroSection.classList.toggle('hidden', page !== 'home' || Boolean(state.user?.token));
  }

  if (elements.mainFooter) {
    elements.mainFooter.classList.remove('hidden');
  }

  applyFilters();
  syncAuthUI();
}

function applyFilters() {
  const filtered = state.pins.filter(pin => {
    const matchesCategory = state.activeCategory === 'all' || pin.category === state.activeCategory;
    const query = state.searchQuery;
    const text = `${pin.title} ${pin.description || ''} ${pin.category} ${pin.createdBy || ''}`.toLowerCase();
    const matchesSearch = !query || text.includes(query);
    return matchesCategory && matchesSearch;
  });

  const container = state.activePage === 'explore' ? elements.explorePinsContainer : elements.pinsContainer;
  renderPins(filtered, container);
}

function saveCurrentSearchPreset() {
  const query = (elements.searchInput?.value || '').trim();
  const category = state.activeCategory;
  if (!query && category === 'all') {
    showToast('Add a search term or category first.', 'error');
    return;
  }

  const label = query ? `${query} (${category})` : `Category: ${category}`;
  const already = state.savedSearches.find(item => item.query === query && item.category === category);
  if (already) {
    showToast('This search preset already exists.');
    return;
  }

  state.savedSearches.unshift({
    id: Date.now(),
    label,
    query,
    category,
  });
  persistSavedSearches();
  renderSavedSearches();
  showToast('Search preset saved.');
}

function applySavedSearchPreset(presetId) {
  const preset = state.savedSearches.find(item => item.id === presetId);
  if (!preset) return;
  state.activeCategory = preset.category || 'all';
  state.searchQuery = (preset.query || '').toLowerCase();
  if (elements.searchInput) {
    elements.searchInput.value = preset.query || '';
  }
  elements.categories.forEach(item => item.classList.toggle('active', item.dataset.category === state.activeCategory));
  showPage('explore');
  applyFilters();
}

function removeSavedSearchPreset(presetId) {
  state.savedSearches = state.savedSearches.filter(item => item.id !== presetId);
  persistSavedSearches();
  renderSavedSearches();
}

function renderSavedSearches() {
  if (!elements.savedSearchPresets) return;
  elements.savedSearchPresets.innerHTML = '';

  if (!state.savedSearches.length) {
    const hint = document.createElement('span');
    hint.className = 'board-count';
    hint.textContent = 'No saved searches yet';
    elements.savedSearchPresets.appendChild(hint);
    return;
  }

  state.savedSearches.slice(0, 6).forEach(preset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'profile-edit-btn';
    button.style.padding = '6px 10px';
    button.style.fontSize = '12px';
    button.textContent = preset.label;
    button.addEventListener('click', () => applySavedSearchPreset(preset.id));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'detail-action-btn';
    remove.style.width = '26px';
    remove.style.height = '26px';
    remove.innerHTML = '<i class="fas fa-xmark"></i>';
    remove.setAttribute('aria-label', 'Remove saved search');
    remove.addEventListener('click', event => {
      event.stopPropagation();
      removeSavedSearchPreset(preset.id);
    });

    const wrap = document.createElement('div');
    wrap.style.display = 'inline-flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '4px';
    wrap.appendChild(button);
    wrap.appendChild(remove);
    elements.savedSearchPresets.appendChild(wrap);
  });
}

function addNotification(message, type = 'info') {
  state.notifications.unshift({ id: Date.now(), message, type, createdAt: new Date().toISOString() });
  persistNotifications();
  renderNotifications();
}

function clearNotifications() {
  state.notifications = [];
  persistNotifications();
  renderNotifications();
  showToast('Notifications cleared.');
}

function renderNotifications() {
  if (!elements.notificationsList) return;
  elements.notificationsList.innerHTML = '';
  if (!state.notifications.length) {
    const empty = document.createElement('p');
    empty.className = 'no-comments';
    empty.textContent = 'No notifications yet.';
    elements.notificationsList.appendChild(empty);
    return;
  }

  state.notifications.slice(0, 20).forEach(item => {
    const entry = document.createElement('div');
    entry.className = 'comment-item';

    const avatar = document.createElement('div');
    avatar.className = 'comment-avatar';
    avatar.textContent = item.type === 'success' ? 'S' : item.type === 'warning' ? 'W' : 'N';

    const body = document.createElement('div');
    body.className = 'comment-body';

    const title = document.createElement('span');
    title.className = 'comment-author';
    title.textContent = item.message;

    const time = document.createElement('span');
    time.className = 'comment-time';
    time.textContent = formatTimeAgo(item.createdAt);

    body.appendChild(title);
    body.appendChild(time);
    entry.appendChild(avatar);
    entry.appendChild(body);
    elements.notificationsList.appendChild(entry);
  });
}

function renderPins(pins, container) {
  if (!container) return;
  container.innerHTML = '';

  if (!pins.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = state.searchQuery || state.activeCategory !== 'all' ? 'No pins match your search.' : 'No pins yet.';
    container.appendChild(empty);
    return;
  }

  pins.forEach((pin, index) => {
    container.appendChild(createPinCard(pin, index));
  });
}

function createPinCard(pin, index) {
  const card = document.createElement('article');
  card.className = 'pin animate-in';
  card.style.animationDelay = `${Math.min(index, 12) * 0.04}s`;
  card.dataset.id = String(pin.id);

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'pin-img-wrapper';

  const image = document.createElement('img');
  image.className = 'pin-image';
  image.loading = 'lazy';
  image.alt = pin.title;
  image.src = pin.imageUrl;
  image.onerror = () => {
    image.src = fallbackImage(pin.title);
  };

  const overlay = document.createElement('div');
  overlay.className = 'pin-overlay';

  const overlayTop = document.createElement('div');
  overlayTop.className = 'pin-overlay-top';

  const saveButton = document.createElement('button');
  saveButton.className = 'pin-save-btn';
  saveButton.type = 'button';
  saveButton.setAttribute('aria-label', `Save ${pin.title}`);
  saveButton.textContent = state.library.savedPinIds.includes(pin.id) ? 'Saved' : 'Save';
  if (state.library.savedPinIds.includes(pin.id)) saveButton.classList.add('saved');
  saveButton.addEventListener('click', event => {
    event.stopPropagation();
    openPinDetail(pin.id);
  });

  overlayTop.appendChild(saveButton);

  const overlayBottom = document.createElement('div');
  overlayBottom.className = 'pin-overlay-bottom';

  const overlayActions = document.createElement('div');
  overlayActions.style.display = 'flex';
  overlayActions.style.gap = '6px';

  const shareButton = document.createElement('button');
  shareButton.className = 'pin-action-btn';
  shareButton.type = 'button';
  shareButton.setAttribute('aria-label', `Share ${pin.title}`);
  shareButton.innerHTML = '<i class="fas fa-share-alt"></i>';
  shareButton.addEventListener('click', event => {
    event.stopPropagation();
    sharePin(pin.id);
  });

  const openButton = document.createElement('button');
  openButton.className = 'pin-action-btn';
  openButton.type = 'button';
  openButton.setAttribute('aria-label', `Open ${pin.title}`);
  openButton.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i>';
  openButton.addEventListener('click', event => {
    event.stopPropagation();
    openPinDetail(pin.id);
  });

  overlayActions.appendChild(shareButton);
  overlayActions.appendChild(openButton);
  overlayBottom.appendChild(document.createElement('div'));
  overlayBottom.appendChild(overlayActions);

  overlay.appendChild(overlayTop);
  overlay.appendChild(overlayBottom);

  imageWrapper.appendChild(image);
  imageWrapper.appendChild(overlay);
  imageWrapper.addEventListener('click', () => openPinDetail(pin.id));

  const info = document.createElement('div');
  info.className = 'pin-info';

  const category = document.createElement('div');
  category.className = 'pin-category';
  category.textContent = pin.category || 'other';

  if (pin.status && pin.status !== 'published') {
    const status = document.createElement('div');
    status.className = 'pin-category';
    status.style.marginLeft = '6px';
    status.style.background = 'rgba(191, 106, 79, 0.12)';
    status.style.color = 'var(--accent-dark)';
    status.textContent = pin.status;
    category.appendChild(status);
  }

  const title = document.createElement('div');
  title.className = 'pin-title';
  title.textContent = pin.title;

  const stats = document.createElement('div');
  stats.className = 'pin-stats';
  const likes = document.createElement('span');
  likes.innerHTML = `<i class="fas fa-heart"></i> ${Number(pin.likes || 0)}`;
  const saves = document.createElement('span');
  saves.innerHTML = `<i class="fas fa-bookmark"></i> ${Number(pin.saves || 0)}`;
  stats.appendChild(likes);
  stats.appendChild(saves);

  const meta = document.createElement('div');
  meta.className = 'pin-meta';
  const creator = document.createElement('div');
  creator.className = 'pin-creator';
  const avatar = document.createElement('div');
  avatar.className = 'pin-creator-avatar';
  avatar.textContent = getInitialFromValue(pin.createdBy || 'M');
  const creatorName = document.createElement('span');
  creatorName.textContent = (pin.createdBy || 'MyPins').split('@')[0];
  creator.appendChild(avatar);
  creator.appendChild(creatorName);
  meta.appendChild(creator);

  if (Array.isArray(pin.tags) && pin.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'board-count';
    tags.textContent = pin.tags.slice(0, 3).map(tag => `#${tag}`).join(' ');
    meta.appendChild(tags);
  }

  info.appendChild(category);
  info.appendChild(title);
  info.appendChild(stats);
  info.appendChild(meta);

  card.appendChild(imageWrapper);
  card.appendChild(info);
  card.addEventListener('click', () => openPinDetail(pin.id));
  return card;
}

function fallbackImage(label) {
  const safeLabel = encodeURIComponent(label || 'Image');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><rect width="800" height="1000" rx="40" fill="#f3efe9"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="36" fill="#6f6257">${safeLabel}</text></svg>`)}`;
}

function getInitialFromValue(value) {
  return String(value || 'U').trim()[0]?.toUpperCase() || 'U';
}

async function openPinDetail(pinId) {
  try {
    const pin = await apiRequest(`/api/pins/${pinId}`);
    state.currentDetailPin = pin;
    renderPinDetail(pin);
    populateBoardSelect();
    openModal(elements.pinDetailModal);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderPinDetail(pin) {
  if (!pin) return;

  if (elements.detailImage) {
    elements.detailImage.src = pin.imageUrl;
    elements.detailImage.alt = pin.title;
    elements.detailImage.onerror = () => {
      elements.detailImage.src = fallbackImage(pin.title);
    };
  }
  if (elements.detailTitle) elements.detailTitle.textContent = pin.title;
  if (elements.detailDesc) elements.detailDesc.textContent = pin.description || '';
  if (elements.detailCreatorAvatar) elements.detailCreatorAvatar.textContent = getInitialFromValue(pin.createdBy || 'M');
  if (elements.detailCreatorName) elements.detailCreatorName.textContent = (pin.createdBy || 'MyPins').split('@')[0];
  if (elements.detailCreatorSub) elements.detailCreatorSub.textContent = pin.createdBy || 'MyPins official';
  const tagString = Array.isArray(pin.tags) && pin.tags.length ? `\n\n${pin.tags.map(tag => `#${tag}`).join(' ')}` : '';
  if (elements.detailDesc && tagString && !elements.detailDesc.textContent.includes('#')) {
    elements.detailDesc.textContent = `${elements.detailDesc.textContent}${tagString}`.trim();
  }
  if (elements.commentInputWrapper) elements.commentInputWrapper.style.display = state.user?.token ? 'flex' : 'none';

  renderDetailButtons();
  renderComments(pin.comments || []);
}

function renderDetailButtons() {
  if (!state.currentDetailPin) return;
  const isLiked = state.library.likedPinIds.includes(state.currentDetailPin.id);
  const isSaved = state.library.savedPinIds.includes(state.currentDetailPin.id);
  const isOwner = Boolean(state.user?.token) && (state.currentDetailPin.createdBy === state.user.email || state.user.email === 'admin@mypins.com');
  const creatorEmail = state.currentDetailPin.createdBy || '';
  const isFollowingCreator = state.library.followingEmails.includes(creatorEmail);

  if (elements.detailLikeBtn) {
    elements.detailLikeBtn.classList.toggle('liked', isLiked);
    elements.detailLikeBtn.innerHTML = isLiked ? '<i class="fas fa-heart"></i>' : '<i class="far fa-heart"></i>';
    elements.detailLikeBtn.setAttribute('aria-label', isLiked ? 'Unlike pin' : 'Like pin');
  }
  if (elements.detailSaveBtn) {
    elements.detailSaveBtn.classList.toggle('saved', isSaved);
    elements.detailSaveBtn.textContent = isSaved ? 'Saved' : 'Save';
  }
  if (elements.detailMoreBtn) {
    elements.detailMoreBtn.innerHTML = isOwner ? '<i class="fas fa-trash"></i>' : '<i class="fas fa-ellipsis"></i>';
    elements.detailMoreBtn.title = isOwner ? 'Delete pin' : 'More options';
    elements.detailMoreBtn.setAttribute('aria-label', isOwner ? 'Delete pin' : 'More options');
  }
  if (elements.detailFollowBtn) {
    const canFollow = Boolean(state.user?.token) && creatorEmail && creatorEmail !== state.user.email;
    elements.detailFollowBtn.style.display = canFollow ? 'inline-flex' : 'none';
    if (canFollow) {
      elements.detailFollowBtn.innerHTML = isFollowingCreator ? '<i class="fas fa-user-check"></i>' : '<i class="fas fa-user-plus"></i>';
      elements.detailFollowBtn.title = isFollowingCreator ? 'Unfollow creator' : 'Follow creator';
      elements.detailFollowBtn.setAttribute('aria-label', isFollowingCreator ? 'Unfollow creator' : 'Follow creator');
    }
  }
}

function renderComments(comments) {
  if (!elements.commentsList) return;
  elements.commentsList.innerHTML = '';

  if (!comments.length) {
    const empty = document.createElement('p');
    empty.className = 'no-comments';
    empty.textContent = 'No comments yet. Be the first.';
    elements.commentsList.appendChild(empty);
    return;
  }

  const roots = comments.filter(comment => !comment.parentId);
  const repliesByParent = new Map();
  comments.filter(comment => comment.parentId).forEach(comment => {
    const key = Number(comment.parentId);
    if (!repliesByParent.has(key)) repliesByParent.set(key, []);
    repliesByParent.get(key).push(comment);
  });

  const createCommentItem = (comment, isReply = false) => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    if (isReply) {
      item.style.marginLeft = '22px';
      item.style.marginTop = '6px';
    }

    const avatar = document.createElement('div');
    avatar.className = 'comment-avatar';
    avatar.textContent = getInitialFromValue(comment.displayName || comment.email);

    const body = document.createElement('div');
    body.className = 'comment-body';

    const author = document.createElement('span');
    author.className = 'comment-author';
    author.textContent = comment.displayName || comment.email.split('@')[0];

    const text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = comment.text;

    const time = document.createElement('span');
    time.className = 'comment-time';
    const editedSuffix = comment.editedAt ? ' · edited' : '';
    time.textContent = `${formatTimeAgo(comment.createdAt)}${editedSuffix}`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginTop = '6px';

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'detail-action-btn';
    replyBtn.style.width = 'auto';
    replyBtn.style.height = '26px';
    replyBtn.style.padding = '0 8px';
    replyBtn.textContent = 'Reply';
    replyBtn.addEventListener('click', () => beginReplyToComment(comment));
    actions.appendChild(replyBtn);

    const canEdit = Boolean(state.user?.token) && (state.user.email === comment.email || state.user.email === 'admin@mypins.com');
    if (canEdit) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'detail-action-btn';
      editBtn.style.width = 'auto';
      editBtn.style.height = '26px';
      editBtn.style.padding = '0 8px';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => editComment(comment));
      actions.appendChild(editBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'detail-action-btn';
      deleteBtn.style.width = 'auto';
      deleteBtn.style.height = '26px';
      deleteBtn.style.padding = '0 8px';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteComment(comment));
      actions.appendChild(deleteBtn);
    }

    body.appendChild(author);
    body.appendChild(text);
    body.appendChild(time);
    body.appendChild(actions);
    item.appendChild(avatar);
    item.appendChild(body);
    return item;
  };

  roots.forEach(comment => {
    elements.commentsList.appendChild(createCommentItem(comment));
    const replies = repliesByParent.get(comment.id) || [];
    replies.forEach(reply => {
      elements.commentsList.appendChild(createCommentItem(reply, true));
    });
  });
}

function formatTimeAgo(dateString) {
  const diffMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = $('loginEmail')?.value.trim();
  const password = $('loginPassword')?.value.trim();

  try {
    const response = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    state.user = { ...response.user, token: response.token };
    persistSession();
    closeModal(elements.loginModal);
    elements.loginForm?.reset();
    await hydrateUserContext();
    await loadPins();
    showPage('home');
    showToast(`Welcome back, ${state.user.displayName}!`);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleSignup(event) {
  event.preventDefault();
  const email = $('signupEmail')?.value.trim();
  const password = $('signupPassword')?.value.trim();
  const displayName = $('signupName')?.value.trim();

  try {
    const response = await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });

    state.user = { ...response.user, token: response.token };
    persistSession();
    closeModal(elements.signupModal);
    elements.signupForm?.reset();
    await hydrateUserContext();
    await loadPins();
    showPage('home');
    showToast('Account created successfully.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleEditProfile(event) {
  event.preventDefault();
  if (!state.user?.token) return;

  const displayName = $('editDisplayName')?.value.trim();
  const bio = $('editBio')?.value.trim();
  const avatar = $('editAvatar')?.value.trim();

  try {
    const response = await apiRequest('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ displayName, bio, avatar }),
    });

    state.user = { ...state.user, ...response.user };
    persistSession();
    closeModal(elements.editProfileModal);
    await hydrateUserContext();
    await loadProfileContent();
    showToast('Profile updated.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleCreatePin(event) {
  event.preventDefault();
  if (!state.user?.token) {
    openModal(elements.loginModal);
    return;
  }

  const title = $('pinTitle')?.value.trim();
  const description = $('pinDescription')?.value.trim();
  const category = $('pinCategory')?.value || 'other';
  const status = elements.pinStatus?.value || 'published';
  const publishAt = elements.pinPublishAt?.value || '';
  const tags = elements.pinTags?.value || '';
  const file = elements.imageUpload?.files?.[0];

  if (!title || !file) {
    showToast('Title and image are required.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description || '');
  formData.append('category', category);
  formData.append('status', status);
  formData.append('publishAt', publishAt);
  formData.append('tags', tags);
  formData.append('image', file);

  try {
    await apiRequest('/api/pins', {
      method: 'POST',
      body: formData,
    });

    resetCreateModal();
    await loadPins();
    showPage('home');
    addNotification(status === 'draft' ? 'Draft saved.' : status === 'scheduled' ? 'A pin was scheduled for publishing.' : 'A pin was published.', 'success');
    showToast(status === 'draft' ? 'Draft saved.' : status === 'scheduled' ? 'Pin scheduled successfully.' : 'Pin published successfully.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleCreateBoard(event) {
  event.preventDefault();
  if (!state.user?.token) return;

  const name = $('boardName')?.value.trim();
  const description = $('boardDescription')?.value.trim();
  const visibility = elements.boardVisibility?.value || 'private';

  if (!name) {
    showToast('Board name is required.', 'error');
    return;
  }

  try {
    await apiRequest('/api/boards', {
      method: 'POST',
      body: JSON.stringify({ name, description, visibility }),
    });

    elements.createBoardForm?.reset();
    closeModal(elements.createBoardModal);
    await hydrateUserContext();
    await loadProfileContent();
    populateBoardSelect();
    addNotification(`Board created: ${name}`, 'success');
    showToast('Board created.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updatePublishingMode() {
  const selected = elements.pinStatus?.value || 'published';
  if (elements.pinPublishAtGroup) {
    elements.pinPublishAtGroup.style.display = selected === 'scheduled' ? 'block' : 'none';
  }
}

async function toggleFollowCreator() {
  if (!state.user?.token || !state.currentDetailPin) {
    openModal(elements.loginModal);
    return;
  }

  const creatorEmail = state.currentDetailPin.createdBy || '';
  if (!creatorEmail || creatorEmail === state.user.email) return;

  try {
    const result = await apiRequest(`/api/users/${encodeURIComponent(creatorEmail)}/follow`, { method: 'POST' });
    await hydrateUserContext();
    renderDetailButtons();
    addNotification(result.following ? 'Now following this creator.' : 'Stopped following this creator.', 'info');
    showToast(result.following ? 'Now following creator.' : 'Unfollowed creator.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleImagePreview(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  uploadedImage = file;

  const reader = new FileReader();
  reader.onload = loadEvent => {
    if (elements.imagePreview) {
      elements.imagePreview.src = String(loadEvent.target?.result || '');
      elements.imagePreview.style.display = 'block';
    }
    elements.imageUploadContainer?.querySelector('i')?.classList.add('hidden');
    elements.imageUploadContainer?.querySelector('p')?.classList.add('hidden');
    const hint = elements.imageUploadContainer?.querySelector('.upload-hint');
    if (hint) hint.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function resetCreateModal() {
  closeModal(elements.createModal);
  elements.createPinForm?.reset();
  updatePublishingMode();
  uploadedImage = null;
  if (elements.imagePreview) {
    elements.imagePreview.src = '';
    elements.imagePreview.style.display = 'none';
  }
  const icon = elements.imageUploadContainer?.querySelector('i');
  const paragraph = elements.imageUploadContainer?.querySelector('p');
  const hint = elements.imageUploadContainer?.querySelector('.upload-hint');
  if (icon) icon.classList.remove('hidden');
  if (paragraph) paragraph.classList.remove('hidden');
  if (hint) hint.style.display = 'block';
}

async function toggleLike() {
  if (!state.user?.token || !state.currentDetailPin) {
    openModal(elements.loginModal);
    return;
  }

  try {
    await apiRequest(`/api/pins/${state.currentDetailPin.id}/like`, { method: 'POST' });
    await refreshLibraryAndPins(false);
    const pin = await apiRequest(`/api/pins/${state.currentDetailPin.id}`);
    state.currentDetailPin = pin;
    renderPinDetail(pin);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function toggleSave() {
  if (!state.user?.token || !state.currentDetailPin) {
    openModal(elements.loginModal);
    return;
  }

  try {
    const boardId = elements.boardSelect?.value ? Number(elements.boardSelect.value) : null;
    await apiRequest(`/api/pins/${state.currentDetailPin.id}/save`, {
      method: 'POST',
      body: JSON.stringify({ boardId }),
    });
    await refreshLibraryAndPins(false);
    const pin = await apiRequest(`/api/pins/${state.currentDetailPin.id}`);
    state.currentDetailPin = pin;
    renderPinDetail(pin);
    addNotification('Pin saved to your collection.', 'success');
    showToast('Pin saved.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function submitComment() {
  if (!state.user?.token || !state.currentDetailPin) {
    openModal(elements.loginModal);
    return;
  }

  const text = elements.commentInput?.value.trim();
  if (!text) return;

  try {
    await apiRequest(`/api/pins/${state.currentDetailPin.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text, parentId: state.commentReplyParentId }),
    });

    elements.commentInput.value = '';
    state.commentReplyParentId = null;
    if (elements.commentInput) elements.commentInput.placeholder = 'Add a comment...';
    const pin = await apiRequest(`/api/pins/${state.currentDetailPin.id}`);
    state.currentDetailPin = pin;
    renderPinDetail(pin);
    addNotification('Comment posted.', 'success');
    showToast('Comment added.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function beginReplyToComment(comment) {
  if (!state.user?.token) {
    openModal(elements.loginModal);
    return;
  }
  state.commentReplyParentId = comment.id;
  if (elements.commentInput) {
    const name = (comment.displayName || comment.email || 'user').split('@')[0];
    elements.commentInput.placeholder = `Replying to ${name}...`;
    elements.commentInput.focus();
  }
}

async function editComment(comment) {
  const nextText = window.prompt('Edit your comment', comment.text || '');
  if (nextText === null) return;
  const text = nextText.trim();
  if (!text) {
    showToast('Comment cannot be empty.', 'error');
    return;
  }

  try {
    await apiRequest(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ text }),
    });
    const pin = await apiRequest(`/api/pins/${state.currentDetailPin.id}`);
    state.currentDetailPin = pin;
    renderPinDetail(pin);
    showToast('Comment updated.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteComment(comment) {
  const confirmed = window.confirm('Delete this comment and its replies?');
  if (!confirmed) return;

  try {
    await apiRequest(`/api/comments/${comment.id}`, { method: 'DELETE' });
    const pin = await apiRequest(`/api/pins/${state.currentDetailPin.id}`);
    state.currentDetailPin = pin;
    renderPinDetail(pin);
    showToast('Comment deleted.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function shareCurrentPin() {
  if (!state.currentDetailPin) return;
  sharePin(state.currentDetailPin.id);
}

async function deleteCurrentPin() {
  if (!state.currentDetailPin) return;

  if (!state.user?.token) {
    openModal(elements.loginModal);
    return;
  }

  const ownerEmail = state.currentDetailPin.createdBy || '';
  const canDelete = ownerEmail === state.user.email || state.user.email === 'admin@mypins.com';
  if (!canDelete) {
    showToast('You can only delete pins you created.', 'error');
    return;
  }

  const confirmed = window.confirm('Delete this pin? This cannot be undone.');
  if (!confirmed) return;

  try {
    await apiRequest(`/api/pins/${state.currentDetailPin.id}`, { method: 'DELETE' });
    closeModal(elements.pinDetailModal);
    state.currentDetailPin = null;
    await refreshLibraryAndPins(true);
    addNotification('Pin moved to trash.', 'warning');
    showToast('Pin deleted.');
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function sharePin(pinId) {
  const url = `${window.location.origin}${window.location.pathname}?pin=${pinId}`;
  if (navigator.share) {
    navigator.share({ title: 'MyPins', text: 'Check out this pin', url }).catch(() => {});
    return;
  }
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard.');
  }).catch(() => {
    showToast('Could not copy link.', 'error');
  });
}

async function refreshLibraryAndPins(reRenderProfile = false) {
  await Promise.all([loadPins(), hydrateUserContext()]);
  if (reRenderProfile) {
    await loadProfileContent();
  }
}

async function loadProfileContent() {
  if (!state.user?.token) return;

  try {
    const [me, savedPins, boards] = await Promise.all([
      apiRequest('/api/me'),
      apiRequest('/api/me/saves'),
      apiRequest('/api/me/boards'),
    ]);

    renderProfile(me, savedPins.pins || [], boards.boards || []);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderProfile(me, savedPins = [], boards = []) {
  if (!me?.user) return;

  const user = me.user;
  const stats = me.stats || {};

  if (elements.profileName) elements.profileName.textContent = user.displayName || user.email.split('@')[0];
  if (elements.profileEmail) elements.profileEmail.textContent = `@${user.email.split('@')[0]}`;
  if (elements.profileBio) elements.profileBio.textContent = user.bio || 'Curate ideas, collections, and inspiration.';
  if (elements.profilePinsCount) elements.profilePinsCount.textContent = String(stats.pins || 0);
  if (elements.profileBoardsCount) elements.profileBoardsCount.textContent = String(stats.boards || 0);
  if (elements.profileSavesCount) elements.profileSavesCount.textContent = String(stats.saves || 0);
  if (elements.profileInitial) elements.profileInitial.textContent = getInitialFromValue(user.displayName || user.email);
  if (elements.profileAvatar) {
    const currentImage = elements.profileAvatar.querySelector('img');
    if (user.avatar) {
      if (!currentImage) {
        elements.profileAvatar.innerHTML = '';
        const img = document.createElement('img');
        img.alt = user.displayName || user.email;
        img.src = user.avatar;
        elements.profileAvatar.appendChild(img);
      } else {
        currentImage.src = user.avatar;
      }
    } else {
      if (currentImage) currentImage.remove();
      elements.profileAvatar.textContent = getInitialFromValue(user.displayName || user.email);
    }
  }

  renderPins(state.pins.filter(pin => pin.createdBy === user.email), elements.profileCreatedPins);
  renderPins(savedPins, elements.profileSavedPins);
  renderBoards(boards);
  populateBoardSelect();
}

function renderBoards(boards) {
  if (!elements.profileBoardsGrid) return;
  elements.profileBoardsGrid.innerHTML = '';

  if (!boards.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No boards yet. Create one to organize your pins.';
    elements.profileBoardsGrid.appendChild(empty);
    return;
  }

  boards.forEach(board => {
    const card = document.createElement('article');
    card.className = 'board-card';

    const cover = document.createElement('div');
    cover.className = 'board-cover';

    const coverMain = document.createElement('div');
    coverMain.className = 'board-cover-main';
    const mainImage = board.pins?.[0]?.imageUrl;
    if (mainImage) {
      const img = document.createElement('img');
      img.alt = board.name;
      img.src = mainImage;
      coverMain.appendChild(img);
    }

    const coverSmallA = document.createElement('div');
    coverSmallA.className = 'board-cover-small';
    const smallA = board.pins?.[1]?.imageUrl;
    if (smallA) {
      const img = document.createElement('img');
      img.alt = board.name;
      img.src = smallA;
      coverSmallA.appendChild(img);
    }

    const coverSmallB = document.createElement('div');
    coverSmallB.className = 'board-cover-small';
    const smallB = board.pins?.[2]?.imageUrl;
    if (smallB) {
      const img = document.createElement('img');
      img.alt = board.name;
      img.src = smallB;
      coverSmallB.appendChild(img);
    }

    cover.appendChild(coverMain);
    cover.appendChild(coverSmallA);
    cover.appendChild(coverSmallB);

    const info = document.createElement('div');
    info.className = 'board-info';

    const name = document.createElement('div');
    name.className = 'board-name';
    name.textContent = board.name;

    const count = document.createElement('div');
    count.className = 'board-count';
    count.textContent = `${board.pinCount || 0} pins`;

    info.appendChild(name);
    info.appendChild(count);
    card.appendChild(cover);
    card.appendChild(info);
    elements.profileBoardsGrid.appendChild(card);
  });

  const newBoard = document.createElement('div');
  newBoard.className = 'new-board-card';
  newBoard.innerHTML = '<i class="fas fa-plus"></i><span>Create board</span>';
  newBoard.addEventListener('click', () => {
    if (!state.user?.token) return openModal(elements.loginModal);
    closeModal(elements.editProfileModal);
    openModal(elements.createBoardModal);
  });
  elements.profileBoardsGrid.appendChild(newBoard);
}

function switchProfileTab(tab) {
  elements.profileCreatedPins?.classList.toggle('hidden', tab !== 'created');
  elements.profileSavedPins?.classList.toggle('hidden', tab !== 'saved');
  elements.profileBoardsGrid?.classList.toggle('hidden', tab !== 'boards');
}

function populateBoardSelect() {
  if (!elements.boardSelect) return;
  elements.boardSelect.innerHTML = '';

  const savedOption = document.createElement('option');
  savedOption.value = '';
  savedOption.textContent = 'Saved items';
  elements.boardSelect.appendChild(savedOption);

  if (!state.user?.token) {
    elements.boardSelect.disabled = true;
    return;
  }

  elements.boardSelect.disabled = false;
  state.library.boards.forEach(board => {
    const option = document.createElement('option');
    option.value = String(board.id);
    option.textContent = board.name;
    elements.boardSelect.appendChild(option);
  });
}

async function populateEditProfileForm() {
  if (!state.user?.token) return;
  const displayNameInput = $('editDisplayName');
  const bioInput = $('editBio');
  const avatarInput = $('editAvatar');
  if (displayNameInput) displayNameInput.value = state.user.displayName || '';
  if (bioInput) bioInput.value = state.user.bio || '';
  if (avatarInput) avatarInput.value = state.user.avatar || '';
}

function showToast(message, type = '') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3000);
}

function startHeroRotation() {
  if (!elements.heroWords || !elements.heroDots.length) return;
  if (heroInterval) window.clearInterval(heroInterval);
  let activeIndex = 0;
  heroInterval = window.setInterval(() => {
    activeIndex = (activeIndex + 1) % elements.heroDots.length;
    elements.heroWords.style.transform = `translateY(-${activeIndex * 80}px)`;
    elements.heroDots.forEach((dot, index) => dot.classList.toggle('active', index === activeIndex));
  }, 3000);
}

async function logout() {
  clearSession();
  syncAuthUI();
  showPage('home');
  await loadPins();
  showToast('Logged out.');
}

async function handleDetailBackdropClose(event) {
  if (event.target === elements.pinDetailModal) closeModal(elements.pinDetailModal);
}

if (elements.pinDetailModal) {
  elements.pinDetailModal.addEventListener('click', handleDetailBackdropClose);
}
