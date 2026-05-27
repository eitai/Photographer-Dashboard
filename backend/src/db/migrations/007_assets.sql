-- Migration: assets table for the direct-to-Wasabi compression pipeline.
--
-- The legacy gallery_images / galleries.videos paths stay untouched. This
-- table tracks the new browser-multipart uploads (POST /api/uploads/init →
-- /complete) plus the JXL sidecar pipeline. Owners are admins; gallery_id
-- is optional so an asset can exist before being attached to a gallery.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  original_key TEXT NOT NULL,
  original_sha256 TEXT NOT NULL,
  original_bytes BIGINT NOT NULL,
  format TEXT NOT NULL DEFAULT 'original'
    CHECK (format IN ('original','jxl','processing')),
  jxl_key TEXT,
  jxl_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading','uploaded','compressed','failed')),
  upload_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slice 3B columns (JXL sidecar + verify + cleanup metadata).
ALTER TABLE assets ADD COLUMN IF NOT EXISTS jxl_sha256 TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS jxl_upload_id TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS pending_deletion_key TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Expand the status CHECK to allow the verifying / verify_failed states.
-- Existing values ('uploading','uploaded','compressed','failed') stay valid,
-- so any rows already present are unaffected.
ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_status_check;
ALTER TABLE assets ADD CONSTRAINT assets_status_check
  CHECK (status IN ('uploading','uploaded','verifying','compressed','failed','verify_failed'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assets_owner_status ON assets(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_assets_gallery ON assets(gallery_id);
CREATE INDEX IF NOT EXISTS idx_assets_original_key ON assets(original_key);

-- Partial indexes the Slice-4 sweeper hits on every tick. Without these,
-- both queries are seq-scans on the assets table at scale.
--   * Pending-deletion due:  pending_deletion_key IS NOT NULL AND deletion_scheduled_at < NOW()
--   * Stuck verifying:       status='verifying' AND updated_at < NOW() - INTERVAL '30 minutes'
CREATE INDEX IF NOT EXISTS idx_assets_pending_deletion
  ON assets(deletion_scheduled_at)
  WHERE pending_deletion_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_verifying_stale
  ON assets(updated_at)
  WHERE status = 'verifying';
