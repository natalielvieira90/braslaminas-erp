const pool = require("../config/db");

/**
 * Armazenamento de pagamentos. Regras de negócio/simulação ficam nos
 * providers (services/payment/*).
 */
async function create({ orderId, method, amount, status = "pending", transactionCode = null, details = null, paidAt = null }) {
  const { rows } = await pool.query(
    `INSERT INTO payments (order_id, method, status, amount, transaction_code, details, paid_at)
     VALUES ($1, $2, $3, $4, $5::varchar, $6::jsonb, $7::timestamptz)
     RETURNING id, order_id, method, status, amount, transaction_code, details, paid_at, created_at`,
    [orderId, method, status, amount, transactionCode, details, paidAt]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, order_id, method, status, amount, transaction_code, details, paid_at, created_at
     FROM payments WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function findByOrder(orderId) {
  const { rows } = await pool.query(
    `SELECT id, order_id, method, status, amount, transaction_code, details, paid_at, created_at
     FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [orderId]
  );
  return rows[0];
}

async function listAll() {
  const { rows } = await pool.query(
    `SELECT id, order_id, method, status, amount, transaction_code, paid_at, created_at
     FROM payments ORDER BY created_at DESC`
  );
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE payments
     SET status = $1::varchar,
         paid_at = CASE WHEN $1 = 'approved' THEN COALESCE(paid_at, now()) ELSE paid_at END
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  return rows[0];
}

async function approve(id) {
  return updateStatus(id, "approved");
}

async function reject(id) {
  return updateStatus(id, "rejected");
}

async function cancel(id) {
  return updateStatus(id, "cancelled");
}

async function refund(id) {
  const { rows } = await pool.query(
    `UPDATE payments SET status = 'refunded' WHERE id = $1 AND status = 'approved' RETURNING *`,
    [id]
  );
  return rows[0];
}

module.exports = { create, findById, findByOrder, listAll, updateStatus, approve, reject, cancel, refund };
