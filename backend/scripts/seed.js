require("dotenv").config();
const pool = require("../src/config/db");
const bcrypt = require("bcryptjs");

const products = [
  {
    name: "Lâmina Histológica",
    slug: "lamina-histologica",
    description: "Lâmina de vidro para microscopia com bordas polidas.",
    price: 29.9,
    stock: 100,
    category: "Lâminas",
    image_url: "/images/produtos/lamina.jpg",
  },
  {
    name: "Kit Laboratório",
    slug: "kit-laboratorio",
    description: "Kit completo com lâminas, lamínulas e caixa de armazenamento.",
    price: 79.9,
    stock: 50,
    category: "Kits",
    image_url: "/images/produtos/kit.jpg",
  },
  {
    name: "Lâmina de Vidro Fosco",
    slug: "lamina-vidro-fosco",
    description: "Lâmina com extremidade fosca para identificação a lápis.",
    price: 19.9,
    stock: 200,
    category: "Lâminas",
    image_url: "/images/produtos/lamina-fosca.jpg",
  },
  {
    name: "Lamínulas 24x32mm",
    slug: "laminulas-24x32mm",
    description: "Caixa com 100 lamínulas de 0,13 a 0,17mm de espessura.",
    price: 15.5,
    stock: 80,
    category: "Acessórios",
    image_url: "/images/produtos/laminulas.jpg",
  },
  {
    name: "Caixa para Lâminas 100 un",
    slug: "caixa-laminas-100",
    description: "Caixa organizadora para armazenamento seguro de até 100 lâminas.",
    price: 45.0,
    stock: 30,
    category: "Acessórios",
    image_url: "/images/produtos/caixa.jpg",
  },
  {
    name: "Corante Hematoxilina-Eosina",
    slug: "corante-he-eosina",
    description: "Frasco 500ml do corante H&E para coloração histológica.",
    price: 59.9,
    stock: 40,
    category: "Reagentes",
    image_url: "/images/produtos/he.jpg",
  },
];

async function runSeed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const adminPassword = await bcrypt.hash("admin123", 10);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING`,
      ["Administrador", "admin@braslaminas.com.br", adminPassword]
    );

    const categories = [...new Set(products.map((p) => p.category))];
    for (const name of categories) {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      await client.query(
        `INSERT INTO categories (name, slug)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING`,
        [name, slug]
      );
    }

    for (const p of products) {
      const cat = await client.query(`SELECT id FROM categories WHERE name = $1`, [p.category]);
      await client.query(
        `INSERT INTO products (name, slug, description, price, stock, category, image_url, category_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           stock = EXCLUDED.stock,
           category = EXCLUDED.category,
           image_url = EXCLUDED.image_url,
           category_id = EXCLUDED.category_id`,
        [p.name, p.slug, p.description, p.price, p.stock, p.category, p.image_url, cat.rows[0] ? cat.rows[0].id : null]
      );
    }

    await client.query("COMMIT");
    console.log("Seed concluído com sucesso!");
    console.log("Admin: admin@braslaminas.com.br / admin123");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Erro no seed:", err.message);
  process.exit(1);
});
