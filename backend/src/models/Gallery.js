const pool = require('../db');
const { rowToCamel } = require('../db/utils');

function toRow(data) {
  // Map camelCase input to snake_case for insert/update
  const map = {
    adminId: 'admin_id',
    clientId: 'client_id',
    clientName: 'client_name',
    headerMessage: 'header_message',
    isActive: 'is_active',
    expiresAt: 'expires_at',
    maxSelections: 'max_selections',
    sessionType: 'session_type',
    isDelivery: 'is_delivery',
    deliveryOf: 'delivery_of',
    lastEmailSentAt: 'last_email_sent_at',
    selectionEnabled: 'selection_enabled',
    isSystem: 'is_system',
  };
  const row = {};
  for (const [k, v] of Object.entries(data)) {
    const col = map[k] || k;
    row[col] = v;
  }
  return row;
}

async function _populateClient(gallery) {
  if (!gallery || !gallery.clientId) return gallery;
  const { rows } = await pool.query(
    'SELECT id, name, email, phone FROM clients WHERE id = $1',
    [gallery.clientId]
  );
  if (rows[0]) {
    gallery.clientId = rowToCamel(rows[0]);
  }
  return gallery;
}

async function findById(id, { populate } = {}) {
  const { rows } = await pool.query('SELECT * FROM galleries WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const g = rowToCamel(rows[0]);
  if (populate) return _populateClient(g);
  return g;
}

async function findOne(filter, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.token !== undefined) { conditions.push(`token = $${i++}`); vals.push(filter.token); }
  if (filter.isActive !== undefined) { conditions.push(`is_active = $${i++}`); vals.push(filter.isActive); }
  if (filter._id || filter.id) { conditions.push(`id = $${i++}`); vals.push(filter._id || filter.id); }
  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }

  if (!conditions.length) return null;
  const { rows } = await pool.query(
    `SELECT * FROM galleries WHERE ${conditions.join(' AND ')} LIMIT 1`,
    vals
  );
  if (!rows[0]) return null;
  const g = rowToCamel(rows[0]);
  if (populate) return _populateClient(g);
  return g;
}

async function find(filter = {}, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.clientId) { conditions.push(`client_id = $${i++}`); vals.push(filter.clientId); }
  // Hidden holding galleries (direct-order uploads) never appear in lists
  if (!filter.includeSystem) { conditions.push('is_system = false'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM galleries ${where} ORDER BY created_at DESC LIMIT 500`,
    vals
  );
  const galleries = rows.map(rowToCamel);
  if (!populate) return galleries;
  // Batch-populate clients: one query for all distinct clientIds instead of
  // one per gallery.
  return _populateClientsForGalleries(galleries);
}

/**
 * Batch-populate the `clientId` field for a list of galleries.
 * Issues ONE `SELECT … WHERE id = ANY($1)` query instead of one per gallery,
 * then stitches results in JS.
 *
 * @param {object[]} galleries - array of camelCase gallery objects
 * @returns {Promise<object[]>} same array with `clientId` replaced by client object where found
 */
async function _populateClientsForGalleries(galleries) {
  const clientIds = [...new Set(
    galleries.map((g) => g.clientId).filter((id) => id != null)
  )];
  if (!clientIds.length) return galleries;

  const { rows } = await pool.query(
    'SELECT id, name, email, phone FROM clients WHERE id = ANY($1::uuid[])',
    [clientIds]
  );
  const clientMap = {};
  for (const row of rows) {
    clientMap[row.id] = rowToCamel(row);
  }

  return galleries.map((g) => {
    if (g.clientId && clientMap[g.clientId]) {
      return { ...g, clientId: clientMap[g.clientId] };
    }
    return g;
  });
}

/**
 * findEnriched — gallery list with preview images and submissions pre-attached.
 *
 * Runs exactly 4 queries regardless of how many galleries match:
 *   1. SELECT galleries
 *   2. SELECT clients (batch by distinct clientIds)
 *   3. SELECT top-5 preview images per gallery (window function)
 *   4. SELECT all submissions per gallery
 *
 * Use ONLY on the admin gallery list endpoint. Do NOT use on single-gallery
 * detail routes or public token routes — they return lean objects by design.
 *
 * @param {object} filter - same keys accepted by `find()` (adminId, clientId, includeSystem)
 * @returns {Promise<object[]>} galleries, each with:
 *   - `clientId` — populated client object (if client exists) or raw UUID string
 *   - `previewImages` — array of ≤5 image objects sorted by sort_order ASC, created_at ASC
 *       each: { _id, id, galleryId, filename, thumbnailPath, previewPath, sortOrder }
 *   - `submissions` — array of submission objects ordered by submitted_at DESC
 *       each: { _id, id, galleryId, sessionId, selectedImageIds, clientMessage,
 *               imageComments, heroImageId, submittedAt }
 */
async function findEnriched(filter = {}) {
  // --- Query 1: galleries ---
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.clientId) { conditions.push(`client_id = $${i++}`); vals.push(filter.clientId); }
  if (!filter.includeSystem) { conditions.push('is_system = false'); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: galleryRows } = await pool.query(
    `SELECT * FROM galleries ${where} ORDER BY created_at DESC LIMIT 500`,
    vals
  );
  if (!galleryRows.length) return [];

  const galleries = galleryRows.map(rowToCamel);
  const galleryIds = galleries.map((g) => g.id);

  // --- Query 2: batch-populate clients ---
  const clientIds = [...new Set(
    galleries.map((g) => g.clientId).filter((id) => id != null)
  )];
  const clientMap = {};
  if (clientIds.length) {
    const { rows: clientRows } = await pool.query(
      'SELECT id, name, email, phone FROM clients WHERE id = ANY($1::uuid[])',
      [clientIds]
    );
    for (const row of clientRows) {
      clientMap[row.id] = rowToCamel(row);
    }
  }

  // --- Query 3: top-5 preview images per gallery (single window-function query) ---
  const previewMap = {};
  {
    const { rows: imgRows } = await pool.query(
      `SELECT id, gallery_id, filename, thumbnail_path, preview_path, sort_order, created_at
       FROM (
         SELECT id, gallery_id, filename, thumbnail_path, preview_path, sort_order, created_at,
                ROW_NUMBER() OVER (PARTITION BY gallery_id ORDER BY sort_order ASC, created_at ASC) AS rn
         FROM gallery_images
         WHERE gallery_id = ANY($1::uuid[])
       ) t
       WHERE rn <= 5`,
      [galleryIds]
    );
    for (const row of imgRows) {
      const img = rowToCamel(row);
      const gid = row.gallery_id;
      if (!previewMap[gid]) previewMap[gid] = [];
      previewMap[gid].push(img);
    }
  }

  // --- Query 4: latest submission per gallery ---
  // The list/card UI only ever reads submissions[0] (latest). We cap to one row
  // per gallery and omit the image_comments JSONB (only the detail page needs it,
  // and it refetches the full submission separately) to keep the list payload bounded.
  const submissionMap = {};
  {
    const { rows: subRows } = await pool.query(
      `SELECT id, gallery_id, session_id, selected_image_ids, client_message, hero_image_id, submitted_at
       FROM (
         SELECT id, gallery_id, session_id, selected_image_ids, client_message, hero_image_id, submitted_at,
                ROW_NUMBER() OVER (PARTITION BY gallery_id ORDER BY submitted_at DESC) AS rn
         FROM gallery_submissions
         WHERE gallery_id = ANY($1::uuid[])
       ) t
       WHERE rn = 1`,
      [galleryIds]
    );
    for (const row of subRows) {
      const sub = rowToCamel(row);
      const gid = row.gallery_id;
      if (!submissionMap[gid]) submissionMap[gid] = [];
      submissionMap[gid].push(sub);
    }
  }

  // --- Stitch everything together ---
  return galleries.map((g) => ({
    ...g,
    clientId: (g.clientId && clientMap[g.clientId]) ? clientMap[g.clientId] : g.clientId,
    previewImages: previewMap[g.id] || [],
    submissions: submissionMap[g.id] || [],
  }));
}

async function create(data, client = null) {
  const row = toRow(data);
  const cols = ['name', 'admin_id'];
  const placeholders = ['$1', '$2'];
  const vals = [row.name, row.admin_id || null];
  let i = 3;

  const optionals = [
    'client_id', 'client_name', 'header_message', 'is_active',
    'expires_at', 'status', 'max_selections', 'session_type', 'is_delivery',
    'delivery_of', 'last_email_sent_at', 'videos', 'selection_enabled', 'is_system',
  ];

  for (const col of optionals) {
    if (row[col] !== undefined && row[col] !== null) {
      cols.push(col);
      if (col === 'videos') {
        placeholders.push(`$${i++}::jsonb`);
        vals.push(JSON.stringify(row[col]));
      } else {
        placeholders.push(`$${i++}`);
        vals.push(row[col]);
      }
    }
  }

  const query = client
    ? await client.query(
        `INSERT INTO galleries (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      )
    : await pool.query(
        `INSERT INTO galleries (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      );
  return rowToCamel(query.rows[0]);
}

async function findOneAndUpdate(filter, update, opts = {}) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;

  const sets = [];
  const vals = [];
  let i = 1;
  const colMap = {
    name: 'name',
    clientName: 'client_name',
    headerMessage: 'header_message',
    isActive: 'is_active',
    expiresAt: 'expires_at',
    status: 'status',
    maxSelections: 'max_selections',
    sessionType: 'session_type',
    isDelivery: 'is_delivery',
    deliveryOf: 'delivery_of',
    lastEmailSentAt: 'last_email_sent_at',
    videos: 'videos',
    selectionEnabled: 'selection_enabled',
  };

  const src = update.$set || update;
  for (const [k, v] of Object.entries(src)) {
    if (colMap[k] && v !== undefined) {
      if (colMap[k] === 'videos') {
        sets.push(`videos = $${i++}::jsonb`);
        vals.push(JSON.stringify(v));
      } else {
        sets.push(`${colMap[k]} = $${i++}`);
        vals.push(v);
      }
    }
  }

  if (!sets.length) return findOne({ _id: id, adminId });
  sets.push(`updated_at = NOW()`);

  const whereParts = [];
  if (id) { whereParts.push(`id = $${i++}`); vals.push(id); }
  if (adminId) { whereParts.push(`admin_id = $${i++}`); vals.push(adminId); }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `UPDATE galleries SET ${sets.join(', ')} ${where} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function save(gallery, client = null) {
  // Persist a gallery object (used by route code that mutates fields then calls save())
  const colMap = {
    name: 'name',
    clientName: 'client_name',
    headerMessage: 'header_message',
    isActive: 'is_active',
    expiresAt: 'expires_at',
    status: 'status',
    maxSelections: 'max_selections',
    sessionType: 'session_type',
    isDelivery: 'is_delivery',
    deliveryOf: 'delivery_of',
    lastEmailSentAt: 'last_email_sent_at',
    videos: 'videos',
    selectionEnabled: 'selection_enabled',
  };

  const sets = [];
  const vals = [];
  let i = 1;

  for (const [k, col] of Object.entries(colMap)) {
    if (gallery[k] !== undefined) {
      if (col === 'videos') {
        sets.push(`videos = $${i++}::jsonb`);
        vals.push(JSON.stringify(gallery[k]));
      } else {
        sets.push(`${col} = $${i++}`);
        vals.push(gallery[k] === undefined ? null : gallery[k]);
      }
    }
  }
  sets.push(`updated_at = NOW()`);
  vals.push(gallery.id);

  const q = `UPDATE galleries SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`;
  const result = client ? await client.query(q, vals) : await pool.query(q, vals);
  const updated = rowToCamel(result.rows[0]);
  // Mutate in place so callers see updated values
  Object.assign(gallery, updated);
  return gallery;
}

/**
 * Returns the admin's hidden holding gallery for direct-order uploads,
 * creating it on first use. Never listed (is_system) and never publicly
 * reachable (is_active = false).
 */
async function ensureSystemGallery(adminId) {
  const { rows } = await pool.query(
    'SELECT * FROM galleries WHERE admin_id = $1 AND is_system = true LIMIT 1',
    [adminId]
  );
  if (rows[0]) return rowToCamel(rows[0]);
  return create({
    name: 'הזמנות ישירות',
    adminId,
    isSystem: true,
    isActive: false,
    status: 'draft',
  });
}

async function findOneAndDelete(filter) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;
  const { rows } = await pool.query(
    'DELETE FROM galleries WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByIdAndUpdate(id, update, opts = {}) {
  return findOneAndUpdate({ _id: id }, update, opts);
}

module.exports = {
  findById,
  findOne,
  find,
  findEnriched,
  create,
  save,
  findOneAndUpdate,
  findOneAndDelete,
  findByIdAndUpdate,
  ensureSystemGallery,
};
