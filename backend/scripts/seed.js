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
    weight: 0.012,
    height: 0.1,
    width: 2.5,
    length: 7.5,
  },
  {
    name: "Kit Laboratório",
    slug: "kit-laboratorio",
    description: "Kit completo com lâminas, lamínulas e caixa de armazenamento.",
    price: 79.9,
    stock: 50,
    category: "Kits",
    image_url: "/images/produtos/kit.jpg",
    weight: 0.8,
    height: 10,
    width: 15,
    length: 20,
  },
  {
    name: "Lâmina de Vidro Fosco",
    slug: "lamina-vidro-fosco",
    description: "Lâmina com extremidade fosca para identificação a lápis.",
    price: 19.9,
    stock: 200,
    category: "Lâminas",
    image_url: "/images/produtos/lamina-fosca.jpg",
    weight: 0.01,
    height: 0.1,
    width: 2.5,
    length: 7.5,
  },
  {
    name: "Lamínulas 24x32mm",
    slug: "laminulas-24x32mm",
    description: "Caixa com 100 lamínulas de 0,13 a 0,17mm de espessura.",
    price: 15.5,
    stock: 80,
    category: "Acessórios",
    image_url: "/images/produtos/laminulas.jpg",
    weight: 0.09,
    height: 3,
    width: 6,
    length: 8,
  },
  {
    name: "Caixa para Lâminas 100 un",
    slug: "caixa-laminas-100",
    description: "Caixa organizadora para armazenamento seguro de até 100 lâminas.",
    price: 45.0,
    stock: 30,
    category: "Acessórios",
    image_url: "/images/produtos/caixa.jpg",
    weight: 0.35,
    height: 7,
    width: 12,
    length: 17,
  },
  {
    name: "Corante Hematoxilina-Eosina",
    slug: "corante-he-eosina",
    description: "Frasco 500ml do corante H&E para coloração histológica.",
    price: 59.9,
    stock: 40,
    category: "Reagentes",
    image_url: "/images/produtos/he.jpg",
    weight: 0.65,
    height: 8,
    width: 8,
    length: 15,
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
        `INSERT INTO products (name, slug, description, price, stock, category, image_url, category_id, weight, height, width, length)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           stock = EXCLUDED.stock,
           category = EXCLUDED.category,
           image_url = EXCLUDED.image_url,
           category_id = EXCLUDED.category_id,
           weight = EXCLUDED.weight,
           height = EXCLUDED.height,
           width = EXCLUDED.width,
           length = EXCLUDED.length`,
        [p.name, p.slug, p.description, p.price, p.stock, p.category, p.image_url, cat.rows[0] ? cat.rows[0].id : null, p.weight, p.height, p.width, p.length]
      );
    }

    // ----- Dados DEMO (pedidos de demonstração) -----

    const demoPassword = await bcrypt.hash("demo123", 10);
    await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ('Cliente Demo', 'demo@braslaminas.com.br', $1, 'customer')
       ON CONFLICT (email) DO NOTHING`,
      [demoPassword]
    );

    const demoUser = await client.query(`SELECT id FROM users WHERE email = 'demo@braslaminas.com.br'`);
    const demoUserId = demoUser.rows[0].id;

    const lamina = await client.query(`SELECT id FROM products WHERE slug = 'lamina-histologica'`);
    const fosca = await client.query(`SELECT id FROM products WHERE slug = 'lamina-vidro-fosco'`);
    const kit = await client.query(`SELECT id FROM products WHERE slug = 'kit-laboratorio'`);
    const laminaId = lamina.rows[0].id;
    const foscaId = fosca.rows[0].id;
    const kitId = kit.rows[0].id;

    // Pedido DEMO 1: entregue (fluxo completo com timeline)
    const demoOrder1 = await client.query(
      `INSERT INTO orders (user_id, total, status, payment_method, payment_status, shipping_address,
                           subtotal, shipping_cost, discount, shipping_method, shipping_status, cep, tracking_code)
       VALUES ($1, 118.50, 'delivered', 'pix', 'approved',
               'Rua das Lâminas, 42, Sala 3, São Paulo, SP', 99.60, 18.90, 0,
               'Correios - SEDEX', 'delivered', '01310100', 'BR-DEMO-000001')
       RETURNING id`,
      [demoUserId]
    );
    const demoOrder1Id = demoOrder1.rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity)
       VALUES ($1, $2, 'Lâmina Histológica', 29.90, 2), ($1, $3, 'Lâmina de Vidro Fosco', 19.90, 2)`,
      [demoOrder1Id, laminaId, foscaId]
    );

    await client.query(
      `INSERT INTO payments (order_id, method, status, amount, transaction_code, details, paid_at)
       VALUES ($1, 'pix', 'approved', 118.50, 'PIX-DEMO-000001', '{"pix_code":"demo"}', now() - interval '8 days')`,
      [demoOrder1Id]
    );

    const timeline = [
      ["order_received", "Pedido recebido", "8 days"],
      ["payment_approved", "Pagamento aprovado", "8 days"],
      ["order_prepared", "Pedido preparado para envio", "7 days"],
      ["posted", "Objeto postado", "7 days"],
      ["in_transit", "Objeto em trânsito", "5 days"],
      ["out_for_delivery", "Saiu para entrega", "1 day"],
      ["delivered", "Objeto entregue", "1 hour"],
    ];
    for (const [status, description, ago] of timeline) {
      await client.query(
        `INSERT INTO tracking_events (order_id, tracking_code, status, description, event_date)
         VALUES ($1, 'BR-DEMO-000001', $2, $3, now() - $4::interval)`,
        [demoOrder1Id, status, description, ago]
      );
    }

    // Pedido DEMO 2: aguardando pagamento (PIX)
    const demoOrder2 = await client.query(
      `INSERT INTO orders (user_id, total, status, payment_method, payment_status, shipping_address,
                           subtotal, shipping_cost, discount, shipping_method, shipping_status, cep)
       VALUES ($1, 92.40, 'pending', 'pix', 'pending',
               'Rua das Lâminas, 42, Sala 3, São Paulo, SP', 79.90, 12.50, 0,
               'Correios - PAC', 'pending', '01310100')
       RETURNING id`,
      [demoUserId]
    );
    const demoOrder2Id = demoOrder2.rows[0].id;

    await client.query(
      `INSERT INTO order_items (order_id, product_id, name, price, quantity)
       VALUES ($1, $2, 'Kit Laboratório', 79.90, 1)`,
      [demoOrder2Id, kitId]
    );

    await client.query(
      `INSERT INTO payments (order_id, method, status, amount, transaction_code, details)
       VALUES ($1, 'pix', 'pending', 92.40, 'PIX-DEMO-000002', '{"pix_code":"demo"}')`,
      [demoOrder2Id]
    );

    await client.query(
      `INSERT INTO tracking_events (order_id, status, description)
       VALUES ($1, 'order_received', 'Pedido recebido')`,
      [demoOrder2Id]
    );

    await client.query("COMMIT");
    console.log("Seed concluído com sucesso!");
    console.log("Admin: admin@braslaminas.com.br / admin123");
    console.log("Cliente DEMO: demo@braslaminas.com.br / demo123");
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
