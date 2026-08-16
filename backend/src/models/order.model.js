const pool = require("../config/db");

async function create(userId, items) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const total = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

    const { rows } = await client.query(
      `INSERT INTO orders (user_id, total)
       VALUES ($1, $2)
       RETURNING id, user_id, total, status, created_at`,
      [userId, total]
    );
    const order = rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.product_id, item.name, item.price, item.quantity]
      );
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);

    await client.query("COMMIT");
    return order;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listByUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, total, status, created_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function findById(orderId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, total, status, created_at
     FROM orders
     WHERE id = $1`,
    [orderId]
  );
  return rows[0];
}

async function itemsByOrder(orderId) {
  const { rows } = await pool.query(
    `SELECT product_id, name, price, quantity
     FROM order_items
     WHERE order_id = $1`,
    [orderId]
  );
  return rows;
}

module.exports = { create, listByUser, findById, itemsByOrder };
