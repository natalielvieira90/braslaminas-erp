const pool = require("../src/config/db");
const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "..", "..", "database", "migrations");

async function runMigrations() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of files) {
      console.log(`Aplicando migração: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      console.log(`Migração aplicada: ${file}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Erro ao rodar migrações:", err.message);
  process.exit(1);
});
