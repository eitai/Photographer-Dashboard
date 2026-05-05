const pool = require('../db');
const { rowToCamel } = require('../db/utils');

const DEFAULT_PRODUCTS = [
  // Albums
  { name: 'אלבום 8x8', type: 'album', maxPhotos: 40 },
  { name: 'אלבום 10x10', type: 'album', maxPhotos: 60 },
  { name: 'אלבום 12x12', type: 'album', maxPhotos: 90 },
  { name: 'אלבום חתונה שכבתי', type: 'album', maxPhotos: 100 },
  { name: 'ספר שולחן קפה', type: 'album', maxPhotos: 150 },
  { name: 'אלבום הורים', type: 'album', maxPhotos: 25 },
  { name: 'אלבום אירוסין', type: 'album', maxPhotos: 35 },
  { name: 'אלבום ניובורן', type: 'album', maxPhotos: 20 },
  { name: 'אלבום מיילסטון (תינוק)', type: 'album', maxPhotos: 12 },
  { name: 'אלבום מגזין', type: 'album', maxPhotos: 80 },
  { name: 'אלבום משפחה', type: 'album', maxPhotos: 50 },
  // Prints
  { name: 'הדפסת קנבס', type: 'print', maxPhotos: 1 },
  { name: 'הדפסת מתכת', type: 'print', maxPhotos: 1 },
  { name: 'הדפסת אקריליק', type: 'print', maxPhotos: 1 },
  { name: 'הדפסת פיין ארט', type: 'print', maxPhotos: 1 },
  { name: 'הדפסת עץ', type: 'print', maxPhotos: 1 },
  { name: 'הדפסת זכוכית', type: 'print', maxPhotos: 1 },
  { name: 'הדפסה 8x10', type: 'print', maxPhotos: 1 },
  { name: 'הדפסה 5x7', type: 'print', maxPhotos: 1 },
  { name: 'הדפסה 4x6', type: 'print', maxPhotos: 1 },
  { name: 'קולאז\' תמונות', type: 'print', maxPhotos: 9 },
  { name: 'לוח שנה', type: 'print', maxPhotos: 12 },
  { name: 'כרטיסי הודעת לידה', type: 'print', maxPhotos: 2 },
  { name: 'גיליון תמונות (ראשי תיבות / הדשוט)', type: 'print', maxPhotos: 8 },
  { name: 'כרטיסי חג', type: 'print', maxPhotos: 3 },
];

async function find(adminId) {
  const { rows } = await pool.query(
    'SELECT * FROM admin_products WHERE admin_id = $1 ORDER BY created_at ASC',
    [adminId]
  );
  return rows.map(rowToCamel);
}

async function create(data) {
  const { rows } = await pool.query(
    `INSERT INTO admin_products (admin_id, name, type, max_photos)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.adminId, data.name, data.type, data.maxPhotos]
  );
  return rowToCamel(rows[0]);
}

async function findByIdAndDelete(id, adminId) {
  const { rows } = await pool.query(
    'DELETE FROM admin_products WHERE id = $1 AND admin_id = $2 RETURNING *',
    [id, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function seedDefaults(adminId) {
  for (const p of DEFAULT_PRODUCTS) {
    await create({ adminId, ...p });
  }
}

module.exports = { find, create, findByIdAndDelete, seedDefaults };
