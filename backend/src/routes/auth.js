const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');
const formatAdmin = require('../utils/formatAdmin');

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const SSO_SESSION_TTL = 7 * 24 * 60 * 60; // 1 week in seconds
const signSsoToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: SSO_SESSION_TTL });

// secure=true whenever the request arrives over HTTPS (x-forwarded-proto set by proxy/CDN)
// or when NODE_ENV is explicitly production — whichever is true first.
const isSecure = (req) =>
  process.env.NODE_ENV === 'production' ||
  req?.headers?.['x-forwarded-proto'] === 'https';

const cookieOptions = (req, maxAgeMs = 7 * 24 * 60 * 60 * 1000) => ({
  httpOnly: true,
  secure: isSecure(req),
  sameSite: isSecure(req) ? 'strict' : 'lax',
  maxAge: maxAgeMs,
});

// POST /api/auth/login
// Accepts { email, password } or { username, password } — identifier checked against both fields
router.post('/login', asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const identifier = email || username;
  if (!identifier || !password)
    return res.status(400).json({ message: 'Credentials required' });

  // Reject non-string values — prevents injection via { "$gt": "" } objects
  if (typeof identifier !== 'string' || typeof password !== 'string')
    return res.status(400).json({ message: 'Credentials must be strings' });

  const admin = await Admin.findOne({ $or: [{ email: identifier }, { username: identifier }] });
  if (!admin || !(await Admin.comparePassword(admin, password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  // Clear first_login flag on first successful sign-in.
  // We send firstLogin: true in THIS response so the frontend can show
  // the SSO setup modal, then flip it to false for all subsequent logins.
  const wasFirstLogin = !!admin.firstLogin;
  if (wasFirstLogin) {
    await Admin.findByIdAndUpdate(admin.id, { firstLogin: false });
    // Keep admin.firstLogin = true so formatAdmin sends true in this response
  }

  const token = signToken(admin.id);
  res.cookie('koral_token', token, cookieOptions(req));
  res.json({ admin: formatAdmin(admin) });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('koral_token', cookieOptions(req));
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ admin: formatAdmin(req.admin) });
});

// PUT /api/auth/password
router.put('/password', protect, asyncHandler(async (req, res) => {
  const { current, next } = req.body;
  const pwErr = validatePassword(next);
  if (pwErr) return res.status(400).json({ message: pwErr });

  // Re-fetch to get password hash
  const admin = await Admin.findById(req.admin.id);
  if (!(await Admin.comparePassword(admin, current)))
    return res.status(400).json({ message: 'Current password is incorrect' });

  await Admin.updatePassword(req.admin.id, next);
  res.json({ message: 'Password updated' });
}));

// POST /api/auth/push-token
router.post('/push-token', protect, asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token is required and must be a string' });
  }
  await Admin.findByIdAndUpdate(req.admin.id, { pushToken: token });
  res.json({ message: 'Push token saved' });
}));

// PATCH /api/auth/profile
router.patch('/profile', protect, asyncHandler(async (req, res) => {
  const { name, studioName, username } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (studioName !== undefined) update.studioName = studioName;
  if (username !== undefined) update.username = username.toLowerCase().trim();

  if (update.username) {
    // Check for conflict with another admin
    const conflict = await Admin.findOne({ username: update.username });
    if (conflict && conflict.id !== req.admin.id)
      return res.status(409).json({ message: 'Username already taken' });
  }

  const updated = await Admin.findByIdAndUpdate(req.admin.id, update);
  res.json({ admin: formatAdmin(updated) });
}));

// POST /api/auth/seed  — creates first superadmin (only when no admins exist)
router.post('/seed', asyncHandler(async (req, res) => {
  const { name, email, username, password } = req.body;
  const count = await Admin.countDocuments();
  if (count > 0)
    return res.status(400).json({ message: 'Admins already exist. Use superadmin panel to add more.' });
  const admin = await Admin.create({ name, email, username, password, role: 'superadmin' });
  res.status(201).json({ message: 'Superadmin created', id: admin.id });
}));

// ── Google OAuth helpers ───────────────────────────────────────────────────────

const FRONTEND_URL = () => (process.env.FRONTEND_URL || 'http://localhost:8080').split(',')[0].trim().replace(/\/$/, '');

// ── State-param helpers (avoids express-session dependency) ───────────────────
// We encode { adminId } as a signed JWT in the OAuth `state` param so the
// link-callback can identify which admin is being linked.

function encodeState(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function decodeState(state) {
  try {
    return jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// ── GET /api/auth/google — initiate login flow ─────────────────────────────
router.get('/google', (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    return res.redirect(`${FRONTEND_URL()}/admin?sso=error&reason=not_configured`);
  }
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: encodeState({ flow: 'login' }),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ── GET /api/auth/google/callback — unified callback for login + link flows ─
router.get('/google/callback', asyncHandler(async (req, res) => {
  const { code, state, error } = req.query;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  if (error || !code) {
    return res.redirect(`${FRONTEND_URL()}/admin?sso=error`);
  }

  const stateData = decodeState(state);
  if (!stateData || !['login', 'link'].includes(stateData.flow)) {
    return res.redirect(`${FRONTEND_URL()}/admin?sso=error`);
  }

  let googleProfile;
  try {
    googleProfile = await exchangeCodeForProfile(code, callbackUrl);
  } catch {
    return res.redirect(`${FRONTEND_URL()}/admin?sso=error`);
  }

  const { googleId, googleEmail } = googleProfile;

  // ── Link flow: attach Google identity to an already-authenticated admin ──
  if (stateData.flow === 'link') {
    if (!stateData.adminId) {
      return res.redirect(`${FRONTEND_URL()}/admin/settings?sso=error`);
    }
    const existing = await Admin.findByGoogleId(googleId);
    if (existing && existing.id !== stateData.adminId) {
      return res.redirect(`${FRONTEND_URL()}/admin/settings?sso=error&reason=already_linked`);
    }
    await Admin.findByIdAndUpdate(stateData.adminId, { googleId, googleEmail, ssoEnabled: true });
    return res.redirect(`${FRONTEND_URL()}/admin/settings?tab=security&sso=linked`);
  }

  // ── Login flow: sign in via Google ────────────────────────────────────────
  let admin = await Admin.findByGoogleId(googleId);
  if (!admin) {
    admin = await Admin.findOne({ email: googleEmail });
    if (!admin) {
      return res.redirect(`${FRONTEND_URL()}/admin?sso=error&reason=no_account`);
    }
    // Auto-link on first Google login when email matches an existing admin
    await Admin.findByIdAndUpdate(admin.id, { googleId, googleEmail, ssoEnabled: true });
    admin.googleId = googleId;
    admin.googleEmail = googleEmail;
    admin.ssoEnabled = true;
  }

  if (!admin.ssoEnabled) {
    return res.redirect(`${FRONTEND_URL()}/admin?sso=error&reason=sso_disabled`);
  }

  const isFirstLogin = admin.firstLogin !== false;
  if (isFirstLogin) {
    await Admin.findByIdAndUpdate(admin.id, { firstLogin: false });
    admin.firstLogin = false;
  }

  const token = signSsoToken(admin.id);
  res.cookie('koral_token', token, cookieOptions(req, SSO_SESSION_TTL * 1000));

  const dest = admin.role === 'superadmin' ? '/admin/users' : '/admin/dashboard';
  res.redirect(`${FRONTEND_URL()}${dest}?sso=success`);
}));

// ── GET /api/auth/google/link — initiate account-linking flow ─────────────
// Reuses GOOGLE_CALLBACK_URL (same as the login flow) so only one redirect URI
// needs to be registered in Google Cloud Console. The `flow` value in the
// signed state param routes the single callback handler appropriately.
router.get('/google/link', protect, (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    return res.redirect(`${FRONTEND_URL()}/admin/settings?sso=error&reason=not_configured`);
  }
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: encodeState({ flow: 'link', adminId: req.admin.id }),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ── DELETE /api/auth/google/link — unlink Google account ──────────────────
router.delete('/google/link', protect, asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(req.admin.id, {
    googleId: null,
    googleEmail: null,
    ssoEnabled: false,
  });
  res.json({ message: 'Google account unlinked' });
}));

// ── PATCH /api/auth/sso — toggle sso_enabled ──────────────────────────────
router.patch('/sso', protect, asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin.id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });
  if (!admin.googleId) {
    return res.status(400).json({ message: 'No Google account linked. Link a Google account first.' });
  }
  const updated = await Admin.findByIdAndUpdate(admin.id, { ssoEnabled: !admin.ssoEnabled });
  res.json({ admin: formatAdmin(updated) });
}));

// ── Shared: exchange Google authorization code for profile info ───────────

async function exchangeCodeForProfile(code, redirectUri) {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  const idToken = tokenData.id_token;

  if (!idToken) throw new Error('No id_token in response');

  // Decode JWT payload (no need to verify — Google already validated with client_secret exchange)
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));

  return {
    googleId: payload.sub,
    googleEmail: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

module.exports = router;
