const pool = require("../config/db");

async function addEvent({ orderId, trackingCode, status, description, eventDate }) {
  const { rows } = await pool.query(
    `INSERT INTO tracking_events (order_id, tracking_code, status, description, event_date)
     VALUES ($1, $2::varchar, $3, $4::varchar, COALESCE($5::timestamptz, now()))
     RETURNING *`,
    [orderId, trackingCode || null, status, description || null, eventDate || null]
  );
  return rows[0];
}

async function listByOrder(orderId) {
  const { rows } = await pool.query(
    `SELECT id, tracking_code, status, description, event_date
     FROM tracking_events
     WHERE order_id = $1
     ORDER BY event_date ASC, created_at ASC`,
    [orderId]
  );
  return rows;
}

async function listByTrackingCode(trackingCode) {
  const { rows } = await pool.query(
    `SELECT id, tracking_code, status, description, event_date
     FROM tracking_events
     WHERE tracking_code = $1
     ORDER BY event_date ASC, created_at ASC`,
    [trackingCode]
  );
  return rows;
}

async function lastEventByOrder(orderId) {
  const { rows } = await pool.query(
    `SELECT status, description, event_date
     FROM tracking_events
     WHERE order_id = $1
     ORDER BY event_date DESC, created_at DESC
     LIMIT 1`,
    [orderId]
  );
  return rows[0] || null;
}

module.exports = { addEvent, listByOrder, listByTrackingCode, lastEventByOrder };
