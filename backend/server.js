require('dotenv').config();

// ── Startup validation ────────────────────────────────────────────────────────
const { validateEnv } = require('./src/config/validateEnv');
const { ok, missing } = validateEnv();
if (!ok) {
  console.error(`[startup] Missing required env vars: ${missing.join(', ')}`);
  console.error('[startup] Copy .env.example to .env and fill in all values.');
  process.exit(1);
}

const path = require('path');
const fs   = require('fs');

const { connectDB, pool } = require('./src/config/db');
const logger = require('./src/utils/logger');
const GalleryImage = require('./src/models/GalleryImage');
const app = require('./src/app');

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const THUMB_DIR   = path.join(__dirname, 'uploads/thumbnails');

async function start() {
  await connectDB();

  // ── Auto-migrations (run before accepting requests) ───────────────────────
  try {
    await pool.query(`
      ALTER TABLE admins
        ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT DEFAULT 10737418240
    `);
    await pool.query(`
      ALTER TABLE admins
        ALTER COLUMN storage_quota_bytes DROP NOT NULL
    `);
    logger.info('[migrate] storage_quota_bytes column ensured');
  } catch (err) {
    logger.warn('[migrate] storage_quota_bytes migration skipped:', err.message);
  }

  // ── Google SSO columns ────────────────────────────────────────────────────
  try {
    await pool.query(`
      ALTER TABLE admins
        ADD COLUMN IF NOT EXISTS google_id TEXT,
        ADD COLUMN IF NOT EXISTS google_email TEXT,
        ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS first_login BOOLEAN NOT NULL DEFAULT TRUE
    `);
    // Unique constraint on google_id (only for non-null values)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_google_id
        ON admins (google_id) WHERE google_id IS NOT NULL
    `);
    logger.info('[migrate] google SSO columns ensured');
  } catch (err) {
    logger.warn('[migrate] google SSO migration skipped:', err.message);
  }

  try {
    const migrationSql = require('fs').readFileSync(
      require('path').join(__dirname, 'src/db/migrate_landing_sections.sql'),
      'utf8'
    );
    await pool.query(migrationSql);
    logger.info('[migrate] landing sections columns ensured');
  } catch (err) {
    logger.warn('[migrate] landing sections migration skipped:', err.message);
  }

  try {
    await pool.query(`
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS logo_image_path TEXT NOT NULL DEFAULT ''
    `);
    logger.info('[migrate] logo_image_path column ensured');
  } catch (err) {
    logger.warn('[migrate] logo_image_path migration skipped:', err.message);
  }

  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_galleries_expires_at
        ON galleries (expires_at) WHERE expires_at IS NOT NULL
    `);
    logger.info('[migrate] idx_galleries_expires_at index ensured');
  } catch (err) {
    logger.warn('[migrate] expires_at index migration skipped:', err.message);
  }

  // ── Gallery auto-deletion scheduler ──────────────────────────────────────
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  async function deleteExpiredGalleries() {
    try {
      const { rows } = await pool.query(
        `SELECT id, videos FROM galleries
         WHERE expires_at IS NOT NULL AND expires_at < NOW()`
      );
      if (!rows.length) return;

      for (const gallery of rows) {
        try {
          // Clean up image files before deleting the DB row
          const images = await GalleryImage.find({ galleryId: gallery.id });
          for (const img of images) {
            const filePath = path.join(UPLOADS_DIR, img.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (img.thumbnailPath) {
              const thumbPath = path.join(THUMB_DIR, path.basename(img.thumbnailPath));
              if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
            }
            if (img.beforePath) {
              const beforePath = path.join(UPLOADS_DIR, path.basename(img.beforePath));
              if (fs.existsSync(beforePath)) fs.unlinkSync(beforePath);
            }
          }

          // Clean up video files
          const videos = Array.isArray(gallery.videos) ? gallery.videos : [];
          for (const v of videos) {
            if (v.filename) {
              const filePath = path.join(UPLOADS_DIR, path.basename(v.filename));
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          }

          // Delete the gallery row (cascade deletes gallery_images rows via FK)
          await pool.query('DELETE FROM galleries WHERE id = $1', [gallery.id]);
          logger.info('[scheduler] Deleted expired gallery ' + gallery.id);
        } catch (galleryErr) {
          logger.error('[scheduler] Failed to delete expired gallery ' + gallery.id + ':', galleryErr.message);
        }
      }
    } catch (err) {
      logger.error('[scheduler] deleteExpiredGalleries error:', err.message);
    }
  }

  // Run once immediately on startup, then every 5 minutes
  deleteExpiredGalleries();
  setInterval(deleteExpiredGalleries, CLEANUP_INTERVAL_MS);
  logger.info('[scheduler] Gallery auto-deletion scheduler started (interval: 5 min)');

  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    logger.info(`Koral API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  server.setTimeout(30000);

  const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      logger.info('HTTP server closed');
      await pool.end();
      logger.info('Database disconnected');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
}

// ── Process handlers ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
