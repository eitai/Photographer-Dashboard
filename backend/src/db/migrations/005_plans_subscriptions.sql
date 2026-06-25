-- Plans & Subscriptions
-- Phase 1: core tables + seed data

-- 1. Add stripe_customer_id to admins
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

-- 2. Plans table
CREATE TABLE IF NOT EXISTS plans (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                     VARCHAR(50) UNIQUE NOT NULL,
  name                     VARCHAR(100) NOT NULL,
  description              TEXT,
  storage_bytes            BIGINT,                        -- NULL = unlimited; ignored for slug='custom'
  price_monthly_ils        DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_annual_ils         DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_per_gb_ils         DECIMAL(10,4),                 -- custom plan only: price per GB/month
  custom_min_gb            INT DEFAULT 1,                 -- custom plan only
  custom_max_gb            INT,                           -- custom plan only; NULL = no limit
  stripe_price_id_monthly  VARCHAR(255),
  stripe_price_id_annual   VARCHAR(255),
  is_active                BOOLEAN NOT NULL DEFAULT true,
  sort_order               INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Seed plans (storage and pricing intentionally left at 0 — superadmin sets them)
INSERT INTO plans (slug, name, sort_order) VALUES
  ('free',      'Free',      0),
  ('basic',     'Basic',     1),
  ('pro',       'Pro',       2),
  ('ultra',     'Ultra',     3),
  ('unlimited', 'Unlimited', 4),
  ('custom',    'Custom',    5)
ON CONFLICT (slug) DO NOTHING;

-- 4. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id               UUID UNIQUE NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  plan_id                UUID NOT NULL REFERENCES plans(id),
  status                 VARCHAR(30) NOT NULL DEFAULT 'active',
  billing_interval       VARCHAR(10),                    -- 'monthly' | 'annual' | NULL (free/custom)
  custom_storage_gb      INT,                            -- set when plan.slug = 'custom'
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id     VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  trial_ends_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Billing events log
CREATE TABLE IF NOT EXISTS billing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id          UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  type              VARCHAR(50) NOT NULL,
  amount            DECIMAL(10,2),
  currency          VARCHAR(10) DEFAULT 'ILS',
  stripe_invoice_id VARCHAR(255),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Indexes
-- subscriptions.admin_id is already covered by the UNIQUE constraint above.
-- billing_events.admin_id needs an explicit index for the Phase 2 billing history queries.
CREATE INDEX IF NOT EXISTS billing_events_admin_id_idx ON billing_events(admin_id);

-- 7. Back-fill: assign free plan to all existing admins without a subscription
INSERT INTO subscriptions (admin_id, plan_id, status)
SELECT a.id, p.id, 'active'
FROM admins a
CROSS JOIN plans p
WHERE p.slug = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM subscriptions s WHERE s.admin_id = a.id
  )
ON CONFLICT (admin_id) DO NOTHING;
