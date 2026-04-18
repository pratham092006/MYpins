// ===== CONFIG =====
// Using static files and localStorage for Netlify deployment
let currentUser = null;
let pinsData = [];
let currentDetailPin = null;

// ===== DOM ELEMENTS =====
const $ = id => document.getElementById(id);

const pinsContainer = $('pinsContainer');
const explorePinsContainer = $('explorePinsContainer');
const searchInput = $('searchInput');
const navLinks = document.querySelectorAll('.nav-link');
const categories = document.querySelectorAll('.category');

// Auth
const loginBtn = $('loginBtn');
const signupBtn = $('signupBtn');
const loginModal = $('loginModal');
const signupModal = $('signupModal');
const loginForm = $('loginForm');
const signupForm = $('signupForm');

// Create Pin
const createModal = $('createModal');
const createPinForm = $('createPinForm');
const imageUploadContainer = $('imageUploadContainer');
const imageUpload = $('imageUpload');
const imagePreview = $('imagePreview');

// Pin Detail
const pinDetailModal = $('pinDetailModal');

// Profile
const profilePage = $('profilePage');

// Boards
const createBoardModal = $('createBoardModal');
const createBoardForm = $('createBoardForm');

// State
const loggedOutActions = $('loggedOutActions');
const loggedInActions = $('loggedInActions');

let uploadedImage = null;

// ===== TOAST SYSTEM =====
function showToast(message, type = '') {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ===== SESSION MANAGEMENT =====
window.addEventListener('load', async () => {
  const saved = localStorage.getItem('currentUser');
  if (saved) {
    currentUser = JSON.parse(saved);
    updateUIForLoggedIn();
  }
  await loadPins();
});

function updateUIForLoggedIn() {
  loggedOutActions.classList.add('hidden');
  loggedInActions.classList.remove('hidden');

  const initial = (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase();
  $('avatarInitial').textContent = initial;
  $('profileInitial').textContent = initial;

  // Add create button to nav if not present
  const existingCreate = document.querySelector('.create-nav-btn');
  if (!existingCreate) {
    const createLink = document.createElement('a');
    createLink.href = '#';
    createLink.className = 'nav-link create-nav-btn';
    createLink.textContent = 'Create';
    createLink.addEventListener('click', e => {
      e.preventDefault();
      createModal.classList.add('active');
    });
    $('mainNav').appendChild(createLink);
  }

  const hero = $('heroSection');
  if (hero) hero.classList.add('hidden');
}

function updateUIForLoggedOut() {
  loggedOutActions.classList.remove('hidden');
  loggedInActions.classList.add('hidden');
  const existingCreate = document.querySelector('.create-nav-btn');
  if (existingCreate) existingCreate.remove();
  
  if ($('homePage') && !$('homePage').classList.contains('hidden')) {
    const hero = $('heroSection');
    if (hero) hero.classList.remove('hidden');
  }
}

// ===== LOAD PINS =====
async function loadPins() {
  try {
    const res = await fetch('pins.json');
    let basePins = await res.json();
    
    // Load any custom pins created by users
    const localPins = JSON.parse(localStorage.getItem('customPins') || '[]');
    pinsData = [...basePins, ...localPins];
    
    renderAllPins();
  } catch (err) {
    console.error('Failed to load pins:', err);
    pinsData = JSON.parse(localStorage.getItem('customPins') || '[]');
    renderAllPins();
  }
}

// ===== RENDER PINS =====
function renderPins(pins, container, stagger = true) {
  if (!container) return;
  container.innerHTML = '';

  if (pins.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--gray-400);font-size:16px;">No pins found</div>';
    return;
  }

  pins.forEach((pin, i) => {
    const el = document.createElement('div');
    el.className = 'pin';
    if (stagger) {
      el.classList.add('animate-in');
      el.style.animationDelay = `${i * 0.05}s`;
    }

    const creatorInitial = pin.createdBy ? pin.createdBy[0].toUpperCase() : '📌';
    const isSaved = isUserSaved(pin.id);

    el.innerHTML = `
      <div class="pin-img-wrapper">
        <img src="${pin.imageUrl}" alt="${pin.title}" class="pin-image" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22><rect width=%22200%22 height=%22200%22 fill=%22%23f0f0f0%22/><text x=%22100%22 y=%22105%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2214%22>Image</text></svg>'">
        <div class="pin-overlay">
          <div class="pin-overlay-top">
            <button class="pin-save-btn ${isSaved ? 'saved' : ''}" data-id="${pin.id}" onclick="event.stopPropagation(); toggleSave(${pin.id}, this)">
              ${isSaved ? 'Saved' : 'Save'}
            </button>
          </div>
          <div class="pin-overlay-bottom">
            <div></div>
            <div style="display:flex;gap:6px;">
              <button class="pin-action-btn" onclick="event.stopPropagation(); sharePin(${pin.id})" title="Share">
                <i class="fas fa-share-alt"></i>
              </button>
              <button class="pin-action-btn" onclick="event.stopPropagation(); window.open('${pin.imageUrl}','_blank')" title="Open">
                <i class="fas fa-external-link-alt"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="pin-info">
        <div class="pin-title">${pin.title}</div>
        <div class="pin-meta">
          <div class="pin-creator">
            <div class="pin-creator-avatar">${creatorInitial}</div>
            <span>${pin.createdBy ? pin.createdBy.split('@')[0] : 'MyPins'}</span>
          </div>
        </div>
      </div>
    `;

    // Click to open detail
    el.querySelector('.pin-img-wrapper').addEventListener('click', () => openPinDetail(pin.id));
    el.querySelector('.pin-info').addEventListener('click', () => openPinDetail(pin.id));

    container.appendChild(el);
  });
}

function renderAllPins() {
  renderPins(pinsData, pinsContainer);
  if ($('explorePage').style.display !== 'none' && !$('explorePage').classList.contains('hidden')) {
    renderPins(pinsData, explorePinsContainer);
  }
}

// ===== PIN SAVE/LIKE HELPERS =====
function getUserSaves() {
  if (!currentUser) return [];
  return JSON.parse(localStorage.getItem(`saves_${currentUser.email}`) || '[]');
}

function setUserSaves(saves) {
  if (!currentUser) return;
  localStorage.setItem(`saves_${currentUser.email}`, JSON.stringify(saves));
}

function isUserSaved(pinId) {
  return getUserSaves().includes(pinId);
}

function getUserLikes() {
  if (!currentUser) return [];
  return JSON.parse(localStorage.getItem(`likes_${currentUser.email}`) || '[]');
}

function setUserLikes(likes) {
  if (!currentUser) return;
  localStorage.setItem(`likes_${currentUser.email}`, JSON.stringify(likes));
}

function isUserLiked(pinId) {
  return getUserLikes().includes(pinId);
}

// ===== TOGGLE SAVE =====
async function toggleSave(pinId, btn) {
  if (!currentUser) { loginModal.classList.add('active'); return; }

  let saves = getUserSaves();
  const isCurrentlySaved = saves.includes(pinId);
  
  if (isCurrentlySaved) {
    saves = saves.filter(id => id !== pinId);
    if (btn) { btn.textContent = 'Save'; btn.classList.remove('saved'); }
    showToast('Pin unsaved');
  } else {
    saves.push(pinId);
    if (btn) { btn.textContent = 'Saved'; btn.classList.add('saved'); }
    showToast('Pin saved!');
  }
  setUserSaves(saves);
}

// ===== TOGGLE LIKE =====
async function toggleLike(pinId) {
  if (!currentUser) { loginModal.classList.add('active'); return; }

  let likes = getUserLikes();
  const likeBtn = $('detailLikeBtn');
  const isCurrentlyLiked = likes.includes(pinId);

  if (isCurrentlyLiked) {
    likes = likes.filter(id => id !== pinId);
    if (likeBtn) {
      likeBtn.classList.remove('liked');
      likeBtn.innerHTML = '<i class="far fa-heart"></i>';
    }
  } else {
    likes.push(pinId);
    if (likeBtn) {
      likeBtn.classList.add('liked');
      likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
    }
    showToast('❤️ Liked!');
  }
  setUserLikes(likes);
}

// ===== SHARE PIN =====
function sharePin(pinId) {
  const url = `${window.location.origin}?pin=${pinId}`;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard!');
  }).catch(() => {
    showToast('Could not copy link', 'error');
  });
}

// ===== PIN DETAIL MODAL =====
async function openPinDetail(pinId) {
  try {
    const pin = pinsData.find(p => p.id == pinId);
    if (!pin) throw new Error('Pin not found');
    
    currentDetailPin = pin;

    $('detailImage').src = pin.imageUrl;
    $('detailTitle').textContent = pin.title;
    $('detailDesc').textContent = pin.description || '';

    const creatorName = pin.createdBy ? pin.createdBy.split('@')[0] : 'MyPins User';
    $('detailCreatorName').textContent = creatorName;
    $('detailCreatorSub').textContent = pin.createdBy || '';
    $('detailCreatorAvatar').textContent = creatorName[0].toUpperCase();

    // Like state
    const likeBtn = $('detailLikeBtn');
    if (isUserLiked(pinId)) {
      likeBtn.classList.add('liked');
      likeBtn.innerHTML = '<i class="fas fa-heart"></i>';
    } else {
      likeBtn.classList.remove('liked');
      likeBtn.innerHTML = '<i class="far fa-heart"></i>';
    }

    // Save state
    const saveBtn = $('detailSaveBtn');
    if (isUserSaved(pinId)) {
      saveBtn.textContent = 'Saved';
      saveBtn.classList.add('saved');
    } else {
      saveBtn.textContent = 'Save';
      saveBtn.classList.remove('saved');
    }

    // Comment input visibility
    $('commentInputWrapper').style.display = currentUser ? 'flex' : 'none';

    // Load comments
    let comments = pin.comments || [];
    const localComments = JSON.parse(localStorage.getItem(`comments_${pinId}`) || '[]');
    renderComments([...comments, ...localComments]);

    pinDetailModal.classList.add('active');
  } catch (err) {
    showToast('Could not load pin details', 'error');
  }
}

function renderComments(comments) {
  const list = $('commentsList');
  if (comments.length === 0) {
    list.innerHTML = '<p class="no-comments">No comments yet. Be the first!</p>';
    return;
  }
  list.innerHTML = comments.map(c => {
    const initial = (c.displayName || c.email || '?')[0].toUpperCase();
    const timeAgo = getTimeAgo(c.createdAt);
    return `
      <div class="comment-item">
        <div class="comment-avatar">${initial}</div>
        <div class="comment-body">
          <span class="comment-author">${c.displayName || c.email.split('@')[0]}</span>
          <p class="comment-text">${escapeHTML(c.text)}</p>
          <span class="comment-time">${timeAgo}</span>
        </div>
      </div>
    `;
  }).join('');
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Detail actions
$('detailLikeBtn').addEventListener('click', () => {
  if (currentDetailPin) toggleLike(currentDetailPin.id);
});

$('detailSaveBtn').addEventListener('click', () => {
  if (!currentDetailPin) return;
  toggleSave(currentDetailPin.id, $('detailSaveBtn'));
});

$('detailShareBtn').addEventListener('click', () => {
  if (currentDetailPin) sharePin(currentDetailPin.id);
});

// Submit comment
$('commentSubmitBtn').addEventListener('click', submitComment);
$('commentInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') submitComment();
});

async function submitComment() {
  if (!currentUser || !currentDetailPin) return;
  const input = $('commentInput');
  const text = input.value.trim();
  if (!text) return;

  try {
    const newComment = {
      id: Date.now(),
      email: currentUser.email,
      text,
      displayName: currentUser.displayName || currentUser.email.split('@')[0],
      createdAt: new Date().toISOString()
    };
    
    const localComments = JSON.parse(localStorage.getItem(`comments_${currentDetailPin.id}`) || '[]');
    localComments.push(newComment);
    localStorage.setItem(`comments_${currentDetailPin.id}`, JSON.stringify(localComments));

    input.value = '';

    // Re-render comments
    const baseComments = currentDetailPin.comments || [];
    renderComments([...baseComments, ...localComments]);
    showToast('Comment added');
  } catch (err) {
    showToast('Failed to add comment', 'error');
  }
}

// Close detail modal
pinDetailModal.addEventListener('click', e => {
  if (e.target === pinDetailModal) pinDetailModal.classList.remove('active');
});

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.page-content').forEach(p => {
    p.classList.add('hidden');
    p.style.display = 'none';
  });

  navLinks.forEach(l => l.classList.remove('active'));

  if (page === 'home') {
    $('homePage').classList.remove('hidden');
    $('homePage').style.display = 'block';
    document.querySelector('[data-page="home"]').classList.add('active');
    renderPins(pinsData, pinsContainer);
  } else if (page === 'explore') {
    $('explorePage').classList.remove('hidden');
    $('explorePage').style.display = 'block';
    document.querySelector('[data-page="explore"]').classList.add('active');
    renderPins(pinsData, explorePinsContainer);
  } else if (page === 'profile') {
    profilePage.classList.remove('hidden');
    profilePage.style.display = 'block';
    loadProfile();
  }

  const heroSection = $('heroSection');
  const mainFooter = $('mainFooter');
  
  if (heroSection) {
    if (page === 'home' && !currentUser) {
      heroSection.classList.remove('hidden');
    } else {
      heroSection.classList.add('hidden');
    }
  }
  
  if (mainFooter) {
    mainFooter.classList.remove('hidden');
  }
}

navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    if (link.classList.contains('create-nav-btn')) return;
    showPage(link.dataset.page);
  });
});

$('logoLink').addEventListener('click', e => {
  e.preventDefault();
  showPage('home');
});

// ===== CATEGORY FILTER =====
categories.forEach(cat => {
  cat.addEventListener('click', () => {
    categories.forEach(c => c.classList.remove('active'));
    cat.classList.add('active');
    const name = cat.dataset.category;
    const filtered = name === 'all' ? pinsData : pinsData.filter(p => p.category === name);
    renderPins(filtered, explorePinsContainer);
  });
});

// ===== SEARCH =====
searchInput.addEventListener('input', e => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = pinsData.filter(pin =>
    pin.title.toLowerCase().includes(query) ||
    (pin.description && pin.description.toLowerCase().includes(query)) ||
    pin.category.toLowerCase().includes(query)
  );
  const homePage = $('homePage');
  if (!homePage.classList.contains('hidden')) {
    renderPins(filtered, pinsContainer, false);
  } else {
    renderPins(filtered, explorePinsContainer, false);
  }
});

// ===== AUTH: SIGNUP =====
signupBtn.addEventListener('click', () => signupModal.classList.add('active'));
$('closeSignupModal').addEventListener('click', () => signupModal.classList.remove('active'));
$('switchToSignup').addEventListener('click', () => {
  loginModal.classList.remove('active');
  signupModal.classList.add('active');
});

signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('signupEmail').value.trim();
  const password = $('signupPassword').value.trim();
  const displayName = $('signupName').value.trim();

  try {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    if (users.find(u => u.email === email)) throw new Error('User already exists');
    
    users.push({ email, password, displayName });
    localStorage.setItem('users', JSON.stringify(users));

    showToast('Account created! Logging you in...');
    signupModal.classList.remove('active');
    signupForm.reset();

    // Auto login
    currentUser = { email, displayName: displayName || email.split('@')[0] };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    updateUIForLoggedIn();
    renderAllPins();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ===== AUTH: LOGIN =====
loginBtn.addEventListener('click', () => loginModal.classList.add('active'));
$('closeLoginModal').addEventListener('click', () => loginModal.classList.remove('active'));
$('switchToLogin').addEventListener('click', () => {
  signupModal.classList.remove('active');
  loginModal.classList.add('active');
});

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value.trim();

  try {
    // Check localStorage users first
    const localUsers = JSON.parse(localStorage.getItem('users') || '[]');
    let user = localUsers.find(u => u.email === email && u.password === password);
    
    // If not found, check static users.json
    if (!user) {
      const res = await fetch('users.json');
      const staticUsers = await res.json();
      user = staticUsers.find(u => u.email === email && u.password === password);
    }
    
    if (!user) throw new Error('Invalid credentials');

    currentUser = { email: user.email, displayName: user.displayName || user.email.split('@')[0] };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    loginModal.classList.remove('active');
    loginForm.reset();
    updateUIForLoggedIn();
    renderAllPins();
    showToast(`Welcome back, ${currentUser.displayName}!`);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ===== LOGOUT =====
$('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('currentUser');
  currentUser = null;
  updateUIForLoggedOut();
  showPage('home');
  renderAllPins();
  showToast('Logged out');
});

// ===== PROFILE =====
$('profileBtn').addEventListener('click', () => showPage('profile'));

async function loadProfile() {
  if (!currentUser) return;

  $('profileName').textContent = currentUser.displayName || currentUser.email.split('@')[0];
  $('profileEmail').textContent = `@${currentUser.email.split('@')[0]}`;
  $('profileInitial').textContent = (currentUser.displayName || currentUser.email)[0].toUpperCase();

  const userPins = pinsData.filter(p => p.createdBy === currentUser.email);
  const savedPinIds = getUserSaves();
  const savedPins = pinsData.filter(p => savedPinIds.includes(p.id));
  const boards = JSON.parse(localStorage.getItem(`boards_${currentUser.email}`) || '[]');

  $('profilePinsCount').textContent = userPins.length;
  $('profileBoardsCount').textContent = boards.length;
  $('profileSavesCount').textContent = savedPins.length;
  if (currentUser.bio) {
    $('profileBio').textContent = currentUser.bio;
  }

  // Load created pins
  renderPins(userPins, $('profileCreatedPins'));

  // Load saved pins
  renderPins(savedPins, $('profileSavedPins'));

  // Load boards
  await loadBoards();
}

// Profile tabs
document.querySelectorAll('.profile-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const type = tab.dataset.tab;
    $('profileCreatedPins').classList.toggle('hidden', type !== 'created');
    $('profileSavedPins').classList.toggle('hidden', type !== 'saved');
    $('profileBoardsGrid').classList.toggle('hidden', type !== 'boards');
  });
});

// ===== BOARDS =====
async function loadBoards() {
  if (!currentUser) return;
  const boards = JSON.parse(localStorage.getItem(`boards_${currentUser.email}`) || '[]');
  renderBoards(boards);
}

function renderBoards(boards) {
  const grid = $('profileBoardsGrid');
  grid.innerHTML = '';

  boards.forEach(board => {
    const card = document.createElement('div');
    card.className = 'board-card';

    const coverPins = board.pins || [];
    const mainImg = coverPins[0]?.imageUrl || '';
    const secImg = coverPins[1]?.imageUrl || '';
    const thirdImg = coverPins[2]?.imageUrl || '';

    card.innerHTML = `
      <div class="board-cover">
        <div class="board-cover-main">${mainImg ? `<img src="${mainImg}" alt="">` : ''}</div>
        <div class="board-cover-small">${secImg ? `<img src="${secImg}" alt="">` : ''}</div>
        <div class="board-cover-small">${thirdImg ? `<img src="${thirdImg}" alt="">` : ''}</div>
      </div>
      <div class="board-info">
        <div class="board-name">${board.name}</div>
        <div class="board-count">${board.pinCount || 0} Pins</div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Add "new board" card
  const newCard = document.createElement('div');
  newCard.className = 'new-board-card';
  newCard.innerHTML = '<i class="fas fa-plus"></i><span>Create board</span>';
  newCard.addEventListener('click', () => createBoardModal.classList.add('active'));
  grid.appendChild(newCard);
}

// Create board
$('closeCreateBoardModal').addEventListener('click', () => createBoardModal.classList.remove('active'));

createBoardForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!currentUser) return;

  const name = $('boardName').value.trim();
  if (!name) return;

  try {
    const boards = JSON.parse(localStorage.getItem(`boards_${currentUser.email}`) || '[]');
    boards.push({ id: Date.now(), name, pins: [], pinCount: 0 });
    localStorage.setItem(`boards_${currentUser.email}`, JSON.stringify(boards));
    
    createBoardModal.classList.remove('active');
    createBoardForm.reset();
    showToast(`Board "${name}" created!`);
    await loadBoards();
  } catch (err) {
    showToast('Failed to create board', 'error');
  }
});

// ===== CREATE PIN =====
imageUploadContainer.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  uploadedImage = file;
  const reader = new FileReader();
  reader.onload = evt => {
    imagePreview.src = evt.target.result;
    imagePreview.style.display = 'block';
    imageUploadContainer.querySelector('i').style.display = 'none';
    imageUploadContainer.querySelector('p').style.display = 'none';
    const hint = imageUploadContainer.querySelector('.upload-hint');
    if (hint) hint.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

$('closeCreateModal').addEventListener('click', resetCreateModal);

function resetCreateModal() {
  createModal.classList.remove('active');
  createPinForm.reset();
  uploadedImage = null;
  imagePreview.src = '';
  imagePreview.style.display = 'none';
  imageUploadContainer.querySelector('i').style.display = 'block';
  imageUploadContainer.querySelector('p').style.display = 'block';
  const hint = imageUploadContainer.querySelector('.upload-hint');
  if (hint) hint.style.display = 'block';
}

createPinForm.addEventListener('submit', async e => {
  e.preventDefault();
  const title = $('pinTitle').value.trim();
  const description = $('pinDescription').value.trim();
  const category = $('pinCategory').value;

  if (!title || !uploadedImage) {
    showToast('Title and image are required', 'error');
    return;
  }

  try {
    const newPin = {
      id: Date.now(),
      title,
      description,
      category,
      imageUrl: imagePreview.src, // Using the Data URL from FileReader
      createdBy: currentUser ? currentUser.email : 'anonymous@mypins.com',
      likes: 0,
      saves: 0,
      createdAt: new Date().toISOString()
    };
    
    // Save locally
    const localPins = JSON.parse(localStorage.getItem('customPins') || '[]');
    localPins.unshift(newPin);
    localStorage.setItem('customPins', JSON.stringify(localPins));
    
    // Update in-memory data
    pinsData.unshift(newPin);
    
    renderAllPins();
    resetCreateModal();
    showPage('home');
    showToast('Pin published! 🎉');
  } catch (err) {
    showToast('Failed to save pin', 'error');
  }
});

// ===== CLOSE MODALS ON BACKDROP CLICK =====
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }
});

// ===== NOTIFICATIONS & MESSAGES (placeholder) =====
$('notifBtn').addEventListener('click', () => showToast('No new notifications'));
$('msgBtn').addEventListener('click', () => showToast('No new messages'));

// ===== EDIT PROFILE (placeholder) =====
$('editProfileBtn').addEventListener('click', () => showToast('Profile editing coming soon!'));

// ===== INFINITE SCROLL (load more effect) =====
let isLoadingMore = false;
window.addEventListener('scroll', () => {
  if (isLoadingMore) return;
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  if (scrollTop + clientHeight >= scrollHeight - 200) {
    // For now, show a subtle indicator that all pins are loaded
    // In a real app, you'd paginate and load more from the server
  }
});

// ===== HERO ANIMATION =====
const heroWords = document.querySelector('.hero-words');
const heroDots = document.querySelectorAll('.hero-dots .dot');
let currentHeroWord = 0;

if (heroWords && heroDots.length) {
  setInterval(() => {
    currentHeroWord = (currentHeroWord + 1) % 4;
    heroWords.style.transform = `translateY(-${currentHeroWord * 80}px)`;
    heroDots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentHeroWord);
    });
  }, 3000);
}
