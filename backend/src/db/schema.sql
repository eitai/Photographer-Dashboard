CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','superadmin')),
  username TEXT UNIQUE,
  studio_name TEXT,
  push_token TEXT,
  storage_quota_bytes BIGINT NOT NULL DEFAULT 10737418240,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  session_type TEXT CHECK (session_type IN ('family','maternity','newborn','branding','landscape')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'gallery_sent' CHECK (status IN ('gallery_sent','viewed','selection_submitted','in_editing','delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  client_name TEXT,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  header_message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'gallery_sent' CHECK (status IN ('gallery_sent','viewed','selection_submitted','in_editing','delivered')),
  max_selections INTEGER NOT NULL DEFAULT 10,
  is_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_of UUID REFERENCES galleries(id) ON DELETE SET NULL,
  last_email_sent_at TIMESTAMPTZ,
  videos JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT,
  path TEXT NOT NULL,
  thumbnail_path TEXT,
  before_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gallery_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  selected_image_ids UUID[] NOT NULL DEFAULT '{}',
  client_message TEXT,
  image_comments JSONB NOT NULL DEFAULT '{}',
  hero_image_id UUID REFERENCES gallery_images(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE,
  content TEXT,
  featured_image_path TEXT,
  seo_title TEXT,
  seo_description TEXT,
  category TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  session_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('album','print')),
  max_photos INTEGER NOT NULL DEFAULT 1,
  allowed_gallery_ids UUID[] NOT NULL DEFAULT '{}',
  selected_photo_ids JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID UNIQUE REFERENCES admins(id) ON DELETE CASCADE,
  featured_image_ids UUID[] NOT NULL DEFAULT '{}',
  bio TEXT NOT NULL DEFAULT '',
  hero_image_path TEXT NOT NULL DEFAULT '',
  profile_image_path TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  instagram_handle TEXT NOT NULL DEFAULT '',
  facebook_url TEXT NOT NULL DEFAULT '',
  hero_subtitle TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'bw',
  hero_overlay_opacity TEXT NOT NULL DEFAULT 'medium',
  hero_cta_primary_label TEXT NOT NULL DEFAULT '',
  hero_cta_secondary_label TEXT NOT NULL DEFAULT '',
  about_section_title TEXT NOT NULL DEFAULT '',
  tiktok_url TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL DEFAULT '',
  video_section_heading TEXT NOT NULL DEFAULT '',
  video_section_subheading TEXT NOT NULL DEFAULT '',
  video_section_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cta_banner_heading TEXT NOT NULL DEFAULT '',
  cta_banner_subtext TEXT NOT NULL DEFAULT '',
  cta_banner_button_label TEXT NOT NULL DEFAULT '',
  cta_banner_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  services_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  testimonials_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  packages_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  packages_disclaimer TEXT NOT NULL DEFAULT '',
  services JSONB NOT NULL DEFAULT '[]',
  testimonials JSONB NOT NULL DEFAULT '[]',
  packages JSONB NOT NULL DEFAULT '[]',
  instagram_feed_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  instagram_feed_images TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS admin_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('album','print')),
  max_photos INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_admin_id ON clients(admin_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_galleries_admin_id ON galleries(admin_id);
CREATE INDEX IF NOT EXISTS idx_galleries_client_id ON galleries(client_id);
CREATE INDEX IF NOT EXISTS idx_galleries_status ON galleries(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_gallery_images_gallery_id ON gallery_images(gallery_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_gallery_submissions_gallery_id ON gallery_submissions(gallery_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_submissions_gallery_session ON gallery_submissions(gallery_id, session_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_admin ON blog_posts(admin_id, published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(admin_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_admin ON contact_submissions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_orders_admin_client ON product_orders(admin_id, client_id);
CREATE INDEX IF NOT EXISTS idx_admin_products_admin ON admin_products(admin_id);
