const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function _populateFeaturedImages(settings) {
  if (!settings || !settings.featuredImageIds || !settings.featuredImageIds.length) return settings;
  const { rows } = await pool.query(
    'SELECT * FROM gallery_images WHERE id = ANY($1::uuid[])',
    [settings.featuredImageIds]
  );
  settings.featuredImageIds = rows.map(rowToCamel);
  return settings;
}

async function findOne(filter, { populate } = {}) {
  const conditions = [];
  const vals = [];
  let i = 1;

  if (filter.adminId) { conditions.push(`admin_id = $${i++}`); vals.push(filter.adminId); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM site_settings ${where} LIMIT 1`,
    vals
  );
  if (!rows[0]) return null;
  const s = rowToCamel(rows[0]);
  if (populate) return _populateFeaturedImages(s);
  return s;
}

async function upsert(adminId, data, { populate } = {}) {
  // Scalar columns: camelCase key → snake_case DB column
  const colMap = {
    bio: 'bio',
    heroImagePath: 'hero_image_path',
    profileImagePath: 'profile_image_path',
    phone: 'phone',
    instagramHandle: 'instagram_handle',
    facebookUrl: 'facebook_url',
    heroSubtitle: 'hero_subtitle',
    contactEmail: 'contact_email',
    theme: 'theme',
    featuredImageIds: 'featured_image_ids',
    heroOverlayOpacity: 'hero_overlay_opacity',
    heroCtaPrimaryLabel: 'hero_cta_primary_label',
    heroCtaSecondaryLabel: 'hero_cta_secondary_label',
    aboutSectionTitle: 'about_section_title',
    tiktokUrl: 'tiktok_url',
    videoUrl: 'video_url',
    videoSectionHeading: 'video_section_heading',
    videoSectionSubheading: 'video_section_subheading',
    videoSectionEnabled: 'video_section_enabled',
    ctaBannerHeading: 'cta_banner_heading',
    ctaBannerSubtext: 'cta_banner_subtext',
    ctaBannerButtonLabel: 'cta_banner_button_label',
    ctaBannerEnabled: 'cta_banner_enabled',
    servicesEnabled: 'services_enabled',
    testimonialsEnabled: 'testimonials_enabled',
    packagesEnabled: 'packages_enabled',
    packagesDisclaimer: 'packages_disclaimer',
    instagramFeedEnabled: 'instagram_feed_enabled',
    instagramFeedImages: 'instagram_feed_images',
  };

  // JSONB columns: camelCase key → snake_case DB column
  const jsonbColMap = {
    services: 'services',
    testimonials: 'testimonials',
    packages: 'packages',
  };

  const sets = [];
  const vals = [adminId]; // $1 is admin_id for ON CONFLICT
  let i = 2;
  const insertCols = ['admin_id'];
  const insertPlaceholders = ['$1'];

  for (const [k, col] of Object.entries(colMap)) {
    if (data[k] !== undefined) {
      insertCols.push(col);
      if (col === 'featured_image_ids') {
        insertPlaceholders.push(`$${i}::uuid[]`);
        sets.push(`featured_image_ids = $${i++}::uuid[]`);
      } else if (col === 'instagram_feed_images') {
        insertPlaceholders.push(`$${i}::text[]`);
        sets.push(`instagram_feed_images = $${i++}::text[]`);
      } else {
        insertPlaceholders.push(`$${i}`);
        sets.push(`${col} = $${i++}`);
      }
      vals.push(data[k]);
    }
  }

  for (const [k, col] of Object.entries(jsonbColMap)) {
    if (data[k] !== undefined) {
      insertCols.push(col);
      insertPlaceholders.push(`$${i}::jsonb`);
      sets.push(`${col} = $${i++}::jsonb`);
      vals.push(JSON.stringify(data[k]));
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO site_settings (${insertCols.join(', ')})
     VALUES (${insertPlaceholders.join(', ')})
     ON CONFLICT (admin_id) DO UPDATE SET ${sets.join(', ')}
     RETURNING *`,
    vals
  );
  const s = rowToCamel(rows[0]);
  if (populate) return _populateFeaturedImages(s);
  return s;
}

// Convenience wrapper used by routes doing findOneAndUpdate with $set
async function findOneAndUpdate(filter, update, opts = {}) {
  const adminId = filter.adminId || filter.admin_id;
  const src = update.$set || update;
  // Remove the adminId field if callers pass it inside the update body
  const { adminId: _ignore, ...data } = src;
  return upsert(adminId, data, { populate: !!opts.populate });
}

module.exports = {
  findOne,
  upsert,
  findOneAndUpdate,
};
