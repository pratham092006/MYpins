import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'mypins.react.user';
const RAW_API_BASE = String(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
const REMOTE_API_BASE = 'https://mypins.onrender.com';

function normalizeApiBase(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function uniqueApiBases(list) {
  const seen = new Set();
  const unique = [];

  for (const value of list) {
    const normalized = normalizeApiBase(value);
    const key = normalized || '__same_origin__';
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(normalized);
  }

  return unique;
}

function getApiBaseCandidates() {
  const envBase = normalizeApiBase(RAW_API_BASE);
  const host = typeof window !== 'undefined' ? String(window.location.hostname || '').toLowerCase() : '';
  const isNetlifyHost = host.endsWith('.netlify.app') || host === 'mypins.netlify.app';

  // On Netlify, force same-origin API usage so requests flow through redirects.
  if (isNetlifyHost) {
    return uniqueApiBases([envBase, '']);
  }

  return uniqueApiBases([envBase, REMOTE_API_BASE, '']);
}

const API_BASE_CANDIDATES = getApiBaseCandidates();

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Pins' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'design', label: 'Design' },
  { id: 'art', label: 'Art' },
  { id: 'photography', label: 'Photography' },
  { id: 'other', label: 'Other' }
];

const CATEGORY_FALLBACKS = {
  travel: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=900&q=80',
  food: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80',
  design: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=900&q=80',
  art: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=80',
  photography: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
  other: 'https://images.unsplash.com/photo-1473177104440-ffee2f376098?auto=format&fit=crop&w=900&q=80'
};

const FALLBACK_PINS = [
  {
    id: 900001,
    title: 'Coastal retreat moodboard',
    category: 'travel',
    imageUrl: CATEGORY_FALLBACKS.travel,
    likes: 42,
    saves: 13,
    createdBy: 'demo@mypins.app',
    status: 'published'
  },
  {
    id: 900002,
    title: 'Studio desk setup references',
    category: 'design',
    imageUrl: CATEGORY_FALLBACKS.design,
    likes: 30,
    saves: 9,
    createdBy: 'demo@mypins.app',
    status: 'published'
  },
  {
    id: 900003,
    title: 'Gallery light study',
    category: 'art',
    imageUrl: CATEGORY_FALLBACKS.art,
    likes: 27,
    saves: 7,
    createdBy: 'demo@mypins.app',
    status: 'published'
  },
  {
    id: 900004,
    title: 'Weekend comfort food ideas',
    category: 'food',
    imageUrl: CATEGORY_FALLBACKS.food,
    likes: 55,
    saves: 18,
    createdBy: 'demo@mypins.app',
    status: 'published'
  }
];

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function fallbackImage(title) {
  const safe = encodeURIComponent(title || 'Pin');
  return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 420'><rect width='320' height='420' fill='%23f3ece5'/><text x='160' y='210' text-anchor='middle' fill='%2363584f' font-size='18'>${safe}</text></svg>`;
}

function getCategoryFallbackImage(category) {
  const key = String(category || 'other').toLowerCase();
  return CATEGORY_FALLBACKS[key] || CATEGORY_FALLBACKS.other;
}

function apiUrl(path, base = API_BASE_CANDIDATES[0] || '') {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedBase = normalizeApiBase(base);
  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath;
}

function resolveMediaUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^(data:|blob:)/i.test(url)) return url;
  return apiUrl(url);
}

function resolvePinImage(pin) {
  return resolveMediaUrl(pin?.imageUrl) || getCategoryFallbackImage(pin?.category) || fallbackImage(pin?.title || 'Pin');
}

function applyImageFallback(event, pin) {
  const img = event.currentTarget;
  const categoryFallback = getCategoryFallbackImage(pin?.category);

  if (!img.dataset.categoryFallbackTried && categoryFallback && img.src !== categoryFallback) {
    img.dataset.categoryFallbackTried = '1';
    img.src = categoryFallback;
    return;
  }

  img.src = fallbackImage(pin?.title || 'Pin');
}

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pins, setPins] = useState([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [pinsError, setPinsError] = useState('');
  const [pinsRetryKey, setPinsRetryKey] = useState(0);
  const [session, setSession] = useState(() => readSession());
  const [savedPinIds, setSavedPinIds] = useState([]);
  const [likedPinIds, setLikedPinIds] = useState([]);
  const [libraryBoards, setLibraryBoards] = useState([]);
  const [followingEmails, setFollowingEmails] = useState([]);
  const [authModal, setAuthModal] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', displayName: '' });
  const [toast, setToast] = useState(null);
  const [profileTab, setProfileTab] = useState('created');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [profileStats, setProfileStats] = useState({ pins: 0, boards: 0, saves: 0 });
  const [profileCreatedPins, setProfileCreatedPins] = useState([]);
  const [profileSavedPins, setProfileSavedPins] = useState([]);
  const [profileBoards, setProfileBoards] = useState([]);
  const [showBoardForm, setShowBoardForm] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState({ displayName: '', bio: '', avatar: '' });
  const [boardForm, setBoardForm] = useState({ name: '', description: '', visibility: 'private' });
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPin, setDetailPin] = useState(null);
  const [detailBoardId, setDetailBoardId] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [commentReplyParentId, setCommentReplyParentId] = useState(null);
  const [collapsedReplyThreads, setCollapsedReplyThreads] = useState({});
  const [submittingComment, setSubmittingComment] = useState(false);

  const token = session?.token || null;
  const currentUser = session?.user || null;
  const profileEmail = profileUser?.email || currentUser?.email || '';
  const canFollowProfile = Boolean(token && profileEmail && currentUser?.email && profileEmail !== currentUser.email);
  const isFollowingProfile = canFollowProfile && followingEmails.includes(profileEmail);

  const isLibraryPage = activePage === 'saved' || activePage === 'liked';
  const isProfilePage = activePage === 'profile';

  useEffect(() => {
    let cancelled = false;

    async function fetchPins() {
      setLoadingPins(true);
      setPinsError('');
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (activeCategory !== 'all') params.set('category', activeCategory);

        const endpoint = params.toString() ? `/api/pins?${params.toString()}` : '/api/pins';
        const payload = await requestJSON(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }, 'Failed to load pins');

        if (!cancelled) {
          setPins(Array.isArray(payload.pins) ? payload.pins : []);
        }
      } catch (error) {
        if (!cancelled) {
          setPins(FALLBACK_PINS);
          setPinsError(error.message || 'Could not reach the live feed. Showing backup pins.');
          showToast(error.message || 'Could not load pins', 'error');
        }
      } finally {
        if (!cancelled) {
          setLoadingPins(false);
        }
      }
    }

    fetchPins();

    return () => {
      cancelled = true;
    };
  }, [activeCategory, searchQuery, token, pinsRetryKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      if (!token) {
        setSavedPinIds([]);
        setLikedPinIds([]);
        setLibraryBoards([]);
        setFollowingEmails([]);
        return;
      }

      try {
        const payload = await requestJSON('/api/me/library', {
          headers: { Authorization: `Bearer ${token}` }
        }, 'Failed to load your library');

        if (!cancelled) {
          setSavedPinIds(Array.isArray(payload.savedPinIds) ? payload.savedPinIds : []);
          setLikedPinIds(Array.isArray(payload.likedPinIds) ? payload.likedPinIds : []);
          setLibraryBoards(Array.isArray(payload.boards) ? payload.boards : []);
          setFollowingEmails(Array.isArray(payload.followingEmails) ? payload.followingEmails : []);
        }
      } catch {
        if (!cancelled) {
          setSavedPinIds([]);
          setLikedPinIds([]);
          setLibraryBoards([]);
          setFollowingEmails([]);
        }
      }
    }

    loadLibrary();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!token || !isProfilePage) return;
    loadProfileContent();
  }, [isProfilePage, token]);

  function showToast(message, type = '') {
    setToast({ message, type, id: Date.now() });
  }

  function getInitialFromValue(value) {
    return String(value || 'U').trim()[0]?.toUpperCase() || 'U';
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return 'just now';
    const diffMinutes = Math.floor((Date.now() - new Date(dateString).getTime()) / 60000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  }

  async function requestJSON(url, options = {}, defaultError = 'Request failed') {
    const method = String(options.method || 'GET').toUpperCase();
    const perTargetAttempts = method === 'GET' ? 2 : 1;
    const targets = /^https?:\/\//i.test(url)
      ? [url]
      : [
          ...new Set([
            ...API_BASE_CANDIDATES.map(base => apiUrl(url, base)),
            apiUrl(url, '')
          ])
        ];

    let lastError = null;

    for (const target of targets) {
      for (let attempt = 0; attempt < perTargetAttempts; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        try {
          const response = await fetch(target, { ...options, signal: controller.signal });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            const statusError = new Error(payload.error || defaultError);
            statusError.status = response.status;
            throw statusError;
          }

          return payload;
        } catch (error) {
          lastError = error;

          const isLastAttempt = attempt === perTargetAttempts - 1;
          if (!isLastAttempt) {
            continue;
          }

          const status = Number(error?.status || 0);
          const shouldNotFallback = status >= 400 && status < 500 && ![404, 408, 429].includes(status);
          if (shouldNotFallback) {
            throw new Error(error?.message || defaultError);
          }
        } finally {
          clearTimeout(timeoutId);
        }

        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }

    throw new Error(lastError?.message || defaultError);
  }

  function updateAuthField(event) {
    const { name, value } = event.target;
    setAuthForm(prev => ({ ...prev, [name]: value }));
  }

  function openAuthModal(mode) {
    setAuthForm({ email: '', password: '', displayName: '' });
    setAuthModal(mode);
  }

  async function submitAuth(event) {
    event.preventDefault();

    const mode = authModal;
    if (!mode) return;

    const endpoint = mode === 'signup' ? '/api/register' : '/api/login';
    const body = mode === 'signup'
      ? {
          email: authForm.email,
          password: authForm.password,
          displayName: authForm.displayName
        }
      : {
          email: authForm.email,
          password: authForm.password
        };

    try {
      const payload = await requestJSON(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, 'Authentication failed');

      const nextSession = {
        token: payload.token,
        user: payload.user
      };

      setSession(nextSession);
      saveSession(nextSession);
      setAuthModal(null);
      showToast(mode === 'signup' ? 'Account created' : 'Logged in', 'success');
    } catch (error) {
      showToast(error.message || 'Authentication failed', 'error');
    }
  }

  function logout() {
    setSession(null);
    saveSession(null);
    setSavedPinIds([]);
    setLikedPinIds([]);
    setLibraryBoards([]);
    setFollowingEmails([]);
    setProfileUser(null);
    setProfileStats({ pins: 0, boards: 0, saves: 0 });
    setProfileCreatedPins([]);
    setProfileSavedPins([]);
    setProfileBoards([]);
    setShowProfileForm(false);
    setShowBoardForm(false);
    setProfileForm({ displayName: '', bio: '', avatar: '' });
    setBoardForm({ name: '', description: '', visibility: 'private' });
    setActivePage('home');
    showToast('Logged out');
  }

  function navigateToPage(page) {
    if ((page === 'saved' || page === 'liked' || page === 'profile') && !currentUser) {
      openAuthModal('login');
      showToast('Log in to view your library');
      return;
    }

    if (page !== 'profile') {
      setProfileTab('created');
    }

    setActivePage(page);
  }

  async function loadProfileContent() {
    if (!token) return;

    setProfileLoading(true);
    try {
      const authHeaders = { Authorization: `Bearer ${token}` };
      const [me, saved, boards, allPins] = await Promise.all([
        requestJSON('/api/me', { headers: authHeaders }, 'Failed to load profile'),
        requestJSON('/api/me/saves', { headers: authHeaders }, 'Failed to load saved pins'),
        requestJSON('/api/me/boards', { headers: authHeaders }, 'Failed to load boards'),
        requestJSON('/api/pins', { headers: authHeaders }, 'Failed to load pins'),
      ]);

      const user = me?.user || null;
      const all = Array.isArray(allPins?.pins) ? allPins.pins : [];
      const createdPins = user ? all.filter(pin => pin.createdBy === user.email) : [];

      setProfileUser(user);
      setProfileStats(me?.stats || { pins: 0, boards: 0, saves: 0 });
      setProfileSavedPins(Array.isArray(saved?.pins) ? saved.pins : []);
      setProfileBoards(Array.isArray(boards?.boards) ? boards.boards : []);
      setProfileCreatedPins(createdPins);
      setProfileForm({
        displayName: user?.displayName || '',
        bio: user?.bio || '',
        avatar: user?.avatar || ''
      });
    } catch (error) {
      showToast(error.message || 'Failed to load profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  }

  function updateProfileField(event) {
    const { name, value } = event.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!token) return;

    try {
      const payload = await requestJSON('/api/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileForm)
      }, 'Failed to update profile');

      const nextSession = {
        token,
        user: payload.user,
      };
      setSession(nextSession);
      saveSession(nextSession);
      setShowProfileForm(false);
      showToast('Profile updated', 'success');
      await loadProfileContent();
    } catch (error) {
      showToast(error.message || 'Failed to update profile', 'error');
    }
  }

  function updateBoardField(event) {
    const { name, value } = event.target;
    setBoardForm(prev => ({ ...prev, [name]: value }));
  }

  async function createBoard(event) {
    event.preventDefault();
    if (!token) return;

    try {
      await requestJSON('/api/boards', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(boardForm)
      }, 'Failed to create board');

      setBoardForm({ name: '', description: '', visibility: 'private' });
      setShowBoardForm(false);
      showToast('Board created', 'success');
      await loadProfileContent();
    } catch (error) {
      showToast(error.message || 'Failed to create board', 'error');
    }
  }

  async function renameBoard(board) {
    if (!token) return;
    const nextName = window.prompt('Rename board', board.name || '');
    if (nextName === null) return;

    const name = nextName.trim();
    if (!name) {
      showToast('Board name is required', 'error');
      return;
    }

    try {
      await requestJSON(`/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      }, 'Failed to rename board');

      showToast('Board renamed', 'success');
      await loadProfileContent();
    } catch (error) {
      showToast(error.message || 'Failed to rename board', 'error');
    }
  }

  async function deleteBoard(board) {
    if (!token) return;
    const confirmed = window.confirm(`Delete board "${board.name}"?`);
    if (!confirmed) return;

    try {
      await requestJSON(`/api/boards/${board.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }, 'Failed to delete board');

      showToast('Board deleted');
      await loadProfileContent();
    } catch (error) {
      showToast(error.message || 'Failed to delete board', 'error');
    }
  }

  async function openPinDetail(pinId) {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailBoardId('');
    setCommentReplyParentId(null);
    setCollapsedReplyThreads({});
    setCommentInput('');
    try {
      const payload = await requestJSON(`/api/pins/${pinId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }, 'Failed to load pin details');
      setDetailPin(payload);
    } catch (error) {
      showToast(error.message || 'Failed to load pin details', 'error');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function closePinDetail() {
    setDetailModalOpen(false);
    setDetailPin(null);
    setCommentInput('');
    setCommentReplyParentId(null);
    setCollapsedReplyThreads({});
  }

  async function refreshDetailPin() {
    if (!detailPin?.id) return;
    const payload = await requestJSON(`/api/pins/${detailPin.id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }, 'Failed to refresh pin details');
    setDetailPin(payload);
  }

  async function toggleLikeFromDetail() {
    if (!detailPin?.id) return;
    await toggleLike(detailPin.id);
    await refreshDetailPin();
  }

  async function toggleSaveFromDetail() {
    if (!detailPin?.id) return;
    await toggleSave(detailPin.id, detailBoardId ? Number(detailBoardId) : null);
    await refreshDetailPin();
  }

  async function submitComment() {
    if (!token || !detailPin?.id) {
      openAuthModal('login');
      return;
    }

    const text = commentInput.trim();
    if (!text) return;

    setSubmittingComment(true);
    try {
      await requestJSON(`/api/pins/${detailPin.id}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, parentId: commentReplyParentId })
      }, 'Failed to add comment');

      setCommentInput('');
      setCommentReplyParentId(null);
      await refreshDetailPin();
      showToast('Comment added', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to add comment', 'error');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function editComment(comment) {
    if (!token) return;
    const nextText = window.prompt('Edit your comment', comment.text || '');
    if (nextText === null) return;
    const text = nextText.trim();
    if (!text) {
      showToast('Comment cannot be empty', 'error');
      return;
    }

    try {
      await requestJSON(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      }, 'Failed to update comment');

      await refreshDetailPin();
      showToast('Comment updated', 'success');
    } catch (error) {
      showToast(error.message || 'Failed to update comment', 'error');
    }
  }

  async function deleteComment(comment) {
    if (!token) return;
    const confirmed = window.confirm('Delete this comment and its replies?');
    if (!confirmed) return;

    try {
      await requestJSON(`/api/comments/${comment.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }, 'Failed to delete comment');

      await refreshDetailPin();
      showToast('Comment deleted');
    } catch (error) {
      showToast(error.message || 'Failed to delete comment', 'error');
    }
  }

  async function sharePin(pinId) {
    const url = `${window.location.origin}${window.location.pathname}?pin=${pinId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Could not copy link', 'error');
    }
  }

  async function toggleSave(pinId, boardId = null) {
    if (!token) {
      openAuthModal('login');
      return;
    }

    try {
      const payload = await requestJSON(`/api/pins/${pinId}/save`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boardId })
      }, 'Could not save pin');

      const saved = Boolean(payload.saved);
      setSavedPinIds(prev => {
        if (saved) {
          return prev.includes(pinId) ? prev : [...prev, pinId];
        }
        return prev.filter(id => id !== pinId);
      });

      setPins(prev => prev.map(pin => {
        if (pin.id !== pinId) return pin;
        return { ...pin, saves: payload.saves };
      }));

      showToast(saved ? 'Pin saved' : 'Pin removed from saves');
    } catch (error) {
      showToast(error.message || 'Could not save pin', 'error');
    }
  }

  async function toggleFollow(targetEmail) {
    if (!token) {
      openAuthModal('login');
      return;
    }

    if (!targetEmail || targetEmail === currentUser?.email) {
      return;
    }

    try {
      const payload = await requestJSON(`/api/users/${encodeURIComponent(targetEmail)}/follow`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }, 'Could not update follow state');

      const following = Boolean(payload?.following);
      setFollowingEmails(prev => {
        if (following) {
          return prev.includes(targetEmail) ? prev : [...prev, targetEmail];
        }
        return prev.filter(email => email !== targetEmail);
      });

      showToast(following ? 'Now following creator' : 'Unfollowed creator');
    } catch (error) {
      showToast(error.message || 'Could not update follow state', 'error');
    }
  }

  async function toggleLike(pinId) {
    if (!token) {
      openAuthModal('login');
      return;
    }

    try {
      const payload = await requestJSON(`/api/pins/${pinId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }, 'Could not like pin');

      const liked = Boolean(payload.liked);
      setLikedPinIds(prev => {
        if (liked) {
          return prev.includes(pinId) ? prev : [...prev, pinId];
        }
        return prev.filter(id => id !== pinId);
      });

      setPins(prev => prev.map(pin => {
        if (pin.id !== pinId) return pin;
        return { ...pin, likes: payload.likes };
      }));
    } catch (error) {
      showToast(error.message || 'Could not like pin', 'error');
    }
  }

  const greetingName = useMemo(() => {
    if (!currentUser) return 'MyPins';
    return currentUser.displayName || currentUser.email?.split('@')[0] || 'MyPins';
  }, [currentUser]);

  const visiblePins = useMemo(() => {
    if (activePage === 'saved') {
      return pins.filter(pin => savedPinIds.includes(pin.id));
    }

    if (activePage === 'liked') {
      return pins.filter(pin => likedPinIds.includes(pin.id));
    }

    return pins;
  }, [activePage, likedPinIds, pins, savedPinIds]);

  const sectionTitle = useMemo(() => {
    if (activePage === 'profile') return 'Profile';
    if (activePage === 'saved') return 'Saved Pins';
    if (activePage === 'liked') return 'Liked Pins';
    if (activePage === 'explore') return 'Explore';
    return 'Home Feed';
  }, [activePage]);

  function renderPinCard(pin) {
    const isSaved = savedPinIds.includes(pin.id);
    const isLiked = likedPinIds.includes(pin.id);

    return (
      <article className="pin" key={pin.id} onClick={() => openPinDetail(pin.id)}>
        <div className="pin-img-wrapper">
          <img
            src={resolvePinImage(pin)}
            alt={pin.title}
            className="pin-image"
            loading="lazy"
            onError={event => {
              applyImageFallback(event, pin);
            }}
          />
          <div className="pin-overlay">
            <div className="pin-overlay-top">
              <button
                className={`pin-save-btn ${isSaved ? 'saved' : ''}`}
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  toggleSave(pin.id);
                }}
              >
                {isSaved ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        <div className="pin-info">
          <div className="pin-title">{pin.title}</div>
          {pin.status && pin.status !== 'published' && (
            <div className={`pin-status pin-status-${pin.status}`}>{pin.status}</div>
          )}
          <div className="pin-card-meta">
            <span className="chip">{pin.category || 'other'}</span>
            <div className="pin-card-actions">
              <button
                className="pin-action-btn"
                type="button"
                title="Like"
                onClick={event => {
                  event.stopPropagation();
                  toggleLike(pin.id);
                }}
              >
                <i className={isLiked ? 'fas fa-heart' : 'far fa-heart'} />
              </button>
            </div>
          </div>
          <div className="auth-hint">{pin.likes || 0} likes • {pin.saves || 0} saves</div>
        </div>
      </article>
    );
  }

  return (
    <div className="app-shell">
      <header>
        <a className="logo" href="#" onClick={event => { event.preventDefault(); navigateToPage('home'); }}>
          <div className="logo-icon"><i className="fas fa-thumbtack" /></div>
          <div className="logo-text">My<span>Pins</span></div>
        </a>

        <nav>
          <a
            href="#"
            className={`nav-link ${activePage === 'home' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); navigateToPage('home'); }}
          >
            Home
          </a>
          <a
            href="#"
            className={`nav-link ${activePage === 'explore' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); navigateToPage('explore'); }}
          >
            Explore
          </a>
          <a
            href="#"
            className={`nav-link ${activePage === 'saved' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); navigateToPage('saved'); }}
          >
            Saved
          </a>
          <a
            href="#"
            className={`nav-link ${activePage === 'liked' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); navigateToPage('liked'); }}
          >
            Liked
          </a>
          <a
            href="#"
            className={`nav-link ${activePage === 'profile' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); navigateToPage('profile'); }}
          >
            Profile
          </a>
        </nav>

        <div className="search-container">
          <i className="fas fa-search" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="user-actions">
          {!currentUser && (
            <div className="logged-out-actions">
              <button className="btn login-btn" type="button" onClick={() => openAuthModal('login')}>Log in</button>
              <button className="btn signup-btn-style" type="button" onClick={() => openAuthModal('signup')}>Sign up</button>
            </div>
          )}

          {currentUser && (
            <div className="logged-in-actions">
              <button className="icon-btn" type="button" title="Profile" onClick={() => navigateToPage('profile')}>
                <i className="fas fa-user" />
              </button>
              <button className="btn signup-btn-style" type="button" onClick={logout}>Log out</button>
            </div>
          )}
        </div>
      </header>

      <main>
        {activePage === 'home' && !currentUser && (
          <section className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title">Get your next</h1>
              <div className="hero-words-wrapper">
                <div className="hero-word hero-word-static">vacation idea</div>
              </div>
              <p className="hero-subtitle">Sign up to get more ideas that are tailored to you.</p>
              <button className="hero-cta login-btn btn" type="button" onClick={() => openAuthModal('signup')}>
                Join MyPins
              </button>
            </div>
          </section>
        )}

        {activePage === 'explore' && (
          <div className="categories" style={{ marginTop: '10px' }}>
            {CATEGORY_OPTIONS.map(category => (
              <button
                key={category.id}
                type="button"
                className={`category ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        )}

        {isProfilePage && (
          <div className="page-content" style={{ display: 'block' }}>
            <section className="profile-section">
              <div className="profile-avatar">
                {profileUser?.avatar
                  ? (
                    <img
                      src={resolveMediaUrl(profileUser.avatar)}
                      alt={profileUser.displayName || profileUser.email || 'Profile'}
                      onError={event => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  )
                  : (profileUser?.displayName || profileUser?.email || currentUser?.displayName || 'U')[0].toUpperCase()}
              </div>
              <div className="profile-name">
                {profileUser?.displayName || currentUser?.displayName || 'MyPins User'}
              </div>
              <div className="profile-email">
                @{(profileUser?.email || currentUser?.email || 'user').split('@')[0]}
              </div>
              <div className="profile-bio">
                {profileUser?.bio || 'Curate ideas, collections, and inspiration.'}
              </div>
              <div className="profile-stats">
                <div className="profile-stat">
                  <div className="profile-stat-num">{profileStats.pins || 0}</div>
                  <div className="profile-stat-label">Pins</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-num">{profileStats.boards || 0}</div>
                  <div className="profile-stat-label">Boards</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-num">{profileStats.saves || 0}</div>
                  <div className="profile-stat-label">Saves</div>
                </div>
              </div>
              <div className="profile-actions">
                {canFollowProfile && (
                  <button className="profile-edit-btn" type="button" onClick={() => toggleFollow(profileEmail)}>
                    {isFollowingProfile ? 'Following' : 'Follow'}
                  </button>
                )}
                <button className="profile-edit-btn" type="button" onClick={loadProfileContent}>Refresh</button>
                <button className="profile-edit-btn" type="button" onClick={() => setShowProfileForm(prev => !prev)}>
                  {showProfileForm ? 'Cancel edit' : 'Edit profile'}
                </button>
                <button className="profile-edit-btn" type="button" onClick={() => setShowBoardForm(prev => !prev)}>
                  {showBoardForm ? 'Cancel board' : 'Create board'}
                </button>
              </div>
            </section>

            {showProfileForm && (
              <form onSubmit={saveProfile} className="modal-body" style={{ maxWidth: '620px', margin: '0 auto 16px' }}>
                <div className="form-group">
                  <label htmlFor="profile-display-name">Display name</label>
                  <input
                    id="profile-display-name"
                    name="displayName"
                    type="text"
                    value={profileForm.displayName}
                    onChange={updateProfileField}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-bio">Bio</label>
                  <input
                    id="profile-bio"
                    name="bio"
                    type="text"
                    value={profileForm.bio}
                    onChange={updateProfileField}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="profile-avatar">Avatar URL</label>
                  <input
                    id="profile-avatar"
                    name="avatar"
                    type="url"
                    value={profileForm.avatar}
                    onChange={updateProfileField}
                  />
                </div>
                <button type="submit" className="submit-btn">Save profile</button>
              </form>
            )}

            {showBoardForm && (
              <form onSubmit={createBoard} className="modal-body" style={{ maxWidth: '620px', margin: '0 auto' }}>
                <div className="form-group">
                  <label htmlFor="board-name">Board name</label>
                  <input
                    id="board-name"
                    name="name"
                    type="text"
                    required
                    value={boardForm.name}
                    onChange={updateBoardField}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="board-description">Description</label>
                  <input
                    id="board-description"
                    name="description"
                    type="text"
                    value={boardForm.description}
                    onChange={updateBoardField}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="board-visibility">Visibility</label>
                  <select
                    id="board-visibility"
                    name="visibility"
                    value={boardForm.visibility}
                    onChange={updateBoardField}
                  >
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
                <button type="submit" className="submit-btn">Create board</button>
              </form>
            )}

            <div className="profile-tabs">
              <button
                type="button"
                className={`profile-tab ${profileTab === 'created' ? 'active' : ''}`}
                onClick={() => setProfileTab('created')}
              >
                Created
              </button>
              <button
                type="button"
                className={`profile-tab ${profileTab === 'saved' ? 'active' : ''}`}
                onClick={() => setProfileTab('saved')}
              >
                Saved
              </button>
              <button
                type="button"
                className={`profile-tab ${profileTab === 'boards' ? 'active' : ''}`}
                onClick={() => setProfileTab('boards')}
              >
                Boards
              </button>
            </div>

            {profileLoading && (
              <div className="section-title">Loading profile...</div>
            )}

            {!profileLoading && profileTab !== 'boards' && (
              <div className="pins-container">
                {(profileTab === 'created' ? profileCreatedPins : profileSavedPins).length === 0 && (
                  <div className="empty-state">No pins found.</div>
                )}
                {(profileTab === 'created' ? profileCreatedPins : profileSavedPins).map(renderPinCard)}
              </div>
            )}

            {!profileLoading && profileTab === 'boards' && (
              <div className="boards-grid">
                {profileBoards.length === 0 && (
                  <div className="empty-state">No boards yet. Create one to organize your pins.</div>
                )}

                {profileBoards.map(board => (
                  <article className="board-card" key={board.id}>
                    <div className="board-cover">
                      <div className="board-cover-main">
                        {board.pins?.[0]?.imageUrl && (
                          <img
                            src={resolvePinImage(board.pins[0])}
                            alt={board.name}
                            onError={event => applyImageFallback(event, board.pins[0])}
                          />
                        )}
                      </div>
                      <div className="board-cover-small">
                        {board.pins?.[1]?.imageUrl && (
                          <img
                            src={resolvePinImage(board.pins[1])}
                            alt={board.name}
                            onError={event => applyImageFallback(event, board.pins[1])}
                          />
                        )}
                      </div>
                      <div className="board-cover-small">
                        {board.pins?.[2]?.imageUrl && (
                          <img
                            src={resolvePinImage(board.pins[2])}
                            alt={board.name}
                            onError={event => applyImageFallback(event, board.pins[2])}
                          />
                        )}
                      </div>
                    </div>
                    <div className="board-info">
                      <div className="board-name">{board.name}</div>
                      <div className="board-count">{board.pinCount || 0} pins</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button className="detail-action-btn" type="button" onClick={() => renameBoard(board)}>
                          <i className="fas fa-pen" />
                        </button>
                        <button className="detail-action-btn" type="button" onClick={() => deleteBoard(board)}>
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {!isProfilePage && (
        <div className="page-content" style={{ display: 'block' }}>
          {pinsError && (
            <div className="network-banner">
              <span>Feed issue: {pinsError}</span>
              <button type="button" onClick={() => setPinsRetryKey(prev => prev + 1)}>Retry</button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '12px', color: 'var(--gray-600)' }}>
            {currentUser ? `Welcome back, ${greetingName}` : 'Browse and discover ideas'}
          </div>

          <div className="section-title" style={{ marginBottom: '8px' }}>
            {sectionTitle}
          </div>

          {isLibraryPage && !currentUser && (
            <div className="empty-state">Log in to view your saved and liked pins.</div>
          )}

          {loadingPins && (
            <div className="section-title">Loading pins...</div>
          )}

          {!loadingPins && (!isLibraryPage || currentUser) && (
            <div className="pins-container">
              {visiblePins.length === 0 && <div className="empty-state">No pins found.</div>}

              {visiblePins.map(renderPinCard)}
            </div>
          )}
        </div>
        )}
      </main>

      {detailModalOpen && (
        <div className="modal active" onClick={closePinDetail}>
          <div className="modal-content pin-detail-modal" onClick={event => event.stopPropagation()}>
            <div className="pin-detail-left">
              {detailLoading && <div className="section-title">Loading...</div>}
              {!detailLoading && detailPin && (
                <img
                  src={resolvePinImage(detailPin)}
                  alt={detailPin.title}
                  onError={event => {
                    applyImageFallback(event, detailPin);
                  }}
                />
              )}
            </div>

            <div className="pin-detail-right">
              <div className="pin-detail-actions">
                <div className="pin-detail-actions-left">
                  <button className="detail-action-btn" type="button" onClick={closePinDetail}>
                    <i className="fas fa-xmark" />
                  </button>
                </div>
                <div className="pin-detail-actions-right">
                  {detailPin && (
                    <>
                      <button className="detail-action-btn" type="button" onClick={() => sharePin(detailPin.id)}>
                        <i className="fas fa-share-alt" />
                      </button>
                      <button
                        className={`detail-action-btn ${likedPinIds.includes(detailPin.id) ? 'liked' : ''}`}
                        type="button"
                        onClick={toggleLikeFromDetail}
                      >
                        <i className={likedPinIds.includes(detailPin.id) ? 'fas fa-heart' : 'far fa-heart'} />
                      </button>
                      <button
                        className={`detail-save-btn ${savedPinIds.includes(detailPin.id) ? 'saved' : ''}`}
                        type="button"
                        onClick={toggleSaveFromDetail}
                      >
                        {savedPinIds.includes(detailPin.id) ? 'Saved' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!detailLoading && detailPin && (
                <>
                  <div className="pin-detail-info">
                    <div className="pin-detail-title">{detailPin.title}</div>
                    <div className="pin-detail-desc">{detailPin.description || ''}</div>
                    {token && (
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label htmlFor="detail-board-select">Save to board</label>
                        <select
                          id="detail-board-select"
                          value={detailBoardId}
                          onChange={event => setDetailBoardId(event.target.value)}
                        >
                          <option value="">Saved items</option>
                          {libraryBoards.map(board => (
                            <option key={board.id} value={String(board.id)}>{board.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="pin-detail-creator">
                      <div className="pin-detail-creator-avatar">
                        {getInitialFromValue(detailPin.createdBy || 'M')}
                      </div>
                      <div>
                        <div className="pin-detail-creator-name">{(detailPin.createdBy || 'mypins').split('@')[0]}</div>
                        <div className="pin-detail-creator-sub">{detailPin.createdBy || 'MyPins'}</div>
                      </div>
                      {token && detailPin.createdBy && detailPin.createdBy !== currentUser?.email && (
                        <button
                          className="detail-action-btn"
                          type="button"
                          style={{ width: 'auto', height: '30px', padding: '0 10px', marginLeft: 'auto' }}
                          onClick={() => toggleFollow(detailPin.createdBy)}
                        >
                          {followingEmails.includes(detailPin.createdBy) ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="comments-section">
                    <div className="comments-title">Comments</div>
                    {Array.isArray(detailPin.comments) && detailPin.comments.length === 0 && (
                      <p className="no-comments">No comments yet. Be the first.</p>
                    )}
                    {Array.isArray(detailPin.comments) && detailPin.comments.length > 0 && (() => {
                      const comments = detailPin.comments;
                      const roots = comments.filter(comment => !comment.parentId);
                      const repliesByParent = comments
                        .filter(comment => comment.parentId)
                        .reduce((acc, comment) => {
                          const key = Number(comment.parentId);
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(comment);
                          return acc;
                        }, {});

                      const renderComment = (comment, options = {}) => {
                        const { isReply = false, replyCount = 0, repliesCollapsed = false } = options;
                        const canManage = Boolean(currentUser?.email) && (
                          currentUser.email === comment.email || currentUser.email === 'admin@mypins.com'
                        );

                        return (
                          <div className="comment-item" key={`${isReply ? 'reply' : 'comment'}-${comment.id}`} style={isReply ? { marginLeft: '22px' } : undefined}>
                            <div className="comment-avatar">{getInitialFromValue(comment.displayName || comment.email)}</div>
                            <div className="comment-body">
                              <span className="comment-author">{comment.displayName || (comment.email || 'user').split('@')[0]}</span>
                              <p className="comment-text">{comment.text}</p>
                              <span className="comment-time">
                                {formatTimeAgo(comment.createdAt)}{comment.editedAt ? ' · edited' : ''}
                              </span>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                                <button
                                  type="button"
                                  className="detail-action-btn"
                                  style={{ width: 'auto', height: '26px', padding: '0 8px' }}
                                  onClick={() => setCommentReplyParentId(comment.id)}
                                >
                                  Reply
                                </button>
                                {!isReply && replyCount > 0 && (
                                  <button
                                    type="button"
                                    className="detail-action-btn"
                                    style={{ width: 'auto', height: '26px', padding: '0 8px' }}
                                    onClick={() => {
                                      setCollapsedReplyThreads(prev => ({
                                        ...prev,
                                        [comment.id]: !prev[comment.id]
                                      }));
                                    }}
                                  >
                                    {repliesCollapsed ? `Show replies (${replyCount})` : `Hide replies (${replyCount})`}
                                  </button>
                                )}
                                {canManage && (
                                  <>
                                    <button
                                      type="button"
                                      className="detail-action-btn"
                                      style={{ width: 'auto', height: '26px', padding: '0 8px' }}
                                      onClick={() => editComment(comment)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="detail-action-btn"
                                      style={{ width: 'auto', height: '26px', padding: '0 8px' }}
                                      onClick={() => deleteComment(comment)}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return roots.flatMap(root => {
                        const replies = repliesByParent[root.id] || [];
                        const repliesCollapsed = Boolean(collapsedReplyThreads[root.id]);
                        return [
                          renderComment(root, { replyCount: replies.length, repliesCollapsed }),
                          ...(!repliesCollapsed ? replies.map(reply => renderComment(reply, { isReply: true })) : [])
                        ];
                      });
                    })()}
                  </div>

                  <div className="comment-input-wrapper" style={{ display: token ? 'flex' : 'none' }}>
                    <input
                      type="text"
                      value={commentInput}
                      placeholder={commentReplyParentId ? 'Replying to comment...' : 'Add a comment...'}
                      onChange={event => setCommentInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          submitComment();
                        }
                      }}
                    />
                    <button className="comment-submit-btn" type="button" disabled={submittingComment} onClick={submitComment}>
                      <i className="fas fa-paper-plane" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {authModal && (
        <div className="modal active" onClick={() => setAuthModal(null)}>
          <div className="modal-content" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <button className="close-btn" type="button" onClick={() => setAuthModal(null)}>&times;</button>
              <div className="modal-logo"><i className="fas fa-thumbtack" /></div>
              <h2>{authModal === 'signup' ? 'Join MyPins' : 'Welcome to MyPins'}</h2>
            </div>

            <div className="modal-body">
              <form onSubmit={submitAuth}>
                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" required value={authForm.email} onChange={updateAuthField} />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input id="password" name="password" type="password" required value={authForm.password} onChange={updateAuthField} />
                </div>

                {authModal === 'signup' && (
                  <div className="form-group">
                    <label htmlFor="displayName">Display name</label>
                    <input
                      id="displayName"
                      name="displayName"
                      type="text"
                      value={authForm.displayName}
                      onChange={updateAuthField}
                    />
                  </div>
                )}

                <button type="submit" className="submit-btn">{authModal === 'signup' ? 'Sign up' : 'Log in'}</button>
              </form>

              <div className="modal-divider">OR</div>
              {authModal === 'signup' ? (
                <div className="modal-switch">Already a member? <a href="#" onClick={event => { event.preventDefault(); openAuthModal('login'); }}>Log in</a></div>
              ) : (
                <div className="modal-switch">New to MyPins? <a href="#" onClick={event => { event.preventDefault(); openAuthModal('signup'); }}>Sign up</a></div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="toast-container" aria-live="polite">
        {toast && <div className={`toast ${toast.type || ''}`}>{toast.message}</div>}
      </div>
    </div>
  );
}
