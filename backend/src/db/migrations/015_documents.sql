-- 015: Issued accounting documents (receipts / tax-invoices / order confirmations)

CREATE TABLE IF NOT EXISTS issued_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type        VARCHAR(30) NOT NULL,          -- receipt | tax_invoice_receipt | order_confirmation
  recipient_kind  VARCHAR(20) NOT NULL,          -- client | admin
  recipient_id    UUID,                          -- clients.id or admins.id (nullable for ad-hoc)
  recipient_name  VARCHAR(255),
  recipient_email VARCHAR(255),
  amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency        VARCHAR(10) NOT NULL DEFAULT 'ILS',
  source_kind     VARCHAR(30) NOT NULL,          -- store_order | photographer_invoice | subscription | order_confirmation
  source_id       VARCHAR(255),                  -- our UUID (orders/invoices) OR a PayPlus transaction string (subscriptions)
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | issued | failed | skipped
  payplus_document_uid VARCHAR(255),
  document_number VARCHAR(64),
  pdf_url         TEXT,
  error           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  issued_at       TIMESTAMPTZ,
  UNIQUE(source_kind, source_id, doc_type)        -- idempotent: one doc per source + type
);

-- For installs created before source_id was widened from UUID to VARCHAR.
ALTER TABLE issued_documents ALTER COLUMN source_id TYPE VARCHAR(255) USING source_id::text;

CREATE INDEX IF NOT EXISTS idx_issued_documents_recipient ON issued_documents(recipient_kind, recipient_id);
CREATE INDEX IF NOT EXISTS idx_issued_documents_status ON issued_documents(status);
