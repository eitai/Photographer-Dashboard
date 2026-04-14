/**
 * Express app factory — no DB connection, no listen().
 * Imported by server.js (production) and tests.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

const logger = require('./utils/logger');

const app = express();

// ── HTTPS redirect (production only, before all other middleware) ─────────────
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Health checks from internal load balancers are exempt
    if (req.path === '/api/health' || req.path === '/api/v1/health') return next();
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Cookie parsing ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── CORS ──────────────────────────────────────────────────────────────────────
// FRONTEND_URL may be a single URL or comma-separated list of URLs.
// Trailing slashes are stripped so http://example.com/ and http://example.com both match.
const parseOrigins = (raw) =>
  (raw || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

const allowedOrigins = [
  ...parseOrigins(process.env.FRONTEND_URL),
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000']
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = non-browser client (curl, mobile app, server-to-server).
      if (!origin) return callback(null, true);
      const normalised = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalised)) return callback(null, true);
      logger.warn(`CORS blocked: ${origin} — allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Request logging (skip in test) ───────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(
    morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
      stream: { write: (msg) => logger.info(msg.trim()) },
    })
  );
}

// ── Body parsing with size limits ────────────────────────────────────────────
// 2mb to accommodate rich-text blog content (TipTap HTML can be several hundred KB)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/uploads')) return false;
    return compression.filter(req, res);
  },
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many contact submissions, please try again later.' },
});

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many submissions, please try again later.' },
});

const galleryTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/seed', authLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/p/:id/contact', contactLimiter);
app.use('/api/galleries/:galleryId/submit', submissionLimiter);
app.use('/api/product-orders/:id/selection', submissionLimiter);
app.use('/api/galleries/token', galleryTokenLimiter);

// ── Static files ──────────────────────────────────────────────────────────────
// crossOriginResourcePolicy must be disabled here so browsers can load images
// from this origin into pages served from a different origin (the frontend).
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  })
);

// 404 fallback for /uploads — tell Cloudflare not to cache misses so a
// newly uploaded file becomes visible immediately on the next request.
app.use('/uploads', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({ message: 'File not found' });
});

// ── Routes ────────────────────────────────────────────────────────────────────
// All routes are mounted on a versioned sub-router.
// Both /api/v1/* (canonical) and /api/* (backward compat) are active.
const v1 = express.Router();
v1.use('/auth',                      require('./routes/auth'));
v1.use('/clients',                   require('./routes/clients'));
v1.use('/galleries',                 require('./routes/galleries'));
v1.use('/galleries/:galleryId/images', require('./routes/images'));
v1.use('/galleries/:galleryId',        require('./routes/selections'));
v1.use('/blog',                      require('./routes/blog'));
v1.use('/contact',                   require('./routes/contact'));
v1.use('/settings',                  require('./routes/settings'));
v1.use('/admins',                    require('./routes/admins'));
v1.use('/storage',                   require('./routes/storage'));
v1.use('/admin-products',            require('./routes/adminProducts'));
v1.use('/product-orders',            require('./routes/productOrders'));
v1.use('/p/:id',                     require('./routes/public'));

app.use('/api/v1', v1);
app.use('/api',    v1); // backward compat — existing clients keep working

// ── Root + health checks ──────────────────────────────────────────────────────
// GET /api and GET /api/v1 return 200 so deployment platform health probes pass.
app.get(['/api', '/api/v1'], (req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version || '1.0.0' });
});

app.get(['/api/health', '/api/v1/health'], async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const { pool } = require('./config/db');
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (_) {
    // pool unavailable — status stays disconnected
  }
  const ok = dbStatus === 'connected';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    version: process.env.npm_package_version || '1.0.0',
  });
});

// ── Test-only error trigger ────────────────────────────────────────────────────
// Lets the test suite exercise the global error handler without any mocking.
if (process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line no-unused-vars
  app.get('/__test_error', (req, res, next) => next(new Error('deliberate test error')));
}

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ message: err.message });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  const statusCode = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV !== 'test') {
    logger.error(`${statusCode} ${req.method} ${req.path} — ${err.message}`, err);
  }

  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

module.exports = app;
