const pool = require('../db');
const { rowToCamel } = require('../db/utils');

/**
 * Idempotently get-or-create a document row for a (source_kind, source_id, doc_type).
 * Returns { doc, created }. Re-runs (webhook retries) return the existing row.
 */
async function getOrCreate(sourceKind, sourceId, docType, data) {
  const { recipientKind, recipientId, recipientName, recipientEmail, amount, vatAmount, currency } = data;
  const { rows } = await pool.query(
    `INSERT INTO issued_documents
       (doc_type, recipient_kind, recipient_id, recipient_name, recipient_email,
        amount, vat_amount, currency, source_kind, source_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
     ON CONFLICT (source_kind, source_id, doc_type) DO NOTHING
     RETURNING *`,
    [docType, recipientKind, recipientId || null, recipientName || null, recipientEmail || null,
     amount || 0, vatAmount || 0, currency || 'ILS', sourceKind, sourceId || null]
  );
  if (rows[0]) return { doc: rowToCamel(rows[0]), created: true };

  const existing = await pool.query(
    'SELECT * FROM issued_documents WHERE source_kind = $1 AND source_id = $2 AND doc_type = $3',
    [sourceKind, sourceId || null, docType]
  );
  return { doc: existing.rows[0] ? rowToCamel(existing.rows[0]) : null, created: false };
}

async function markIssued(id, { payplusDocumentUid, documentNumber, pdfUrl }) {
  const { rows } = await pool.query(
    `UPDATE issued_documents
        SET status = 'issued', issued_at = NOW(),
            payplus_document_uid = $2, document_number = $3, pdf_url = $4, error = NULL
      WHERE id = $1 RETURNING *`,
    [id, payplusDocumentUid || null, documentNumber || null, pdfUrl || null]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function markFailed(id, error) {
  const { rows } = await pool.query(
    `UPDATE issued_documents SET status = 'failed', error = $2 WHERE id = $1 RETURNING *`,
    [id, error ? String(error).slice(0, 500) : null]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM issued_documents WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByRecipient(recipientKind, recipientId) {
  const { rows } = await pool.query(
    `SELECT * FROM issued_documents
      WHERE recipient_kind = $1 AND recipient_id = $2
        AND doc_type <> 'order_confirmation'
      ORDER BY created_at DESC`,
    [recipientKind, recipientId]
  );
  return rows.map(rowToCamel);
}

async function findBySource(sourceKind, sourceId, docType = 'receipt') {
  const { rows } = await pool.query(
    'SELECT * FROM issued_documents WHERE source_kind = $1 AND source_id = $2 AND doc_type = $3',
    [sourceKind, sourceId, docType]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findAll({ status } = {}) {
  const cond = status ? 'WHERE status = $1' : '';
  const { rows } = await pool.query(
    `SELECT * FROM issued_documents ${cond} ORDER BY created_at DESC LIMIT 500`,
    status ? [status] : []
  );
  return rows.map(rowToCamel);
}

async function findPending() {
  // Only receipts/invoices need real issuing — order confirmations are emails only
  const { rows } = await pool.query(
    `SELECT * FROM issued_documents
      WHERE status = 'pending' AND doc_type <> 'order_confirmation'
      ORDER BY created_at ASC`
  );
  return rows.map(rowToCamel);
}

module.exports = {
  getOrCreate, markIssued, markFailed, findById,
  findByRecipient, findBySource, findAll, findPending,
};
