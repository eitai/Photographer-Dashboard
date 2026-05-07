const pool = require('../db');
const { rowToCamel } = require('../db/utils');

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM client_face_references WHERE id = $1',
    [id]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findByClientId(clientId) {
  const { rows } = await pool.query(
    'SELECT * FROM client_face_references WHERE client_id = $1',
    [clientId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

async function findOne(filter) {
  const clientId = filter.clientId || filter.client_id;
  const adminId  = filter.adminId  || filter.admin_id;
  const { rows } = await pool.query(
    'SELECT * FROM client_face_references WHERE client_id = $1 AND admin_id = $2 LIMIT 1',
    [clientId, adminId]
  );
  return rows[0] ? rowToCamel(rows[0]) : null;
}

module.exports = { findById, findByClientId, findOne };
