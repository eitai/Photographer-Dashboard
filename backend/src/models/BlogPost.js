const pool = require('../db');
const slugify = require('slugify');
const { rowToCamel } = require('../db/utils');

function generateSlug(title) {
  return slugify(title, { lower: true, strict: true }) + '-' + Date.now();
}

async function findById(id) {
  const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [id]);
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOne(filter) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter._id || filter.id) { conditions.push(`id = $${i++}`); vals.push(filter._id || filter.id); }
  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.slug !== undefined) { conditions.push(`slug = $${i++}`); vals.push(filter.slug); }
  if (filter.published !== undefined) { conditions.push(`published = $${i++}`); vals.push(filter.published); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM blog_posts ${where} LIMIT 1`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function find(filter = {}, { selectContent = true } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }
  if (filter.published !== undefined) { conditions.push(`published = $${i++}`); vals.push(filter.published); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const cols = selectContent ? '*' : 'id, admin_id, title, slug, featured_image_path, seo_title, seo_description, category, published, published_at, created_at, updated_at';
  const { rows } = await pool.query(
    `SELECT ${cols} FROM blog_posts ${where} ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT 200`,
    vals
  );
  return rows.map(rowToCamel);
}

async function create(data) {
  const slug = generateSlug(data.title);
  const publishedAt = (data.published && !data.publishedAt) ? new Date() : (data.publishedAt || null);

  const { rows } = await pool.query(
    `INSERT INTO blog_posts
       (admin_id, title, slug, content, featured_image_path, seo_title, seo_description,
        category, published, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      data.adminId,
      data.title,
      slug,
      data.content || null,
      data.featuredImagePath || null,
      data.seoTitle || null,
      data.seoDescription || null,
      data.category || null,
      data.published === true || data.published === 'true' ? true : false,
      publishedAt,
    ]
  );
  return rowToCamel(rows[0]);
}

async function findOneAndUpdate(filter, update, opts = {}) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;

  // Re-fetch existing row first to handle slug regeneration
  const existing = await findOne({ _id: id, adminId });
  if (!existing) return null;

  const src = update.$set || update;
  const sets = [];
  const vals = [];
  let i = 1;

  const colMap = {
    title: 'title',
    slug: 'slug',
    content: 'content',
    featuredImagePath: 'featured_image_path',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
    category: 'category',
    published: 'published',
    publishedAt: 'published_at',
  };

  // Regenerate slug if title changed
  if (src.title !== undefined && src.title !== existing.title) {
    sets.push(`slug = $${i++}`);
    vals.push(generateSlug(src.title));
  }

  // Auto-set publishedAt when publishing for the first time
  let publishedAt = src.publishedAt;
  if ((src.published === true || src.published === 'true') && !existing.publishedAt && !publishedAt) {
    publishedAt = new Date();
  }

  for (const [k, v] of Object.entries(src)) {
    if (colMap[k] && colMap[k] !== 'slug') { // slug handled above
      sets.push(`${colMap[k]} = $${i++}`);
      if (k === 'published') {
        vals.push(v === true || v === 'true' ? true : false);
      } else if (k === 'publishedAt') {
        vals.push(publishedAt || null);
      } else {
        vals.push(v === undefined ? null : v);
      }
    }
  }

  if (!sets.length) return existing;
  sets.push(`updated_at = NOW()`);

  const whereParts = [`id = $${i++}`];
  vals.push(id);
  if (adminId) { whereParts.push(`admin_id = $${i++}`); vals.push(adminId); }

  const { rows } = await pool.query(
    `UPDATE blog_posts SET ${sets.join(', ')} WHERE ${whereParts.join(' AND ')} RETURNING *`,
    vals
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOneAndDelete(filter) {
  const id = filter._id || filter.id;
  const adminId = filter.adminId || filter.admin_id;
  const { rows } = await pool.query(
    'DELETE FROM blog_posts WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = {
  findById,
  findOne,
  find,
  create,
  findOneAndUpdate,
  findOneAndDelete,
};
