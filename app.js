const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const TOKEN_SECRET = process.env.MYPINS_TOKEN_SECRET || 'mypins-dev-secret-change-me';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const IMG_DIR = path.join(__dirname, 'IMG');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const USERS_FILE = path.join(__dirname, 'users.json');
const PINS_FILE = path.join(__dirname, 'pins.json');
const LIKES_FILE = path.join(__dirname, 'likes.json');
const COMMENTS_FILE = path.join(__dirname, 'comments.json');
const BOARDS_FILE = path.join(__dirname, 'boards.json');
const SAVES_FILE = path.join(__dirname, 'saves.json');
const FOLLOWS_FILE = path.join(__dirname, 'follows.json');
const FEATURE_FLAGS_FILE = path.join(__dirname, 'feature-flags.json');
const ROOT_STATIC_DIR = path.join(__dirname, '.');
const CLIENT_DIST_DIR = path.join(__dirname, 'client', 'dist');
const CLIENT_DIST_INDEX = path.join(CLIENT_DIST_DIR, 'index.html');

const rateBuckets = new Map();

if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use('/IMG', express.static(IMG_DIR, { maxAge: '7d', immutable: true }));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '1d' }));
app.use(express.static(ROOT_STATIC_DIR, { index: false }));
if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR, { index: false }));
}

function readJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function publicUser(user) {
  if (!user) return null;
  return {
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    avatar: user.avatar || '',
    bio: user.bio || '',
    role: cleanText(user.role || (user.email === 'admin@mypins.com' ? 'admin' : 'user'), 20).toLowerCase(),
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derivedKey = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedValue = '') {
  if (!storedValue) return false;
  if (storedValue.includes(':')) {
    const [salt, hash] = storedValue.split(':');
    if (!salt || !hash) return false;
    const derived = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
    const left = Buffer.from(hash, 'hex');
    const right = Buffer.from(derived, 'hex');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }
  return String(password) === String(storedValue);
}

function createToken(email) {
  const payload = JSON.stringify({
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(encoded).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return null;
  if (!crypto.timingSafeEqual(left, right)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.auth = payload;
  next();
}

const ROLE_LEVELS = {
  user: 1,
  moderator: 2,
  admin: 3,
};

function normalizeRole(value) {
  const role = cleanText(value || 'user', 20).toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROLE_LEVELS, role) ? role : 'user';
}

function getUserRoleByEmail(email) {
  if (email === 'admin@mypins.com') return 'admin';
  const user = getUserByEmail(email);
  if (!user) return 'user';
  return normalizeRole(user.role || 'user');
}

function hasRequiredRole(email, requiredRole) {
  const role = getUserRoleByEmail(email);
  const required = normalizeRole(requiredRole);
  return ROLE_LEVELS[role] >= ROLE_LEVELS[required];
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!hasRequiredRole(req.auth?.email || '', requiredRole)) {
      return res.status(403).json({ error: `${requiredRole} privileges required` });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

const requireModerator = requireRole('moderator');

function readUsers() {
  return readJSON(USERS_FILE, []);
}

function writeUsers(users) {
  writeJSON(USERS_FILE, users);
}

function readPins() {
  const defaultPins = getDefaultPins();
  if (!fs.existsSync(PINS_FILE)) {
    writeJSON(PINS_FILE, defaultPins);
    return defaultPins;
  }
  const rawPins = readJSON(PINS_FILE, []);
  const pinsWithDefaults = Array.isArray(rawPins) ? rawPins.map(ensurePinDefaults) : [];
  const scheduled = applyScheduledPublishing(pinsWithDefaults);
  const pins = scheduled.pins;
  if (!Array.isArray(pins) || pins.length === 0) {
    writeJSON(PINS_FILE, defaultPins);
    return defaultPins;
  }
  if (scheduled.mutated || JSON.stringify(rawPins) !== JSON.stringify(pins)) {
    writeJSON(PINS_FILE, pins);
  }
  return pins;
}

function writePins(pins) {
  writeJSON(PINS_FILE, pins);
}

function readLikes() {
  return readJSON(LIKES_FILE, []);
}

function writeLikes(likes) {
  writeJSON(LIKES_FILE, likes);
}

function readSaves() {
  return readJSON(SAVES_FILE, []);
}

function writeSaves(saves) {
  writeJSON(SAVES_FILE, saves);
}

function readBoards() {
  return readJSON(BOARDS_FILE, []);
}

function writeBoards(boards) {
  writeJSON(BOARDS_FILE, boards);
}

function readComments() {
  return readJSON(COMMENTS_FILE, []);
}

function writeComments(comments) {
  writeJSON(COMMENTS_FILE, comments);
}

function readFollows() {
  return readJSON(FOLLOWS_FILE, []);
}

function writeFollows(follows) {
  writeJSON(FOLLOWS_FILE, follows);
}

function readFeatureFlags() {
  const defaults = {
    enableDrafts: true,
    enableScheduledPins: true,
    enableFollowSystem: true,
    enableBoardPrivacy: true,
  };
  const flags = readJSON(FEATURE_FLAGS_FILE, defaults);
  return { ...defaults, ...flags };
}

function writeFeatureFlags(flags) {
  writeJSON(FEATURE_FLAGS_FILE, flags);
}

function getUserByEmail(email) {
  return readUsers().find(user => user.email === email) || null;
}

function scorePin(pin) {
  const likes = Number(pin.likes || 0);
  const saves = Number(pin.saves || 0);
  const createdAt = pin.createdAt ? new Date(pin.createdAt).getTime() : 0;
  return likes * 2 + saves * 3 + Math.max(0, Math.floor((createdAt || 0) / 1e12));
}

function getOptionalAuthEmail(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = verifyToken(token);
  return payload?.email || null;
}

function parseVisibility(value, fallback = 'private') {
  const normalized = cleanText(value || fallback, 20).toLowerCase();
  return ['public', 'unlisted', 'private'].includes(normalized) ? normalized : fallback;
}

function parsePinStatus(value, fallback = 'published') {
  const normalized = cleanText(value || fallback, 20).toLowerCase();
  return ['draft', 'scheduled', 'published'].includes(normalized) ? normalized : fallback;
}

function normalizeTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map(item => cleanText(item, 40).toLowerCase()).filter(Boolean))].slice(0, 12);
  }
  return [...new Set(String(value).split(',').map(item => cleanText(item, 40).toLowerCase()).filter(Boolean))].slice(0, 12);
}

function ensurePinDefaults(pin) {
  const normalized = { ...pin };
  normalized.status = parsePinStatus(normalized.status, 'published');
  normalized.publishAt = normalized.publishAt || null;
  normalized.deletedAt = normalized.deletedAt || null;
  normalized.tags = normalizeTags(normalized.tags);
  return normalized;
}

function applyScheduledPublishing(pins) {
  let mutated = false;
  const now = Date.now();
  const nextPins = pins.map(pin => {
    const normalized = ensurePinDefaults(pin);
    if (normalized.status === 'scheduled' && normalized.publishAt && new Date(normalized.publishAt).getTime() <= now) {
      normalized.status = 'published';
      mutated = true;
    }
    return normalized;
  });
  return { pins: nextPins, mutated };
}

function canSeePin(pin, requesterEmail) {
  if (!pin || pin.deletedAt) return false;
  if (!requesterEmail) return pin.status === 'published';
  if (pin.createdBy === requesterEmail || requesterEmail === 'admin@mypins.com') return true;
  return pin.status === 'published';
}

function makeRateLimiter({ keyPrefix, limit, windowMs }) {
  return (req, res, next) => {
    const identifier = req.auth?.email || req.ip || 'anonymous';
    const key = `${keyPrefix}:${identifier}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
    }

    current.count += 1;
    rateBuckets.set(key, current);
    next();
  };
}

const authRateLimiter = makeRateLimiter({ keyPrefix: 'auth', limit: 12, windowMs: 60 * 1000 });
const writeRateLimiter = makeRateLimiter({ keyPrefix: 'write', limit: 80, windowMs: 60 * 1000 });

function isFeatureEnabled(flagName) {
  return Boolean(readFeatureFlags()[flagName]);
}

function hasPinAccess(userEmail, pin) {
  if (!pin) return false;
  if (!pin.createdBy) return true;
  return pin.createdBy === userEmail || userEmail === 'admin@mypins.com';
}

function getDefaultPins() {
  return [
    { id: 1, title: 'Modern Living Room', description: 'Contemporary design with minimalist approach', imageUrl: '/IMG/ModernLivingRoom.png', category: 'design', createdBy: 'admin@mypins.com', likes: 24, saves: 12, createdAt: '2024-03-01T10:00:00.000Z', status: 'published', publishAt: null, deletedAt: null, tags: ['interior', 'modern'] },
    { id: 2, title: 'Healthy Breakfast', description: 'Start your day with nutritious meals', imageUrl: '/IMG/Breakfast.png', category: 'food', createdBy: 'chef@mypins.com', likes: 38, saves: 21, createdAt: '2024-03-03T10:00:00.000Z', status: 'published', publishAt: null, deletedAt: null, tags: ['breakfast', 'healthy'] },
    { id: 3, title: 'Mountain Escape', description: 'Breathtaking views for nature lovers', imageUrl: '/IMG/Mountain.png', category: 'travel', createdBy: 'traveler@mypins.com', likes: 56, saves: 33, createdAt: '2024-03-05T10:00:00.000Z', status: 'published', publishAt: null, deletedAt: null, tags: ['mountain', 'nature'] },
    { id: 4, title: 'Abstract Painting', description: 'Colorful modern art piece', imageUrl: '/IMG/Painting.png', category: 'art', createdBy: 'artist@mypins.com', likes: 42, saves: 19, createdAt: '2024-03-07T10:00:00.000Z', status: 'published', publishAt: null, deletedAt: null, tags: ['abstract', 'acrylic'] },
    { id: 5, title: 'Portrait Photography', description: 'Professional portrait techniques', imageUrl: '/IMG/PortraitPhoto.png', category: 'photography', createdBy: 'photographer@mypins.com', likes: 31, saves: 15, createdAt: '2024-03-09T10:00:00.000Z', status: 'published', publishAt: null, deletedAt: null, tags: ['portrait', 'camera'] },
    { id: 6, title: 'Italian Cuisine', description: 'Authentic pasta recipes', imageUrl: '/IMG/ItalianCuisine.png', category: 'food', createdBy: 'chef@mypins.com', likes: 47, saves: 27, createdAt: '2024-03-11T10:00:00.000Z', status: 'published', publishAt: null, deletedAt: null, tags: ['italian', 'recipe'] },
  ];
}

function searchPins(query, category) {
  const normalizedQuery = cleanText(query, 100).toLowerCase();
  const normalizedCategory = cleanText(category, 40).toLowerCase();
  let pins = readPins();

  if (normalizedCategory && normalizedCategory !== 'all') {
    pins = pins.filter(pin => pin.category === normalizedCategory);
  }

  if (normalizedQuery) {
    pins = pins.filter(pin => {
      const haystack = [pin.title, pin.description, pin.category, pin.createdBy, ...(pin.tags || [])].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }

  return pins;
}

app.get('/', (_req, res) => {
  if (fs.existsSync(CLIENT_DIST_INDEX)) {
    return res.sendFile(CLIENT_DIST_INDEX);
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mypins', timestamp: new Date().toISOString() });
});

app.get('/ready', (_req, res) => {
  const files = [USERS_FILE, PINS_FILE, LIKES_FILE, COMMENTS_FILE, BOARDS_FILE, SAVES_FILE];
  const checks = files.map(filePath => ({ file: path.basename(filePath), exists: fs.existsSync(filePath) }));
  const ready = checks.every(item => item.exists);
  res.status(ready ? 200 : 503).json({ ready, checks, timestamp: new Date().toISOString() });
});

app.get('/metrics', (_req, res) => {
  const pins = readPins();
  const users = readUsers();
  const boards = readBoards();
  const follows = readFollows();
  res.json({
    counters: {
      users: users.length,
      pinsPublished: pins.filter(pin => pin.status === 'published' && !pin.deletedAt).length,
      pinsDraftOrScheduled: pins.filter(pin => pin.status !== 'published' && !pin.deletedAt).length,
      pinsDeleted: pins.filter(pin => Boolean(pin.deletedAt)).length,
      boards: boards.length,
      follows: follows.length,
      comments: readComments().length,
      likes: readLikes().length,
      saves: readSaves().length,
    },
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/register', authRateLimiter, (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const displayName = cleanText(req.body.displayName || email.split('@')[0], 60);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }
  if (!email.includes('@') || password.length < 6) {
    return res.status(400).json({ error: 'Provide a valid email and a password with at least 6 characters.' });
  }

  const users = readUsers();
  if (users.some(user => user.email === email)) {
    return res.status(409).json({ error: 'User already exists.' });
  }

  const user = {
    email,
    passwordHash: hashPassword(password),
    displayName,
    avatar: '',
    bio: '',
    role: email === 'admin@mypins.com' ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeUsers(users);

  res.status(201).json({
    message: 'Registration successful',
    token: createToken(email),
    user: publicUser(user),
  });
});

app.post('/api/login', authRateLimiter, (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const users = readUsers();
  const index = users.findIndex(user => user.email === email);
  const user = index >= 0 ? users[index] : null;

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordField = user.passwordHash || user.password || '';
  if (!verifyPassword(password, passwordField)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user.passwordHash) {
    user.passwordHash = hashPassword(password);
    delete user.password;
    users[index] = user;
    writeUsers(users);
  }

  res.json({
    message: 'Login successful',
    token: createToken(email),
    user: publicUser(user),
  });
});

app.get('/api/me', requireAuth, (req, res) => {
  const user = getUserByEmail(req.auth.email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const pins = readPins().filter(pin => pin.createdBy === user.email);
  const saves = readSaves().filter(save => save.email === user.email);
  const likes = readLikes().filter(like => like.email === user.email);
  const boards = readBoards().filter(board => board.email === user.email);

  res.json({
    user: publicUser(user),
    stats: {
      pins: pins.length,
      saves: saves.length,
      likes: likes.length,
      boards: boards.length,
    },
  });
});

app.get('/api/me/permissions', requireAuth, (req, res) => {
  const role = getUserRoleByEmail(req.auth.email);
  res.json({
    role,
    canModerate: hasRequiredRole(req.auth.email, 'moderator'),
    canAdmin: role === 'admin',
  });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = readUsers().map(user => ({
    ...publicUser(user),
    role: normalizeRole(user.role || (user.email === 'admin@mypins.com' ? 'admin' : 'user')),
    createdAt: user.createdAt || null,
  }));
  res.json({ users });
});

app.patch('/api/admin/users/:email/role', requireAuth, requireAdmin, writeRateLimiter, (req, res) => {
  const targetEmail = normalizeEmail(req.params.email);
  const requestedRole = normalizeRole(req.body.role || 'user');

  if (!targetEmail || !targetEmail.includes('@')) {
    return res.status(400).json({ error: 'A valid target email is required' });
  }

  if (targetEmail === 'admin@mypins.com' && requestedRole !== 'admin') {
    return res.status(400).json({ error: 'Primary admin role cannot be changed' });
  }

  if (targetEmail === req.auth.email && requestedRole !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin access' });
  }

  const users = readUsers();
  const index = users.findIndex(user => user.email === targetEmail);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  users[index] = {
    ...users[index],
    role: requestedRole,
  };

  const adminCount = users.filter(user => normalizeRole(user.role || (user.email === 'admin@mypins.com' ? 'admin' : 'user')) === 'admin').length;
  if (adminCount < 1) {
    return res.status(400).json({ error: 'At least one admin is required' });
  }

  writeUsers(users);
  res.json({ message: 'User role updated', user: publicUser(users[index]) });
});

app.put('/api/me', requireAuth, (req, res) => {
  const users = readUsers();
  const index = users.findIndex(user => user.email === req.auth.email);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  if (req.body.displayName !== undefined) users[index].displayName = cleanText(req.body.displayName, 60) || users[index].displayName;
  if (req.body.bio !== undefined) users[index].bio = cleanText(req.body.bio, 180);
  if (req.body.avatar !== undefined) users[index].avatar = cleanText(req.body.avatar, 2048);

  writeUsers(users);
  res.json({ message: 'Profile updated', user: publicUser(users[index]) });
});

app.get('/api/pins', (req, res) => {
  const requesterEmail = getOptionalAuthEmail(req);
  const sort = cleanText(req.query.sort || 'trending', 24);
  let pins = searchPins(req.query.q, req.query.category);
  pins = pins.filter(pin => canSeePin(pin, requesterEmail));

  if (sort === 'recent') {
    pins = [...pins].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else if (sort === 'popular') {
    pins = [...pins].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0));
  } else {
    pins = [...pins].sort((a, b) => scorePin(b) - scorePin(a));
  }

  res.json({ pins });
});

app.get('/api/pins/:id', (req, res) => {
  const requesterEmail = getOptionalAuthEmail(req);
  const id = Number(req.params.id);
  const pins = readPins();
  const pin = pins.find(item => item.id === id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  if (!canSeePin(pin, requesterEmail)) return res.status(404).json({ error: 'Pin not found' });

  const comments = readComments().filter(comment => comment.pinId === id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const related = pins
    .filter(item => item.category === pin.category && item.id !== id)
    .sort((a, b) => scorePin(b) - scorePin(a))
    .slice(0, 6);

  res.json({ ...pin, comments, related });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeBaseName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeBaseName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are supported.'));
    }
    cb(null, true);
  },
});

app.post('/api/pins', requireAuth, writeRateLimiter, upload.single('image'), (req, res) => {
  const title = cleanText(req.body.title, 120);
  const description = cleanText(req.body.description, 500);
  const category = cleanText(req.body.category || 'other', 40).toLowerCase();
  const status = parsePinStatus(req.body.status, 'published');
  const publishAtRaw = cleanText(req.body.publishAt, 60);
  const tags = normalizeTags(req.body.tags);
  const file = req.file;

  if (!title || !file) {
    return res.status(400).json({ error: 'Title and image required.' });
  }

  if (status === 'draft' && !isFeatureEnabled('enableDrafts')) {
    return res.status(403).json({ error: 'Drafts are currently disabled' });
  }
  if (status === 'scheduled' && !isFeatureEnabled('enableScheduledPins')) {
    return res.status(403).json({ error: 'Scheduled publishing is currently disabled' });
  }

  let publishAt = null;
  if (status === 'scheduled') {
    const publishTime = new Date(publishAtRaw).getTime();
    if (!publishAtRaw || Number.isNaN(publishTime) || publishTime <= Date.now()) {
      return res.status(400).json({ error: 'A future publish date is required for scheduled pins.' });
    }
    publishAt = new Date(publishTime).toISOString();
  }

  const pins = readPins();
  const newPin = {
    id: Date.now(),
    title,
    description,
    category: ['travel', 'food', 'design', 'art', 'photography'].includes(category) ? category : 'other',
    imageUrl: `/uploads/${file.filename}`,
    createdBy: req.auth.email,
    likes: 0,
    saves: 0,
    createdAt: new Date().toISOString(),
    status,
    publishAt,
    deletedAt: null,
    tags,
  };

  pins.unshift(newPin);
  writePins(pins);
  res.status(201).json(newPin);
});

app.delete('/api/pins/:id', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const pins = readPins();
  const pin = pins.find(item => item.id === id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  if (!hasPinAccess(req.auth.email, pin)) return res.status(403).json({ error: 'Forbidden' });

  pin.deletedAt = new Date().toISOString();
  writePins(pins);

  res.json({ message: 'Pin moved to trash', deletedAt: pin.deletedAt });
});

app.post('/api/pins/:id/restore', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const pins = readPins();
  const pin = pins.find(item => item.id === id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  if (!hasPinAccess(req.auth.email, pin)) return res.status(403).json({ error: 'Forbidden' });
  if (!pin.deletedAt) return res.status(400).json({ error: 'Pin is not deleted' });

  pin.deletedAt = null;
  writePins(pins);
  res.json({ message: 'Pin restored successfully' });
});

app.post('/api/pins/:id/publish', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const pins = readPins();
  const pin = pins.find(item => item.id === id);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });
  if (!hasPinAccess(req.auth.email, pin)) return res.status(403).json({ error: 'Forbidden' });

  pin.status = 'published';
  pin.publishAt = null;
  writePins(pins);
  res.json({ message: 'Pin published', pin });
});

app.get('/api/me/drafts', requireAuth, (req, res) => {
  const pins = readPins().filter(pin => pin.createdBy === req.auth.email && !pin.deletedAt && pin.status !== 'published');
  res.json({ pins });
});

app.get('/api/me/trash', requireAuth, (req, res) => {
  const pins = readPins().filter(pin => pin.createdBy === req.auth.email && Boolean(pin.deletedAt));
  res.json({ pins });
});

app.post('/api/pins/:id/like', requireAuth, writeRateLimiter, (req, res) => {
  const pinId = Number(req.params.id);
  const userEmail = req.auth.email;
  const pins = readPins();
  const pin = pins.find(item => item.id === pinId);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  let likes = readLikes();
  const existing = likes.find(item => item.pinId === pinId && item.email === userEmail);

  if (existing) {
    likes = likes.filter(item => !(item.pinId === pinId && item.email === userEmail));
    pin.likes = Math.max(0, Number(pin.likes || 0) - 1);
    writeLikes(likes);
    writePins(pins);
    return res.json({ liked: false, likes: pin.likes });
  }

  likes.push({ pinId, email: userEmail, createdAt: new Date().toISOString() });
  pin.likes = Number(pin.likes || 0) + 1;
  writeLikes(likes);
  writePins(pins);
  res.json({ liked: true, likes: pin.likes });
});

app.get('/api/pins/:id/like', requireAuth, (req, res) => {
  const pinId = Number(req.params.id);
  const liked = readLikes().some(item => item.pinId === pinId && item.email === req.auth.email);
  res.json({ liked });
});

app.post('/api/pins/:id/save', requireAuth, writeRateLimiter, (req, res) => {
  const pinId = Number(req.params.id);
  const userEmail = req.auth.email;
  const boardId = req.body.boardId !== undefined && req.body.boardId !== null && req.body.boardId !== '' ? Number(req.body.boardId) : null;

  const pins = readPins();
  const pin = pins.find(item => item.id === pinId);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  if (boardId !== null) {
    const board = readBoards().find(item => item.id === boardId && item.email === userEmail);
    if (!board) return res.status(400).json({ error: 'Board not found' });
  }

  let saves = readSaves();
  const existing = saves.find(item => item.pinId === pinId && item.email === userEmail && (item.boardId || null) === boardId);

  if (existing) {
    saves = saves.filter(item => item !== existing);
    pin.saves = Math.max(0, Number(pin.saves || 0) - 1);
    writeSaves(saves);
    writePins(pins);
    return res.json({ saved: false, saves: pin.saves });
  }

  saves.push({ pinId, email: userEmail, boardId, createdAt: new Date().toISOString() });
  pin.saves = Number(pin.saves || 0) + 1;
  writeSaves(saves);
  writePins(pins);
  res.json({ saved: true, saves: pin.saves });
});

app.get('/api/me/library', requireAuth, (req, res) => {
  const userEmail = req.auth.email;
  const likedPinIds = readLikes().filter(item => item.email === userEmail).map(item => item.pinId);
  const savedPinIds = readSaves().filter(item => item.email === userEmail).map(item => item.pinId);
  const boards = readBoards().filter(item => item.email === userEmail).map(item => ({ id: item.id, name: item.name }));
  const followingEmails = readFollows().filter(item => item.followerEmail === userEmail).map(item => item.followingEmail);

  res.json({ likedPinIds, savedPinIds, boards, followingEmails });
});

app.get('/api/me/saves', requireAuth, (req, res) => {
  const userEmail = req.auth.email;
  const pins = readPins();
  const savedIds = readSaves().filter(item => item.email === userEmail).map(item => item.pinId);
  const savedPins = pins.filter(item => savedIds.includes(item.id));
  res.json({ pins: savedPins });
});

app.get('/api/me/boards', requireAuth, (req, res) => {
  const userEmail = req.auth.email;
  const boards = readBoards().filter(item => item.email === userEmail);
  const saves = readSaves();
  const pins = readPins();

  const boardsWithPins = boards.map(board => {
    const boardSaves = saves.filter(item => item.boardId === board.id && item.email === userEmail);
    const boardPins = boardSaves.map(item => pins.find(pin => pin.id === item.pinId)).filter(Boolean);
    return { ...board, pins: boardPins, pinCount: boardPins.length };
  });

  res.json({ boards: boardsWithPins });
});

app.post('/api/boards', requireAuth, writeRateLimiter, (req, res) => {
  const userEmail = req.auth.email;
  const name = cleanText(req.body.name, 80);
  const description = cleanText(req.body.description, 160);
  const visibility = parseVisibility(req.body.visibility, 'private');

  if (!isFeatureEnabled('enableBoardPrivacy') && visibility !== 'private') {
    return res.status(403).json({ error: 'Board privacy settings are currently disabled' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Board name required' });
  }

  const boards = readBoards();
  const board = {
    id: Date.now(),
    email: userEmail,
    name,
    description,
    visibility,
    createdAt: new Date().toISOString(),
  };

  boards.push(board);
  writeBoards(boards);
  res.status(201).json(board);
});

app.patch('/api/boards/:id', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const boards = readBoards();
  const board = boards.find(item => item.id === id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.email !== req.auth.email) return res.status(403).json({ error: 'Forbidden' });

  if (req.body.name !== undefined) board.name = cleanText(req.body.name, 80) || board.name;
  if (req.body.description !== undefined) board.description = cleanText(req.body.description, 160);
  if (req.body.visibility !== undefined) board.visibility = parseVisibility(req.body.visibility, board.visibility || 'private');
  writeBoards(boards);
  res.json({ message: 'Board updated', board });
});

app.delete('/api/boards/:id', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const userEmail = req.auth.email;

  let boards = readBoards();
  const board = boards.find(item => item.id === id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.email !== userEmail) return res.status(403).json({ error: 'Forbidden' });

  boards = boards.filter(item => item.id !== id);
  writeBoards(boards);
  writeSaves(readSaves().filter(item => item.boardId !== id));

  res.json({ message: 'Board deleted' });
});

app.get('/api/pins/:id/comments', (req, res) => {
  const pinId = Number(req.params.id);
  const comments = readComments()
    .filter(comment => comment.pinId === pinId)
    .map(comment => ({ ...comment, parentId: comment.parentId || null }))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json({ comments });
});

app.post('/api/pins/:id/comments', requireAuth, writeRateLimiter, (req, res) => {
  const pinId = Number(req.params.id);
  const userEmail = req.auth.email;
  const text = cleanText(req.body.text, 280);
  const parentId = req.body.parentId !== undefined && req.body.parentId !== null && req.body.parentId !== ''
    ? Number(req.body.parentId)
    : null;
  if (!text) return res.status(400).json({ error: 'Comment text required' });

  const pin = readPins().find(item => item.id === pinId);
  if (!pin) return res.status(404).json({ error: 'Pin not found' });

  const comments = readComments();
  if (parentId !== null) {
    const parent = comments.find(comment => comment.id === parentId);
    if (!parent || parent.pinId !== pinId) {
      return res.status(400).json({ error: 'Invalid parent comment' });
    }
  }

  const user = getUserByEmail(userEmail);
  const comment = {
    id: Date.now(),
    pinId,
    parentId,
    email: userEmail,
    displayName: user ? publicUser(user).displayName : userEmail.split('@')[0],
    text,
    editedAt: null,
    createdAt: new Date().toISOString(),
  };

  comments.push(comment);
  writeComments(comments);
  res.status(201).json(comment);
});

app.patch('/api/comments/:id', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const text = cleanText(req.body.text, 280);
  if (!text) return res.status(400).json({ error: 'Comment text required' });

  const comments = readComments();
  const comment = comments.find(item => item.id === id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const isOwner = comment.email === req.auth.email;
  const canModerate = hasRequiredRole(req.auth.email, 'moderator');
  if (!isOwner && !canModerate) return res.status(403).json({ error: 'Forbidden' });

  comment.text = text;
  comment.editedAt = new Date().toISOString();
  writeComments(comments);
  res.json({ message: 'Comment updated', comment });
});

app.delete('/api/comments/:id', requireAuth, writeRateLimiter, (req, res) => {
  const id = Number(req.params.id);
  const comments = readComments();
  const comment = comments.find(item => item.id === id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const isOwner = comment.email === req.auth.email;
  const canModerate = hasRequiredRole(req.auth.email, 'moderator');
  if (!isOwner && !canModerate) return res.status(403).json({ error: 'Forbidden' });

  const toDelete = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    comments.forEach(item => {
      if (item.parentId && toDelete.has(item.parentId) && !toDelete.has(item.id)) {
        toDelete.add(item.id);
        changed = true;
      }
    });
  }

  const filtered = comments.filter(item => !toDelete.has(item.id));
  writeComments(filtered);
  res.json({ message: 'Comment deleted', deletedCount: toDelete.size });
});

app.get('/api/boards/:id/export', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const board = readBoards().find(item => item.id === id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.email !== req.auth.email && getUserRoleByEmail(req.auth.email) !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const saves = readSaves().filter(item => item.boardId === id);
  const pinIds = saves.map(item => item.pinId);
  const pins = readPins()
    .filter(pin => pinIds.includes(pin.id) && !pin.deletedAt)
    .map(pin => ({ id: pin.id, title: pin.title, imageUrl: pin.imageUrl, category: pin.category, tags: pin.tags || [] }));

  res.json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    board: {
      name: board.name,
      description: board.description || '',
      visibility: board.visibility || 'private',
    },
    pins,
  });
});

app.post('/api/boards/import', requireAuth, writeRateLimiter, (req, res) => {
  const payload = req.body || {};
  const sourceBoard = payload.board || {};
  const sourcePins = Array.isArray(payload.pins) ? payload.pins : [];
  const name = cleanText(sourceBoard.name || 'Imported board', 80);
  const description = cleanText(sourceBoard.description || '', 160);
  const visibility = parseVisibility(sourceBoard.visibility, 'private');

  const boards = readBoards();
  const newBoard = {
    id: Date.now(),
    email: req.auth.email,
    name,
    description,
    visibility,
    createdAt: new Date().toISOString(),
  };
  boards.push(newBoard);
  writeBoards(boards);

  const existingPins = readPins();
  const saves = readSaves();

  let importedCount = 0;
  sourcePins.slice(0, 200).forEach(item => {
    const sourceId = Number(item.id);
    const pin = existingPins.find(entry => entry.id === sourceId);
    if (!pin || pin.deletedAt) return;
    const duplicate = saves.some(save => save.email === req.auth.email && save.pinId === pin.id && save.boardId === newBoard.id);
    if (duplicate) return;

    saves.push({ pinId: pin.id, email: req.auth.email, boardId: newBoard.id, createdAt: new Date().toISOString() });
    importedCount += 1;
  });

  writeSaves(saves);
  res.status(201).json({ message: 'Board imported', board: newBoard, importedCount });
});

app.post('/api/pins/bulk', requireAuth, writeRateLimiter, (req, res) => {
  const action = cleanText(req.body.action, 30).toLowerCase();
  const pinIds = Array.isArray(req.body.pinIds) ? req.body.pinIds.map(Number).filter(Number.isFinite) : [];
  const tag = cleanText(req.body.tag, 40).toLowerCase();

  if (!pinIds.length) return res.status(400).json({ error: 'pinIds required' });
  if (!['delete', 'restore', 'publish', 'add-tag', 'remove-tag'].includes(action)) {
    return res.status(400).json({ error: 'Unsupported action' });
  }
  if ((action === 'add-tag' || action === 'remove-tag') && !tag) {
    return res.status(400).json({ error: 'tag required for tag actions' });
  }

  const canModerate = hasRequiredRole(req.auth.email, 'moderator');
  const pins = readPins();
  let updated = 0;

  pins.forEach(pin => {
    if (!pinIds.includes(Number(pin.id))) return;
    if (!canModerate && pin.createdBy !== req.auth.email) return;

    if (action === 'delete' && !pin.deletedAt) {
      pin.deletedAt = new Date().toISOString();
      updated += 1;
    }
    if (action === 'restore' && pin.deletedAt) {
      pin.deletedAt = null;
      updated += 1;
    }
    if (action === 'publish' && pin.status !== 'published') {
      pin.status = 'published';
      pin.publishAt = null;
      updated += 1;
    }
    if (action === 'add-tag') {
      const tags = normalizeTags([...(pin.tags || []), tag]);
      if (JSON.stringify(tags) !== JSON.stringify(pin.tags || [])) {
        pin.tags = tags;
        updated += 1;
      }
    }
    if (action === 'remove-tag') {
      const tags = normalizeTags((pin.tags || []).filter(item => item !== tag));
      if (JSON.stringify(tags) !== JSON.stringify(pin.tags || [])) {
        pin.tags = tags;
        updated += 1;
      }
    }
  });

  writePins(pins);
  res.json({ message: 'Bulk action completed', action, updated, requested: pinIds.length });
});

app.get('/api/moderation/overview', requireAuth, requireModerator, (req, res) => {
  const pins = readPins();
  const comments = readComments();
  res.json({
    totals: {
      pinsDeleted: pins.filter(pin => Boolean(pin.deletedAt)).length,
      pinsDraftOrScheduled: pins.filter(pin => !pin.deletedAt && pin.status !== 'published').length,
      comments: comments.length,
    },
    role: getUserRoleByEmail(req.auth.email),
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/users/:email/follow', requireAuth, writeRateLimiter, (req, res) => {
  if (!isFeatureEnabled('enableFollowSystem')) {
    return res.status(403).json({ error: 'Follow system is currently disabled' });
  }
  const followingEmail = normalizeEmail(req.params.email);
  const followerEmail = req.auth.email;
  if (!followingEmail || !followingEmail.includes('@')) return res.status(400).json({ error: 'Invalid target user' });
  if (followingEmail === followerEmail) return res.status(400).json({ error: 'You cannot follow yourself' });
  if (!getUserByEmail(followingEmail)) return res.status(404).json({ error: 'Target user not found' });

  let follows = readFollows();
  const existing = follows.find(item => item.followerEmail === followerEmail && item.followingEmail === followingEmail);
  if (existing) {
    follows = follows.filter(item => !(item.followerEmail === followerEmail && item.followingEmail === followingEmail));
    writeFollows(follows);
    return res.json({ following: false });
  }

  follows.push({ followerEmail, followingEmail, createdAt: new Date().toISOString() });
  writeFollows(follows);
  res.json({ following: true });
});

app.get('/api/users/:email/follow-state', requireAuth, (req, res) => {
  const followingEmail = normalizeEmail(req.params.email);
  const followerEmail = req.auth.email;
  const follows = readFollows();
  const following = follows.some(item => item.followerEmail === followerEmail && item.followingEmail === followingEmail);
  res.json({ following });
});

app.get('/api/me/following', requireAuth, (req, res) => {
  const userEmail = req.auth.email;
  const follows = readFollows().filter(item => item.followerEmail === userEmail);
  const users = readUsers();
  const following = follows
    .map(item => users.find(user => user.email === item.followingEmail))
    .filter(Boolean)
    .map(user => publicUser(user));
  res.json({ following });
});

app.get('/api/feature-flags', requireAuth, (req, res) => {
  res.json({ flags: readFeatureFlags() });
});

app.patch('/api/feature-flags', requireAuth, requireAdmin, writeRateLimiter, (req, res) => {

  const current = readFeatureFlags();
  const updates = req.body || {};
  const nextFlags = { ...current };

  Object.keys(current).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      nextFlags[key] = Boolean(updates[key]);
    }
  });

  writeFeatureFlags(nextFlags);
  res.json({ message: 'Feature flags updated', flags: nextFlags });
});

app.get(/^(?!\/api\/|\/uploads\/|\/IMG\/|\/Style\/|\/Js\/).*/, (_req, res) => {
  if (fs.existsSync(CLIENT_DIST_INDEX)) {
    return res.sendFile(CLIENT_DIST_INDEX);
  }

  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Request failed' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
