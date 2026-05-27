-- Migration 006: Replace Stripe columns with PayPlus equivalents
-- Run after 005_plans_subscriptions.sql

-- Plans: remove stripe price IDs (single PayPlus payment page handles all plans dynamically)
ALTER TABLE plans
  DROP COLUMN IF EXISTS stripe_price_id_monthly,
  DROP COLUMN IF EXISTS stripe_price_id_annual;

-- Subscriptions: replace stripe IDs with payplus IDs
ALTER TABLE subscriptions
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payplus_customer_uid  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payplus_recurring_uid VARCHAR(255);

-- Admins: replace stripe_customer_id with payplus_customer_uid
ALTER TABLE admins
  DROP COLUMN IF EXISTS stripe_customer_id;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS payplus_customer_uid VARCHAR(255);
