const pool = require("../config/db");

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

async function dashboard({ from, to }) {
  const condPaid = `WHERE o.payment_status = 'approved' AND o.status <> 'cancelled' AND o.created_at >= COALESCE($1::timestamptz, '1970-01-01') AND o.created_at <= COALESCE($2::timestamptz, now())`;
  const condAll = `WHERE o.created_at >= COALESCE($1::timestamptz, '1970-01-01') AND o.created_at <= COALESCE($2::timestamptz, now())`;

  const [revenueRes, ordersRes, customersRes, topRes, lowStockRes, recentRes, statusRes, daysRes] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(o.total), 0)::float AS revenue, COUNT(*)::int AS orders
         FROM orders o ${condPaid}`,
        [from || null, to || null]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END), 0)::int AS cancelled,
                COALESCE(AVG(o.total), 0)::float AS average_ticket
         FROM orders o ${condAll}`,
        [from || null, to || null]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM users WHERE role = 'customer'`
      ),
      pool.query(
        `SELECT oi.name, SUM(oi.quantity)::int AS sold, SUM(oi.quantity * oi.price)::float AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.payment_status = 'approved' AND o.status <> 'cancelled'
           AND o.created_at >= COALESCE($1::timestamptz, '1970-01-01') AND o.created_at <= COALESCE($2::timestamptz, now())
         GROUP BY oi.name
         ORDER BY sold DESC
         LIMIT 5`,
        [from || null, to || null]
      ),
      pool.query(
        `SELECT id, name, stock, category
         FROM products
         WHERE active = true AND stock <= 5
         ORDER BY stock ASC
         LIMIT 8`
      ),
      pool.query(
        `SELECT o.id, o.total, o.status, o.created_at, u.name AS customer_name
         FROM orders o
         JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
         LIMIT 8`
      ),
      pool.query(
        `SELECT status, COUNT(*)::int AS total
         FROM orders o ${condAll}
         GROUP BY status`,
        [from || null, to || null]
      ),
      pool.query(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(SUM(o.total), 0)::float AS revenue
         FROM generate_series(
                CASE WHEN $1::date IS NULL THEN now()::date - 13 ELSE $1::date END,
                COALESCE($2::date, now()::date), '1 day'::interval) AS d(day)
         LEFT JOIN orders o ON o.created_at::date = d.day
           AND o.payment_status = 'approved' AND o.status <> 'cancelled'
         GROUP BY d.day
         ORDER BY d.day`,
        [from || null, to || null]
      ),
    ]);

  const ordersByStatus = statusRes.rows.reduce((acc, r) => {
    acc[r.status] = r.total;
    return acc;
  }, {});

  return {
    revenue: revenueRes.rows[0].revenue,
    paidOrders: revenueRes.rows[0].orders,
    totalOrders: ordersRes.rows[0].total,
    cancelledOrders: ordersRes.rows[0].cancelled,
    averageTicket: ordersRes.rows[0].average_ticket,
    customers: customersRes.rows[0].total,
    topProducts: topRes.rows,
    lowStock: lowStockRes.rows,
    recentOrders: recentRes.rows,
    ordersByStatus,
    revenueByDay: daysRes.rows,
  };
}

async function listCategories() {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.active, c.created_at,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id)::int AS product_count
     FROM categories c
     ORDER BY c.name`
  );
  return rows;
}

async function listActiveCategories() {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.created_at,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = true)::int AS product_count
     FROM categories c
     WHERE c.active = true
     ORDER BY c.name`
  );
  return rows;
}

async function findCategoryById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, active, created_at FROM categories WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function createCategory(name) {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, slug) VALUES ($1, $2)
     RETURNING id, name, slug, active, created_at`,
    [name, slugify(name)]
  );
  return rows[0];
}

async function updateCategory(id, { name, active }) {
  const sets = [];
  const params = [];
  if (name !== undefined) {
    params.push(name);
    sets.push(`name = $${params.length}`);
    params.push(slugify(name));
    sets.push(`slug = $${params.length}`);
  }
  if (active !== undefined) {
    params.push(active);
    sets.push(`active = $${params.length}`);
  }
  if (!sets.length) return findCategoryById(id);

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE categories SET ${sets.join(", ")} WHERE id = $${params.length}
     RETURNING id, name, slug, active, created_at`,
    params
  );
  return rows[0];
}

async function removeCategory(id) {
  const category = await findCategoryById(id);
  if (!category) return null;
  await pool.query(
    `UPDATE products SET category_id = NULL, category = NULL WHERE category_id = $1`,
    [id]
  );
  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
  return category;
}

async function syncCategoryName(categoryId, newName) {
  await pool.query(
    `UPDATE products SET category = $1 WHERE category_id = $2`,
    [newName, categoryId]
  );
}

async function listCustomers({ search }) {
  const conditions = ["role = 'customer'"];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id)::int AS order_count,
            (SELECT COALESCE(SUM(o.total), 0) FROM orders o
              WHERE o.user_id = u.id AND o.payment_status = 'approved' AND o.status <> 'cancelled')::float AS total_spent
     FROM users u
     ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY u.created_at DESC
     LIMIT 500`,
    params
  );
  return rows;
}

async function customerById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function customerOrders(id) {
  const { rows } = await pool.query(
    `SELECT id, total, status, payment_method, payment_status, created_at
     FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [id]
  );
  return rows;
}

async function listContactMessages() {
  const { rows } = await pool.query(
    `SELECT id, name, email, message, created_at FROM contacts ORDER BY created_at DESC`
  );
  return rows;
}

async function removeContactMessage(id) {
  const { rows } = await pool.query(
    `DELETE FROM contacts WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  dashboard,
  listCategories,
  listActiveCategories,
  findCategoryById,
  createCategory,
  updateCategory,
  removeCategory,
  syncCategoryName,
  listCustomers,
  customerById,
  customerOrders,
  listContactMessages,
  removeContactMessage,
};
