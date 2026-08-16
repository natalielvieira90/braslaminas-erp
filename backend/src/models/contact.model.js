const pool = require("../config/db");

async function create({ name, email, message }) {
  const { rows } = await pool.query(
    `INSERT INTO contacts (name, email, message)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [name, email, message]
  );
  return rows[0];
}

module.exports = { create };
