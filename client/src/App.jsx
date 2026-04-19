import { useEffect, useMemo, useState } from 'react';

const SESSION_KEY = 'mypins.react.user';

const CATEGORY_OPTIONS = [
  { id: 'all', label: 'All Pins' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'design', label: 'Design' },
  { id: 'art', label: 'Art' },
  { id: 'photography', label: 'Photography' },
  { id: 'other', label: 'Other' }
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

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pins, setPins] = useState([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [session, setSession] = useState(() => readSession());
  const [savedPinIds, setSavedPinIds] = useState([]);
  const [likedPinIds, setLikedPinIds] = useState([]);
  const [authModal, setAuthModal] = useState(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '', displayName: '' });
  const [toast, setToast] = useState(null);

  const token = session?.token || null;
  const currentUser = session?.user || null;

  useEffect(() => {
    let cancelled = false;

    async function fetchPins() {
      setLoadingPins(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (activeCategory !== 'all') params.set('category', activeCategory);

        const endpoint = params.toString() ? `/api/pins?${params.toString()}` : '/api/pins';
        const response = await fetch(endpoint, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load pins');
        }

        if (!cancelled) {
          setPins(Array.isArray(payload.pins) ? payload.pins : []);
        }
      } catch (error) {
        if (!cancelled) {
          setPins([]);
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
  }, [activeCategory, searchQuery, token]);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      if (!token) {
        setSavedPinIds([]);
        setLikedPinIds([]);
        return;
      }

      try {
        const response = await fetch('/api/me/library', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load your library');
        }

        if (!cancelled) {
          setSavedPinIds(Array.isArray(payload.savedPinIds) ? payload.savedPinIds : []);
          setLikedPinIds(Array.isArray(payload.likedPinIds) ? payload.likedPinIds : []);
        }
      } catch {
        if (!cancelled) {
          setSavedPinIds([]);
          setLikedPinIds([]);
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

  function showToast(message, type = '') {
    setToast({ message, type, id: Date.now() });
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Authentication failed');
      }

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
    showToast('Logged out');
  }

  async function toggleSave(pinId) {
    if (!token) {
      openAuthModal('login');
      return;
    }

    try {
      const response = await fetch(`/api/pins/${pinId}/save`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ boardId: null })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Could not save pin');
      }

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

  async function toggleLike(pinId) {
    if (!token) {
      openAuthModal('login');
      return;
    }

    try {
      const response = await fetch(`/api/pins/${pinId}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Could not like pin');
      }

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

  return (
    <div className="app-shell">
      <header>
        <a className="logo" href="#" onClick={event => { event.preventDefault(); setActivePage('home'); }}>
          <div className="logo-icon"><i className="fas fa-thumbtack" /></div>
          <div className="logo-text">My<span>Pins</span></div>
        </a>

        <nav>
          <a
            href="#"
            className={`nav-link ${activePage === 'home' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); setActivePage('home'); }}
          >
            Home
          </a>
          <a
            href="#"
            className={`nav-link ${activePage === 'explore' ? 'active' : ''}`}
            onClick={event => { event.preventDefault(); setActivePage('explore'); }}
          >
            Explore
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
              <button className="icon-btn" type="button" title="Logged in user">
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

        <div className="page-content" style={{ display: 'block' }}>
          <div style={{ textAlign: 'center', marginBottom: '12px', color: 'var(--gray-600)' }}>
            {currentUser ? `Welcome back, ${greetingName}` : 'Browse and discover ideas'}
          </div>

          {loadingPins && (
            <div className="section-title">Loading pins...</div>
          )}

          {!loadingPins && (
            <div className="pins-container">
              {pins.length === 0 && <div className="empty-state">No pins found.</div>}

              {pins.map(pin => {
                const isSaved = savedPinIds.includes(pin.id);
                const isLiked = likedPinIds.includes(pin.id);

                return (
                  <article className="pin" key={pin.id}>
                    <div className="pin-img-wrapper">
                      <img
                        src={pin.imageUrl}
                        alt={pin.title}
                        className="pin-image"
                        loading="lazy"
                        onError={event => {
                          event.currentTarget.src = fallbackImage(pin.title);
                        }}
                      />
                      <div className="pin-overlay">
                        <div className="pin-overlay-top">
                          <button
                            className={`pin-save-btn ${isSaved ? 'saved' : ''}`}
                            type="button"
                            onClick={() => toggleSave(pin.id)}
                          >
                            {isSaved ? 'Saved' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pin-info">
                      <div className="pin-title">{pin.title}</div>
                      <div className="pin-card-meta">
                        <span className="chip">{pin.category || 'other'}</span>
                        <div className="pin-card-actions">
                          <button
                            className="pin-action-btn"
                            type="button"
                            title="Like"
                            onClick={() => toggleLike(pin.id)}
                          >
                            <i className={isLiked ? 'fas fa-heart' : 'far fa-heart'} />
                          </button>
                        </div>
                      </div>
                      <div className="auth-hint">{pin.likes || 0} likes • {pin.saves || 0} saves</div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

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
