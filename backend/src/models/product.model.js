const pool = require("../config/db");

const SELECT_COLUMNS = `
  id, name, slug, description,
  price, stock, category, image_url, active,
  created_at
`;

async function list({ category, search, active = true, limit = 50, offset = 0 }) {
  const conditions = [];
  const params = [];

  if (active) {
    conditions.push("active = true");
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`unaccent(name) ILIKE unaccent($${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit, offset);

  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS}
     FROM products
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function findBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM products WHERE slug = $1 AND active = true`,
    [slug]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM products WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function create({ name, slug, description, price, stock, category, imageUrl }) {
  const { rows } = await pool.query(
    `INSERT INTO products (name, slug, description, price, stock, category, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${SELECT_COLUMNS}`,
    [name, slug, description, price, stock, category, imageUrl]
  );
  return rows[0];
}

async function update(id, fields) {
  const allowed = ["name", "description", "price", "stock", "category", "image_url", "active"];
  const sets = [];
  const params = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      params.push(fields[key]);
      sets.push(`${key} = $${params.length}`);
    }
  }

  if (!sets.length) return findById(id);

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE products SET ${sets.join(", ")} WHERE id = $${params.length}
     RETURNING ${SELECT_COLUMNS}`,
    params
  );
  return rows[0];
}

async function remove(id) {
  await pool.query(`DELETE FROM products WHERE id = $1`, [id]);
}

module.exports = { list, findBySlug, findById, create, update, remove };
