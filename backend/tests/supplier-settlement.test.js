/**
 * SupplierSettlement model (Tier 3) — openBalance / createForPeriod / markSettled
 *
 * Open balance sums cost prices of fulfilled, not-yet-settled orders;
 * createForPeriod snapshots that balance and attaches the orders (idempotent —
 * a second run finds nothing); markSettled closes it.
 *
 * Requires a real PostgreSQL database via DATABASE_URL.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_32_chars_minimum_ok!';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to run integration tests');
}

const { pool, connectDB } = require('../src/config/db');
const Admin = require('../src/models/Admin');
const Supplier = require('../src/models/Supplier');
const SupplierProduct = require('../src/models/SupplierProduct');
const SupplierSettlement = require('../src/models/SupplierSettlement');

const SUFFIX = Date.now();
let admin, supplier, product;

async function makeOrderWithItem({ status, unitCost, qty = 1, settlementId = null }) {
  const { rows } = await pool.query(
    `INSERT INTO store_orders
       (admin_id, supplier_id, flow, status, payment_status, total_amount, currency, shipping_address, settlement_id)
     VALUES ($1, $2, 'photographer', $3, 'not_required', 0, 'ILS', '{}'::jsonb, $4)
     RETURNING id`,
    [admin.id, supplier.id, status, settlementId],
  );
  const orderId = rows[0].id;
  await pool.query(
    `INSERT INTO store_order_items
       (order_id, product_id, quantity, unit_cost_price, unit_client_price, selected_image_ids)
     VALUES ($1, $2, $3, $4, $5, '{}')`,
    [orderId, product.id, qty, unitCost, unitCost * 1.5],
  );
  return orderId;
}

beforeAll(async () => {
  await connectDB();
  admin = await Admin.create({ name: 'Settle Admin', email: `settle_${SUFFIX}@test.com`, password: 'password123', role: 'admin' });
  await pool.query('UPDATE suppliers SET is_exclusive = false WHERE is_exclusive = true');
  supplier = await Supplier.create({ name: `Settle Sup ${SUFFIX}`, email: `settlesup_${SUFFIX}@test.com`, password: 'password123', isExclusive: true, isActive: true });
  product = await SupplierProduct.create(supplier.id, { name: 'P', type: 'print', costPrice: 50, clientPrice: 75, isActive: true });
}, 30000);

afterAll(async () => {
  if (admin?.id) {
    await pool.query('DELETE FROM store_order_items WHERE order_id IN (SELECT id FROM store_orders WHERE admin_id = $1)', [admin.id]);
    await pool.query('DELETE FROM store_orders WHERE admin_id = $1', [admin.id]);
  }
  if (supplier?.id) {
    await pool.query('DELETE FROM supplier_settlements WHERE supplier_id = $1', [supplier.id]);
    await pool.query('DELETE FROM supplier_products WHERE supplier_id = $1', [supplier.id]);
    await pool.query('DELETE FROM suppliers WHERE id = $1', [supplier.id]);
  }
  await pool.query('DELETE FROM admins WHERE email LIKE $1', [`%_${SUFFIX}@test.com`]);
  await pool.end();
});

describe('SupplierSettlement', () => {
  let settlementId;

  test('openBalance sums fulfilled, unsettled orders only', async () => {
    await makeOrderWithItem({ status: 'sent_to_supplier', unitCost: 50, qty: 2 }); // 100
    await makeOrderWithItem({ status: 'delivered', unitCost: 30, qty: 1 });        // 30
    await makeOrderWithItem({ status: 'approved', unitCost: 999, qty: 1 });        // excluded (not fulfilled)

    const bal = await SupplierSettlement.openBalance(supplier.id);
    expect(bal.total).toBe(130);
    expect(bal.orderCount).toBe(2);
  });

  test('createForPeriod snapshots the balance, attaches orders, and empties the open balance', async () => {
    const settlement = await SupplierSettlement.createForPeriod(supplier.id, '2026-05-01', '2026-06-01', 'May payout');
    expect(settlement).toBeTruthy();
    expect(Number(settlement.totalCost)).toBe(130);
    expect(settlement.orderCount).toBe(2);
    expect(settlement.status).toBe('open');
    settlementId = settlement.id;

    const after = await SupplierSettlement.openBalance(supplier.id);
    expect(after.total).toBe(0);
    expect(after.orderCount).toBe(0);
  });

  test('createForPeriod returns null when nothing is left to settle', async () => {
    const again = await SupplierSettlement.createForPeriod(supplier.id, '2026-06-01', '2026-07-01', null);
    expect(again).toBeNull();
  });

  test('markSettled closes the settlement', async () => {
    const settled = await SupplierSettlement.markSettled(settlementId, 'paid by transfer');
    expect(settled.status).toBe('settled');
    expect(settled.settledAt).toBeTruthy();
  });
});
