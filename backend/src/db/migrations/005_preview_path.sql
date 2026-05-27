-- Add preview_path for WebP-compressed previews (max 2000px, 78% quality)
ALTER TABLE gallery_images
  ADD COLUMN IF NOT EXISTS preview_path VARCHAR;

-- Allow path to be NULL so auto-delete can tombstone cleaned-up originals
-- without deleting the image row (thumbnail and preview remain accessible)
ALTER TABLE gallery_images
  ALTER COLUMN path DROP NOT NULL;
