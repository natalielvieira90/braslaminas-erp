const pool = require("../config/db");

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return rows[0];
}

async function create({ name, email, passwordHash }) {
  const hash = passwordHash || `google:${require("crypto").randomUUID()}`;
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, created_at`,
    [name, email, hash]
  );
  return rows[0];
}

module.exports = { findById, findByEmail, create };
