const pool = require("../config/db");

async function create(userId, items, { paymentMethod, shippingAddress, cep, shippingOption, shippingCost, discount }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subtotal = items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);
    const shippingCostNum = Number(shippingCost) || 0;
    const discountNum = Number(discount) || 0;
    const total = Math.max(0, subtotal + shippingCostNum - discountNum);
    const shippingMethod =
      shippingOption && shippingOption.carrier
        ? `${shippingOption.carrier} - ${shippingOption.service}`
        : null;

    const { rows } = await client.query(
      `INSERT INTO orders (user_id, total, status, payment_method, payment_status,
                           shipping_address, subtotal, shipping_cost, discount,
                           shipping_method, shipping_status, cep)
       VALUES ($1, $2, 'pending', $3::varchar, 'pending', $4::varchar, $5, $6, $7, $8::varchar, 'pending', $9::varchar)
       RETURNING id, user_id, total, status, payment_method, payment_status,
                 shipping_address, subtotal, shipping_cost, discount,
                 shipping_method, shipping_status, cep, tracking_code, created_at`,
      [userId, total, paymentMethod || null, shippingAddress || null, subtotal, shippingCostNum, discountNum, shippingMethod, cep || null]
    );
    const order = rows[0];

    for (const item of items) {
      const stock = await client.query(
        `SELECT stock FROM products WHERE id = $1 FOR UPDATE`,
        [item.product_id]
      );
      if (!stock.rows[0] || stock.rows[0].stock < item.quantity) {
        throw Object.assign(new Error(`Estoque insuficiente para "${item.name}".`), {
          status: 400,
        });
      }
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
    `SELECT id, total, status, payment_method, payment_status, shipping_method, shipping_status,
            tracking_code, cep, created_at
     FROM orders
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

async function findById(orderId) {
  const { rows } = await pool.query(
    `SELECT id, user_id, total, status, payment_method, payment_status,
            shipping_address, subtotal, shipping_cost, discount,
            shipping_method, shipping_status, cep, tracking_code, created_at, updated_at
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

async function listAdmin({ status, search, limit = 100, offset = 0 }) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`o.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR o.id::text ILIKE $${params.length})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT o.id, o.user_id, o.total, o.status, o.payment_method, o.payment_status,
            o.shipping_method, o.shipping_status, o.cep,
            o.tracking_code, o.created_at,
            u.name AS customer_name, u.email AS customer_email
     FROM orders o
     JOIN users u ON u.id = o.user_id
     ${where}
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function updateStatus(orderId, status) {
  const { rows } = await pool.query(
    `UPDATE orders SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [status, orderId]
  );
  return rows[0];
}

async function updatePaymentStatus(orderId, paymentStatus) {
  const { rows } = await pool.query(
    `UPDATE orders SET payment_status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [paymentStatus, orderId]
  );
  return rows[0];
}

async function updateTracking(orderId, trackingCode) {
  const { rows } = await pool.query(
    `UPDATE orders SET tracking_code = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [trackingCode, orderId]
  );
  return rows[0];
}

async function updateShippingStatus(orderId, shippingStatus) {
  const { rows } = await pool.query(
    `UPDATE orders SET shipping_status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [shippingStatus, orderId]
  );
  return rows[0];
}

async function countByStatus({ from, to }) {
  const conditions = [
    "created_at >= COALESCE($1::timestamptz, '1970-01-01')",
    "created_at <= COALESCE($2::timestamptz, now())",
  ];
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS total
     FROM orders
     WHERE ${conditions.join(" AND ")}
     GROUP BY status`,
    [from || null, to || null]
  );
  return rows;
}

module.exports = {
  create,
  listByUser,
  findById,
  itemsByOrder,
  listAdmin,
  updateStatus,
  updatePaymentStatus,
  updateTracking,
  updateShippingStatus,
  countByStatus,
};
