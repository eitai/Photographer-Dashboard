-- Migration: add landing page section columns to site_settings
-- Safe to run on existing databases — all columns use IF NOT EXISTS

-- Scalar: hero overlay and CTA labels
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_overlay_opacity TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_cta_primary_label TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_cta_secondary_label TEXT NOT NULL DEFAULT '';

-- Scalar: about section
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS about_section_title TEXT NOT NULL DEFAULT '';

-- Scalar: social / video
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS tiktok_url TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS video_section_heading TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS video_section_subheading TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS video_section_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Scalar: CTA banner
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cta_banner_heading TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cta_banner_subtext TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cta_banner_button_label TEXT NOT NULL DEFAULT '';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS cta_banner_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Scalar: section toggles and disclaimer
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS services_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS testimonials_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS packages_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS packages_disclaimer TEXT NOT NULL DEFAULT '';

-- JSONB: section content arrays
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS services JSONB NOT NULL DEFAULT '[]';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS testimonials JSONB NOT NULL DEFAULT '[]';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS packages JSONB NOT NULL DEFAULT '[]';
