-- Migration: add stats, promises, faq and final-cta fields to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_tagline TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stats_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '[]';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promises_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS promises JSONB NOT NULL DEFAULT '[]';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS faq_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS faq_items JSONB NOT NULL DEFAULT '[]';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS final_cta_heading TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS final_cta_subtext TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS final_cta_button_label TEXT NOT NULL DEFAULT '';
