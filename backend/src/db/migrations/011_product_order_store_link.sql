ALTER TABLE product_orders
  ADD COLUMN IF NOT EXISTS store_order_id UUID REFERENCES store_orders(id) ON DELETE SET NULL;
