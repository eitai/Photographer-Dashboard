-- 013: Product configuration + Flow 3 (photographer direct orders)

-- Product configuration
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS min_photos      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_photos      INT NOT NULL DEFAULT 0,   -- 0 = unlimited
  ADD COLUMN IF NOT EXISTS production_days INT,
  ADD COLUMN IF NOT EXISTS variations      JSONB NOT NULL DEFAULT '[]';
  -- variations: [ { "name": "גודל", "options": ["20x30", "30x40"] } ]

-- Photographer (studio) address — used as a shipping source for direct orders
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS address_street    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_apartment VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_city      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_zip       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_country   VARCHAR(100) DEFAULT 'ישראל';

-- Hidden per-admin holding gallery for direct-order ad-hoc uploads
ALTER TABLE galleries
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- Direct orders have no client / no gallery
ALTER TABLE store_orders ALTER COLUMN client_id  DROP NOT NULL;
ALTER TABLE store_orders ALTER COLUMN gallery_id DROP NOT NULL;
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS is_direct BOOLEAN NOT NULL DEFAULT false;
