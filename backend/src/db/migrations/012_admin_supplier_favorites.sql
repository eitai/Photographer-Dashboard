-- Photographer's favorite supplier products — replaces the legacy per-admin
-- product catalog (admin_products) as the source for order creation.
CREATE TABLE IF NOT EXISTS admin_supplier_favorites (
  admin_id   UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES supplier_products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (admin_id, product_id)
);
