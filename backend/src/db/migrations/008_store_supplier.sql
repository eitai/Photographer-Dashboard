-- Client address fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS address_street    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_city      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_zip       VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_country   VARCHAR(100) DEFAULT 'ישראל',
  ADD COLUMN IF NOT EXISTS address_apartment VARCHAR(50);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(255) NOT NULL,
  email                    VARCHAR(255) UNIQUE NOT NULL,
  password                 VARCHAR(255) NOT NULL,
  phone                    VARCHAR(50),
  contact_person           VARCHAR(255),
  logo_path                TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  is_exclusive             BOOLEAN NOT NULL DEFAULT false,
  api_webhook_url          TEXT,
  created_by_superadmin_id UUID REFERENCES admins(id),
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Supplier products
CREATE TABLE IF NOT EXISTS supplier_products (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id        UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name               VARCHAR(255) NOT NULL,
  type               VARCHAR(50) NOT NULL CHECK (type IN ('print','canvas','album','digital','other')),
  description        TEXT,
  sku                VARCHAR(100),
  specs              JSONB DEFAULT '{}',
  cost_price         DECIMAL(10,2) NOT NULL,
  client_price       DECIMAL(10,2),
  image_preview_path TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Store orders
CREATE TABLE IF NOT EXISTS store_orders (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id                 UUID NOT NULL REFERENCES admins(id),
  client_id                UUID NOT NULL REFERENCES clients(id),
  gallery_id               UUID NOT NULL REFERENCES galleries(id),
  supplier_id              UUID REFERENCES suppliers(id),
  flow                     VARCHAR(20) NOT NULL CHECK (flow IN ('photographer','client')),
  status                   VARCHAR(30) NOT NULL DEFAULT 'draft',
  payment_status           VARCHAR(20) NOT NULL DEFAULT 'not_required',
  payplus_payment_page_uid VARCHAR(255),
  payplus_transaction_uid  VARCHAR(255),
  total_amount             DECIMAL(10,2),
  currency                 VARCHAR(10) DEFAULT 'ILS',
  selection_token          VARCHAR(255) UNIQUE,
  client_note              TEXT,
  photographer_note        TEXT,
  supplier_note            TEXT,
  tracking_number          VARCHAR(255),
  tracking_carrier         VARCHAR(100),
  shipping_address         JSONB,
  sent_to_supplier_at      TIMESTAMPTZ,
  shipped_at               TIMESTAMPTZ,
  delivered_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Store order items
CREATE TABLE IF NOT EXISTS store_order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES supplier_products(id),
  quantity           INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost_price    DECIMAL(10,2) NOT NULL,
  unit_client_price  DECIMAL(10,2),
  selected_image_ids UUID[] NOT NULL DEFAULT '{}',
  image_notes        JSONB DEFAULT '{}',
  product_options    JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS store_orders_admin_id_idx    ON store_orders(admin_id);
CREATE INDEX IF NOT EXISTS store_orders_client_id_idx   ON store_orders(client_id);
CREATE INDEX IF NOT EXISTS store_orders_status_idx      ON store_orders(status);
CREATE INDEX IF NOT EXISTS store_orders_token_idx       ON store_orders(selection_token);
CREATE INDEX IF NOT EXISTS store_order_items_order_idx  ON store_order_items(order_id);
CREATE INDEX IF NOT EXISTS supplier_products_supp_idx   ON supplier_products(supplier_id);
