const express = require('express');
const SupplierSettlement = require('../models/SupplierSettlement');
const { supplierProtect } = require('../middleware/supplierAuth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(supplierProtect);

// GET /api/supplier/settlement — what the platform owes this supplier + history
router.get('/', asyncHandler(async (req, res) => {
  const open = await SupplierSettlement.openBalance(req.supplier.id);
  const history = await SupplierSettlement.history(req.supplier.id);
  res.json({ open, history });
}));

module.exports = router;
