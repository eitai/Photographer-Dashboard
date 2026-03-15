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
const mongoose = require('mongoose');
const path = require('path');

const logger = require('./utils/logger');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── Cookie parsing ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000']
    : []),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = non-browser client (curl, mobile app, server-to-server).
      // CORS is a browser-only restriction; non-browser callers are protected by JWT auth.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Rate limiting ─────────────────────────────────────────────────────────────
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

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/seed', authLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/p/:id/contact', contactLimiter);

// ── Static files ──────────────────────────────────────────────────────────────
// crossOriginResourcePolicy must be disabled here so browsers can load images
// from this origin into pages served from a different origin (the frontend).
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, '../uploads'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  })
);

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
v1.use('/product-orders',            require('./routes/productOrders'));
v1.use('/p/:id',                     require('./routes/public'));

app.use('/api/v1', v1);
app.use('/api',    v1); // backward compat — existing clients keep working

// ── Health check — available at both /api/health and /api/v1/health ──────────
app.get(['/api/health', '/api/v1/health'], async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' }[dbState] || 'unknown';
  const status = dbState === 1 ? 'ok' : 'degraded';
  res.status(dbState === 1 ? 200 : 503).json({
    status,
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
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
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
