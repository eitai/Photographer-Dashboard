-- 014: Supplier billing & settlement system

-- Per-photographer permissions + card-on-file + delinquency
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS can_order_supplier BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS clients_can_order  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payplus_card_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS card_last4         VARCHAR(4),
  ADD COLUMN IF NOT EXISTS card_brand         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS billing_blocked    BOOLEAN NOT NULL DEFAULT false;

-- Monthly photographer statements (cost-price charges for Flow 1/3 orders)
CREATE TABLE IF NOT EXISTS photographer_invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  total_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency      VARCHAR(10) NOT NULL DEFAULT 'ILS',
  status        VARCHAR(20) NOT NULL DEFAULT 'pending_payment', -- pending_payment|paid|failed|cancelled
  attempts      INT NOT NULL DEFAULT 0,
  due_at        TIMESTAMPTZ,
  paid_at       TIMESTAMPTZ,
  payplus_transaction_uid VARCHAR(255),
  payplus_link  TEXT,            -- fallback hosted link if token charge unavailable
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(admin_id, period_start)
);

-- Monthly supplier payouts (platform → supplier bulk settlement)
CREATE TABLE IF NOT EXISTS supplier_settlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  total_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  order_count   INT NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'open', -- open|settled
  settled_at    TIMESTAMPTZ,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(supplier_id, period_start)
);

-- Link orders to their statements / settlements (NULL = not yet billed / settled)
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS invoice_id    UUID REFERENCES photographer_invoices(id),
  ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES supplier_settlements(id);

CREATE INDEX IF NOT EXISTS idx_store_orders_invoice    ON store_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_settlement ON store_orders(settlement_id);
