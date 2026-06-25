const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Subscription = require('../models/Subscription');
const AdminProduct = require('../models/AdminProduct');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const validatePassword = require('../utils/validatePassword');
const formatAdmin = require('../utils/formatAdmin');

const router = express.Router();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const SSO_SESSION_TTL = 7 * 24 * 60 * 60; // 1 week in seconds
const signSsoToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: SSO_SESSION_TTL });

// secure=true whenever the request arrives over HTTPS (x-forwarded-proto set by proxy/CDN)
// or when NODE_ENV is explicitly production — whichever is true first.
const isSecure = (req) => process.env.NODE_ENV === 'production' || req?.headers?.['x-forwarded-proto'] === 'https';

const cookieOptions = (req, maxAgeMs = 7 * 24 * 60 * 60 * 1000) => ({
  httpOnly: true,
  secure: isSecure(req),
  sameSite: 'lax',
  maxAge: maxAgeMs,
});

// POST /api/auth/login
// Photographer (role: 'admin') login only. Superadmins must use /superadmin-login.
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    const identifier = email || username;
    if (!identifier || !password) return res.status(400).json({ message: 'Credentials required' });

    // Reject non-string values — prevents injection via { "$gt": "" } objects
    if (typeof identifier !== 'string' || typeof password !== 'string')
      return res.status(400).json({ message: 'Credentials must be strings' });

    const admin = await Admin.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!admin || !(await Admin.comparePassword(admin, password))) return res.status(401).json({ message: 'Invalid credentials' });

    if (admin.role === 'superadmin') return res.status(403).json({ message: 'Use the admin portal to sign in' });

    const token = signToken(admin.id);
    res.cookie('koral_token', token, cookieOptions(req));
    res.json({ admin: formatAdmin(admin) });
  }),
);

// POST /api/auth/superadmin-login
// Superadmin-only login. Regular admins must use /login from the landing page.
router.post(
  '/superadmin-login',
  asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    const identifier = email || username;
    if (!identifier || !password) return res.status(400).json({ message: 'Credentials required' });

    if (typeof identifier !== 'string' || typeof password !== 'string')
      return res.status(400).json({ message: 'Credentials must be strings' });

    const admin = await Admin.findOne({ $or: [{ email: identifier }, { username: identifier }] });
    if (!admin || !(await Admin.comparePassword(admin, password))) return res.status(401).json({ message: 'Invalid credentials' });

    if (admin.role !== 'superadmin') return res.status(403).json({ message: 'Access restricted to administrators' });

    const wasFirstLogin = !!admin.firstLogin;
    if (wasFirstLogin) {
      await Admin.findByIdAndUpdate(admin.id, { firstLogin: false });
    }

    const token = signToken(admin.id);
    res.cookie('koral_token', token, cookieOptions(req));
    res.json({ admin: formatAdmin(admin) });
  }),
);

const clearCookieOpts = (req) => ({
  httpOnly: true,
  secure: isSecure(req),
  sameSite: 'lax',
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('koral_token', clearCookieOpts(req));
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ admin: formatAdmin(req.admin) });
});

// PUT /api/auth/password
router.put(
  '/password',
  protect,
  asyncHandler(async (req, res) => {
    const { current, next } = req.body;
    const pwErr = validatePassword(next);
    if (pwErr) return res.status(400).json({ message: pwErr });

    // Re-fetch to get password hash
    const admin = await Admin.findById(req.admin.id);
    if (!(await Admin.comparePassword(admin, current))) return res.status(400).json({ message: 'Current password is incorrect' });

    await Admin.updatePassword(req.admin.id, next);
    res.json({ message: 'Password updated' });
  }),
);

// POST /api/auth/push-token
router.post(
  '/push-token',
  protect,
  asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'token is required and must be a string' });
    }
    await Admin.findByIdAndUpdate(req.admin.id, { pushToken: token });
    res.json({ message: 'Push token saved' });
  }),
);

// PATCH /api/auth/profile
router.patch(
  '/profile',
  protect,
  asyncHandler(async (req, res) => {
    const { name, studioName, username, addressStreet, addressApartment, addressCity, addressZip, addressCountry } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (studioName !== undefined) update.studioName = studioName;
    if (username !== undefined) update.username = username.toLowerCase().trim();
    if (addressStreet !== undefined) update.addressStreet = addressStreet || null;
    if (addressApartment !== undefined) update.addressApartment = addressApartment || null;
    if (addressCity !== undefined) update.addressCity = addressCity || null;
    if (addressZip !== undefined) update.addressZip = addressZip || null;
    if (addressCountry !== undefined) update.addressCountry = addressCountry || null;

    if (update.username) {
      // Check for conflict with another admin
      const conflict = await Admin.findOne({ username: update.username });
      if (conflict && conflict.id !== req.admin.id) return res.status(409).json({ message: 'Username already taken' });
    }

    const updated = await Admin.findByIdAndUpdate(req.admin.id, update);
    res.json({ admin: formatAdmin(updated) });
  }),
);

// PATCH /api/auth/first-login — mark onboarding as complete
router.patch(
  '/first-login',
  protect,
  asyncHandler(async (req, res) => {
    await Admin.findByIdAndUpdate(req.admin.id, { firstLogin: false });
    res.json({ ok: true });
  }),
);

// POST /api/auth/seed  — creates first superadmin (only when no admins exist)
router.post(
  '/seed',
  asyncHandler(async (req, res) => {
    const { name, email, username, password } = req.body;
    const count = await Admin.countDocuments();
    if (count > 0) return res.status(400).json({ message: 'Admins already exist. Use superadmin panel to add more.' });
    const admin = await Admin.create({ name, email, username, password, role: 'superadmin' });
    await Subscription.assignFreePlan(admin.id);
    res.status(201).json({ message: 'Superadmin created', id: admin.id });
  }),
);

// POST /api/auth/register — public self-service photographer registration
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, studioName, email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    if (typeof email !== 'string' || typeof password !== 'string')
      return res.status(400).json({ message: 'Invalid input' });

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ message: pwErr });

    const exists = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const derivedName = (name?.trim()) || email.split('@')[0];

    const admin = await Admin.create({
      name: derivedName,
      email: email.toLowerCase().trim(),
      password,
      role: 'admin',
      studioName: studioName?.trim() || undefined,
    });

    await AdminProduct.seedDefaults(admin.id);
    await Subscription.assignFreePlan(admin.id);

    const token = signToken(admin.id);
    res.cookie('koral_token', token, cookieOptions(req));
    res.status(201).json({ admin: formatAdmin(admin) });
  }),
);

// ── Google OAuth helpers ───────────────────────────────────────────────────────

const FRONTEND_URL = () => {
  const url = process.env.FRONTEND_URL;
  if (!url) return 'http://localhost:8080';
  return url.split(',')[0].trim().replace(/\/$/, '');
};

// Derive Google callback URL from GOOGLE_CALLBACK_URL if set, otherwise from
// FRONTEND_URL (works in production where nginx proxies /api/ to the backend).
// Falls back to localhost:5000 only in dev where frontend and backend differ ports.
const googleCallbackUrl = () => {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  const base = FRONTEND_URL();
  if (!base.includes('localhost')) return `${base}/api/auth/google/callback`;
  return 'http://localhost:5000/api/auth/google/callback';
};

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

// ── GET /api/auth/google — initiate photographer login flow ────────────────
router.get('/google', (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    return res.redirect(`${FRONTEND_URL()}/login?sso=error&reason=not_configured`);
  }
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: encodeState({ flow: 'login' }),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ── GET /api/auth/google/superadmin — initiate superadmin login flow ───────
router.get('/google/superadmin', (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    return res.redirect(`${FRONTEND_URL()}/admin?sso=error&reason=not_configured`);
  }
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state: encodeState({ flow: 'superadmin-login' }),
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// ── GET /api/auth/google/callback — unified callback for login + link flows ─
router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const callbackUrl = googleCallbackUrl();

    // Decode state early so we can route errors to the correct login page
    const stateData = decodeState(state);
    const isSuperadminFlow = stateData?.flow === 'superadmin-login';
    const errorBase = isSuperadminFlow ? '/admin' : '/login';

    if (error || !code) {
      console.error('[SSO] Google returned error or no code:', { error, hasCode: !!code });
      return res.redirect(`${FRONTEND_URL()}${errorBase}?sso=error&reason=no_code&detail=${encodeURIComponent(error || 'missing_code')}`);
    }

    if (!stateData || !['login', 'link', 'superadmin-login'].includes(stateData.flow)) {
      console.error('[SSO] State decode failed:', { hasState: !!state, stateData });
      return res.redirect(`${FRONTEND_URL()}${errorBase}?sso=error&reason=state_failed`);
    }

    let googleProfile;
    try {
      googleProfile = await exchangeCodeForProfile(code, callbackUrl);
    } catch (err) {
      console.error('[SSO] exchangeCodeForProfile failed:', err.message);
      return res.redirect(`${FRONTEND_URL()}${errorBase}?sso=error&reason=exchange_failed&detail=${encodeURIComponent(err.message)}`);
    }

    const { googleId, googleEmail } = googleProfile;

    // ── Link flow: attach Google identity to an already-authenticated admin ──
    if (stateData.flow === 'link') {
      const returnBase = stateData.returnTo ?? '/admin/settings?tab=security';
      const sep = returnBase.includes('?') ? '&' : '?';
      if (!stateData.adminId) {
        return res.redirect(`${FRONTEND_URL()}${returnBase}${sep}sso=error`);
      }
      const existing = await Admin.findByGoogleId(googleId);
      if (existing && existing.id !== stateData.adminId) {
        return res.redirect(`${FRONTEND_URL()}${returnBase}${sep}sso=error&reason=already_linked`);
      }
      await Admin.findByIdAndUpdate(stateData.adminId, { googleId, googleEmail, ssoEnabled: true });
      return res.redirect(`${FRONTEND_URL()}${returnBase}${sep}sso=linked`);
    }

    // ── Superadmin login flow ─────────────────────────────────────────────────
    if (stateData.flow === 'superadmin-login') {
      let admin = await Admin.findByGoogleId(googleId);
      if (!admin) {
        admin = await Admin.findOne({ email: googleEmail });
        if (!admin) return res.redirect(`${FRONTEND_URL()}/admin?sso=error&reason=no_account`);
        await Admin.findByIdAndUpdate(admin.id, { googleId, googleEmail, ssoEnabled: true });
        admin.googleId = googleId;
        admin.googleEmail = googleEmail;
        admin.ssoEnabled = true;
      }
      if (admin.role !== 'superadmin') {
        return res.redirect(`${FRONTEND_URL()}/admin?sso=error&reason=not_superadmin`);
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
      return res.redirect(`${FRONTEND_URL()}/admin/users?sso=success`);
    }

    // ── Photographer login flow (role: 'admin' only) ───────────────────────
    let admin = await Admin.findByGoogleId(googleId);
    let isNewSignup = false;

    if (!admin) {
      admin = await Admin.findOne({ email: googleEmail });
      if (!admin) {
        // Auto-register: new photographer signing up via Google
        const randomPassword = crypto.randomBytes(32).toString('hex');
        admin = await Admin.create({
          name: googleProfile.name || googleEmail.split('@')[0],
          email: googleEmail,
          password: randomPassword,
          role: 'admin',
        });
        await Admin.findByIdAndUpdate(admin.id, { googleId, googleEmail, ssoEnabled: true });
        await AdminProduct.seedDefaults(admin.id);
        await Subscription.assignFreePlan(admin.id);
        isNewSignup = true;
      } else {
        // Auto-link on first Google login when email matches an existing admin
        await Admin.findByIdAndUpdate(admin.id, { googleId, googleEmail, ssoEnabled: true });
        admin.googleId = googleId;
        admin.googleEmail = googleEmail;
        admin.ssoEnabled = true;
      }
    }

    if (admin.role === 'superadmin') {
      return res.redirect(`${FRONTEND_URL()}/login?sso=error&reason=use_admin_portal`);
    }

    if (!isNewSignup && !admin.ssoEnabled) {
      return res.redirect(`${FRONTEND_URL()}/login?sso=error&reason=sso_disabled`);
    }

    const token = signSsoToken(admin.id);
    res.cookie('koral_token', token, cookieOptions(req, SSO_SESSION_TTL * 1000));

    if (isNewSignup) {
      return res.redirect(`${FRONTEND_URL()}/onboarding`);
    }
    res.redirect(`${FRONTEND_URL()}/admin/dashboard?sso=success`);
  }),
);

// ── GET /api/auth/google/link — initiate account-linking flow ─────────────
// Reuses GOOGLE_CALLBACK_URL (same as the login flow) so only one redirect URI
// needs to be registered in Google Cloud Console. The `flow` value in the
// signed state param routes the single callback handler appropriately.
router.get('/google/link', protect, (req, res) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  if (!clientID) {
    return res.redirect(`${FRONTEND_URL()}/admin/settings?sso=error&reason=not_configured`);
  }
  const callbackUrl = googleCallbackUrl();
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
router.delete(
  '/google/link',
  protect,
  asyncHandler(async (req, res) => {
    await Admin.findByIdAndUpdate(req.admin.id, {
      googleId: null,
      googleEmail: null,
      ssoEnabled: false,
    });
    res.json({ message: 'Google account unlinked' });
  }),
);

// ── PATCH /api/auth/sso — toggle sso_enabled ──────────────────────────────
router.patch(
  '/sso',
  protect,
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.googleId) {
      return res.status(400).json({ message: 'No Google account linked. Link a Google account first.' });
    }
    const updated = await Admin.findByIdAndUpdate(admin.id, { ssoEnabled: !admin.ssoEnabled });
    res.json({ admin: formatAdmin(updated) });
  }),
);

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
    const body = await tokenRes.text();
    console.error('[SSO] Token exchange failed:', tokenRes.status, body);
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
