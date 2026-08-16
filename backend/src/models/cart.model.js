const pool = require("../config/db");

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT
       ci.id AS cart_item_id,
       ci.quantity,
       p.id AS product_id,
       p.name,
       p.slug,
       p.price,
       p.image_url,
       p.stock,
       p.weight,
       p.height,
       p.width,
       p.length,
       (p.price * ci.quantity) AS subtotal
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = $1
     ORDER BY ci.created_at DESC`,
    [userId]
  );
  return rows;
}

async function addItem(userId, productId, quantity) {
  const { rows } = await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
     RETURNING *`,
    [userId, productId, quantity]
  );
  return rows[0];
}

async function updateItem(userId, productId, quantity) {
  const { rows } = await pool.query(
    `UPDATE cart_items SET quantity = $1
     WHERE user_id = $2 AND product_id = $3
     RETURNING *`,
    [quantity, userId, productId]
  );
  return rows[0];
}

async function removeItem(userId, productId) {
  await pool.query(
    `DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`,
    [userId, productId]
  );
}

async function clear(userId) {
  await pool.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
}

module.exports = { listByUser, addItem, updateItem, removeItem, clear };
