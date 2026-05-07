require('dotenv').config();

// Project secrets (AWS keys, JWT secret, SMTP password) are mounted by
// systemd via LoadCredential= when running in production. This helper reads
// $CREDENTIALS_DIRECTORY and projects each file's contents into process.env
// under its UPPERCASED filename. Must run BEFORE validateEnv() so the
// startup check sees the credential-mounted values. No-op outside systemd.
require('./src/utils/loadSystemdCredentials').loadSystemdCredentials();

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
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS contact_section_enabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
    await pool.query(`
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS contact_section_heading TEXT NOT NULL DEFAULT ''
    `);
    await pool.query(`
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS contact_section_subheading TEXT NOT NULL DEFAULT ''
    `);
    logger.info('[migrate] contact_section columns ensured');
  } catch (err) {
    logger.warn('[migrate] contact_section migration skipped:', err.message);
  }

  try {
    await pool.query(`
      ALTER TABLE site_settings
        ADD COLUMN IF NOT EXISTS cta_banner_image_path TEXT NOT NULL DEFAULT ''
    `);
    logger.info('[migrate] cta_banner_image_path column ensured');
  } catch (err) {
    logger.warn('[migrate] cta_banner_image_path migration skipped:', err.message);
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

  try {
    await pool.query(`ALTER TABLE galleries ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT ''`);
    logger.info('[migrate] galleries.session_type column ensured');
  } catch (err) {
    logger.warn('[migrate] galleries.session_type migration skipped:', err.message);
  }

  try {
    await pool.query(`ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS preview_path VARCHAR`);
    await pool.query(`ALTER TABLE gallery_images ALTER COLUMN path DROP NOT NULL`);
    logger.info('[migrate] gallery_images.preview_path column ensured');
  } catch (err) {
    logger.warn('[migrate] gallery_images.preview_path migration skipped:', err.message);
  }

  // ── assets table (compression pipeline) ──────────────────────────────────
  try {
    const assetsSql = require('fs').readFileSync(
      require('path').join(__dirname, 'src/db/migrations/007_assets.sql'),
      'utf8'
    );
    await pool.query(assetsSql);
    logger.info('[migrate] assets table ensured');
  } catch (err) {
    logger.warn('[migrate] assets migration skipped:', err.message);
  }

  try {
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_tagline TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stats_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '[]'`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promises_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promises JSONB NOT NULL DEFAULT '[]'`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS faq_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS faq_items JSONB NOT NULL DEFAULT '[]'`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS final_cta_heading TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS final_cta_subtext TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS final_cta_button_label TEXT NOT NULL DEFAULT ''`);
    logger.info('[migrate] site_settings stats/promises/faq columns ensured');
  } catch (err) {
    logger.warn('[migrate] site_settings stats/promises/faq migration skipped:', err.message);
  }

  // ── Gallery folders + selection_enabled ───────────────────────────────────
  try {
    await pool.query(`ALTER TABLE galleries ADD COLUMN IF NOT EXISTS selection_enabled BOOLEAN NOT NULL DEFAULT TRUE`);
    logger.info('[migrate] galleries.selection_enabled column ensured');
  } catch (err) {
    logger.warn('[migrate] galleries.selection_enabled migration skipped:', err.message);
  }

  try {
    await pool.query(`ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS folder_ids UUID[] NOT NULL DEFAULT '{}'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gallery_images_folder_ids ON gallery_images USING GIN(folder_ids)`);
    logger.info('[migrate] gallery_images.folder_ids column ensured');
  } catch (err) {
    logger.warn('[migrate] gallery_images.folder_ids migration skipped:', err.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gallery_folders (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gallery_id  UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_gallery_folders_gallery_id ON gallery_folders(gallery_id, sort_order)`);
    logger.info('[migrate] gallery_folders table ensured');
  } catch (err) {
    logger.warn('[migrate] gallery_folders migration skipped:', err.message);
  }

  try {
    await pool.query(`
      ALTER TABLE product_orders
        ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
        ADD COLUMN IF NOT EXISTS link_enabled BOOLEAN NOT NULL DEFAULT FALSE
    `);
    logger.info('[migrate] product_orders token + link_enabled columns ensured');
  } catch (err) {
    logger.warn('[migrate] product_orders token migration skipped:', err.message);
  }

  try {
    await pool.query(`
      ALTER TABLE product_orders
        DROP CONSTRAINT IF EXISTS product_orders_status_check
    `);
    await pool.query(`
      ALTER TABLE product_orders
        ADD CONSTRAINT product_orders_status_check
        CHECK (status IN ('pending', 'submitted', 'delivered'))
    `);
    logger.info('[migrate] product_orders_status_check constraint ensured');
  } catch (err) {
    logger.warn('[migrate] product_orders status constraint migration skipped:', err.message);
  }

  try {
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS event_date DATE`);
    logger.info('[migrate] clients.event_date column ensured');
  } catch (err) {
    logger.warn('[migrate] clients.event_date migration skipped:', err.message);
  }

  // ── Face recognition tables ───────────────────────────────────────────────
  try {
    await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS face_recognition_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
    logger.info('[migrate] clients.face_recognition_enabled column ensured');
  } catch (err) {
    logger.warn('[migrate] clients.face_recognition_enabled migration skipped:', err.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS client_face_references (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        admin_id      UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        image_path    TEXT NOT NULL,
        embedding     JSONB NOT NULL,
        model_version TEXT NOT NULL DEFAULT 'vladmandic-face-api-v1',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(client_id)
      )
    `);
    logger.info('[migrate] client_face_references table ensured');
  } catch (err) {
    logger.warn('[migrate] client_face_references migration skipped:', err.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gallery_image_face_tags (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gallery_image_id  UUID NOT NULL REFERENCES gallery_images(id) ON DELETE CASCADE,
        client_id         UUID REFERENCES clients(id) ON DELETE SET NULL,
        admin_id          UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        confidence        FLOAT4 NOT NULL DEFAULT 0,
        bounding_box      JSONB NOT NULL DEFAULT '{}',
        status            TEXT NOT NULL DEFAULT 'matched'
          CHECK (status IN ('matched','unmatched','pending','error')),
        confirmed_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_face_tags_gallery_image
        ON gallery_image_face_tags (gallery_image_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_face_tags_client
        ON gallery_image_face_tags (client_id, admin_id) WHERE client_id IS NOT NULL
    `);
    // descriptor + cluster_id + updated_at added for face clustering (safe to run on existing tables)
    await pool.query(`ALTER TABLE gallery_image_face_tags ADD COLUMN IF NOT EXISTS descriptor JSONB`);
    await pool.query(`ALTER TABLE gallery_image_face_tags ADD COLUMN IF NOT EXISTS cluster_id UUID`);
    await pool.query(`ALTER TABLE gallery_image_face_tags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_face_tags_cluster_id ON gallery_image_face_tags (cluster_id) WHERE cluster_id IS NOT NULL`);
    await pool.query(`ALTER TABLE gallery_image_face_tags ADD COLUMN IF NOT EXISTS face_crop_path TEXT`);
    logger.info('[migrate] gallery_image_face_tags table ensured');
  } catch (err) {
    logger.warn('[migrate] gallery_image_face_tags migration skipped:', err.message);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS face_recognition_jobs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gallery_id   UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
        admin_id     UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        total_images INT NOT NULL DEFAULT 0,
        processed    INT NOT NULL DEFAULT 0,
        matched      INT NOT NULL DEFAULT 0,
        status       TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued','running','done','failed')),
        error_message TEXT,
        started_at   TIMESTAMPTZ,
        finished_at  TIMESTAMPTZ,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(gallery_id)
      )
    `);
    logger.info('[migrate] face_recognition_jobs table ensured');
  } catch (err) {
    logger.warn('[migrate] face_recognition_jobs migration skipped:', err.message);
  }

  // Reset any jobs that were left in 'running' state from a previous crashed process.
  // Safe to do unconditionally — the worker re-checks and re-processes only untagged images.
  try {
    await pool.query(
      `UPDATE face_recognition_jobs SET status = 'queued', started_at = NULL WHERE status = 'running'`
    );
  } catch (err) {
    logger.warn('[startup] face recognition job reset skipped:', err.message);
  }

  // ── In-process face recognition worker ───────────────────────────────────
  // Runs in the API process so `npm run dev` is enough in development.
  // The separate `npm run workers` process also handles this queue in production.
  try {
    const { getQueue, JOB_NAMES } = require('./src/queue');
    const { processGalleryBatch } = require('./src/services/faceService');
    const boss = await getQueue();
    boss.work(JOB_NAMES.FACE_RECOGNITION, { teamSize: 1, teamConcurrency: 1 }, async (job) => {
      const { galleryId, adminId } = job.data || {};
      if (!galleryId || !adminId) {
        logger.warn(`[face] job ${job.id} missing galleryId/adminId; ack`);
        return;
      }

      // Re-fetch ALL gallery image IDs from the DB right now rather than using
      // the payload captured at enqueue time. The upload hook sends files in
      // parallel 50 MB batches; pg-boss deduplicates via singletonKey so only
      // the first batch's job survives. By reading from the DB here we process
      // every image that exists at the moment the worker actually starts.
      const { rows: imgRows } = await pool.query(
        'SELECT id FROM gallery_images WHERE gallery_id = $1 ORDER BY sort_order ASC',
        [galleryId]
      );
      const imageIds = imgRows.map((r) => r.id);

      if (!imageIds.length) {
        logger.warn(`[face] gallery ${galleryId} has no images; skipping`);
        return;
      }

      // Keep the job row's total_images in sync with the real image count
      await pool.query(
        'UPDATE face_recognition_jobs SET total_images = $1 WHERE gallery_id = $2',
        [imageIds.length, galleryId]
      ).catch(() => {});

      logger.info(`[face] starting recognition for gallery ${galleryId} — ${imageIds.length} images`);
      try {
        const matched = await processGalleryBatch(galleryId, adminId, imageIds);
        logger.info(`[face] gallery ${galleryId} done — ${matched} faces matched`);
      } catch (err) {
        logger.error(`[face] gallery ${galleryId} failed: ${err.message}`);
        await pool.query(
          `UPDATE face_recognition_jobs SET status = 'failed', error_message = $1, finished_at = NOW() WHERE gallery_id = $2`,
          [err.message.slice(0, 500), galleryId]
        ).catch(() => {});
        throw err;
      }
    });
    logger.info('[face] in-process face recognition worker registered');
  } catch (err) {
    logger.warn('[face] face recognition worker registration failed (non-fatal):', err.message);
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
