const express = require('express');
const AdminProduct = require('../models/AdminProduct');
const { protect } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { UUID_RE } = require('../utils/uuid');
const pool = require('../db');

const router = express.Router();
router.use(protect);

// GET /api/admin-products — list current admin's product catalog
// Auto-seeds defaults the first time an admin has no products
router.get('/', asyncHandler(async (req, res) => {
  let products = await AdminProduct.find(req.admin.id);
  if (products.length === 0) {
    await AdminProduct.seedDefaults(req.admin.id);
    products = await AdminProduct.find(req.admin.id);
  }
  res.json(products);
}));

// POST /api/admin-products — add a product to the catalog
router.post('/', asyncHandler(async (req, res) => {
  const { name, type, maxPhotos } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
  if (!['album', 'print'].includes(type)) return res.status(400).json({ message: 'Type must be album or print' });
  const maxP = Number(maxPhotos);
  if (!maxP || maxP < 1 || maxP > 500) return res.status(400).json({ message: 'maxPhotos must be between 1 and 500' });

  const product = await AdminProduct.create({
    adminId: req.admin.id,
    name: name.trim(),
    type,
    maxPhotos: maxP,
  });
  res.status(201).json(product);
}));

// GET /api/admin-products/supplier-products — list all active products from active suppliers
// Used when a photographer is creating an order and needs to pick a supplier product.
// Each product carries isFavorite for the requesting admin; favorites sort first.
router.get('/supplier-products', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id  AS supplier_id,
            s.name AS supplier_name,
            sp.id,
            sp.name,
            sp.type,
            sp.description,
            sp.sku,
            sp.specs,
            sp.cost_price,
            sp.client_price,
            sp.image_preview_path,
            sp.sort_order,
            sp.min_photos,
            sp.max_photos,
            sp.production_days,
            sp.variations,
            (f.product_id IS NOT NULL) AS is_favorite
       FROM supplier_products sp
       JOIN suppliers s ON s.id = sp.supplier_id
       LEFT JOIN admin_supplier_favorites f
              ON f.product_id = sp.id AND f.admin_id = $1
      WHERE sp.is_active = true
        AND s.is_active  = true
      ORDER BY (f.product_id IS NOT NULL) DESC, s.is_exclusive DESC, sp.sort_order ASC`,
    [req.admin.id]
  );

  const products = rows.map((r) => ({
    id:               r.id,
    supplierId:       r.supplier_id,
    supplierName:     r.supplier_name,
    name:             r.name,
    type:             r.type,
    description:      r.description,
    sku:              r.sku,
    specs:            r.specs,
    costPrice:        r.cost_price,
    clientPrice:      r.client_price,
    imagePreviewPath: r.image_preview_path,
    sortOrder:        r.sort_order,
    minPhotos:        r.min_photos,
    maxPhotos:        r.max_photos,
    productionDays:   r.production_days,
    variations:       r.variations,
    isFavorite:       r.is_favorite,
  }));

  res.json(products);
}));

// POST /api/admin-products/favorites/:productId — mark a supplier product as favorite
router.post('/favorites/:productId', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.productId)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  const { rows } = await pool.query(
    'SELECT id FROM supplier_products WHERE id = $1 AND is_active = true',
    [req.params.productId]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Product not found' });

  await pool.query(
    `INSERT INTO admin_supplier_favorites (admin_id, product_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.admin.id, req.params.productId]
  );
  res.json({ ok: true, isFavorite: true });
}));

// DELETE /api/admin-products/favorites/:productId — unmark favorite
router.delete('/favorites/:productId', asyncHandler(async (req, res) => {
  if (!UUID_RE.test(req.params.productId)) {
    return res.status(400).json({ message: 'Invalid ID format' });
  }
  await pool.query(
    'DELETE FROM admin_supplier_favorites WHERE admin_id = $1 AND product_id = $2',
    [req.admin.id, req.params.productId]
  );
  res.json({ ok: true, isFavorite: false });
}));

// DELETE /api/admin-products/:id — remove a product from the catalog
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await AdminProduct.findByIdAndDelete(req.params.id, req.admin.id);
  if (!deleted) return res.status(404).json({ message: 'Product not found' });
  res.json({ message: 'Product deleted' });
}));

module.exports = router;
