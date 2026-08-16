const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const pool = require("../src/config/db");
const app = require("../src/app");

const unique = Date.now();

after(async () => {
  await pool.query(`DELETE FROM cart_items WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [
    `teste-%@example.com`,
  ]);
  await pool.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`, [
    `teste-%@example.com`,
  ]);
  await pool.query("DELETE FROM contacts WHERE email LIKE $1", [`teste-%@example.com`]);
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`teste-%@example.com`]);
  await pool.query("DELETE FROM categories WHERE name LIKE 'Teste-%'");
  await pool.end();
});

describe("Health", () => {
  it("responde status ok", async () => {
    const res = await request(app).get("/api/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");
  });
});

describe("Produtos", () => {
  it("lista produtos públicos", async () => {
    const res = await request(app).get("/api/products");
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.products));
  });

  it("suporta limit e offset", async () => {
    const res = await request(app).get("/api/products?limit=2");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.products.length, 2);
  });

  it("busca por nome", async () => {
    const res = await request(app).get("/api/products?search=lamina");
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.products.length >= 1);
  });

  it("retorna 404 para slug inexistente", async () => {
    const res = await request(app).get("/api/products/slug-que-nao-existe");
    assert.strictEqual(res.status, 404);
  });
});

describe("Auth", () => {
  it("rejeita registro com senha curta", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Teste",
      email: `teste-${unique}@example.com`,
      password: "123",
    });
    assert.strictEqual(res.status, 400);
  });

  it("registra e faz login", async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Teste",
      email: `teste-${unique}@example.com`,
      password: "123456",
    });
    assert.strictEqual(register.status, 201);
    assert.ok(register.body.token);

    const login = await request(app).post("/api/auth/login").send({
      email: `teste-${unique}@example.com`,
      password: "123456",
    });
    assert.strictEqual(login.status, 200);
    assert.ok(login.body.token);
  });

  it("rejeita login com senha errada", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: `teste-${unique}@example.com`,
      password: "errada",
    });
    assert.strictEqual(res.status, 401);
  });

  it("exige token em /auth/me", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.strictEqual(res.status, 401);
  });
});

describe("Contato", () => {
  it("salva mensagem de contato", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Teste",
      email: `teste-${unique}@example.com`,
      message: "Olá, gostaria de um orçamento.",
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.contact.id);
  });

  it("rejeita mensagem sem email", async () => {
    const res = await request(app).post("/api/contact").send({
      name: "Teste",
      message: "Sem email",
    });
    assert.strictEqual(res.status, 400);
  });
});

describe("Admin", () => {
  it("bloqueia criação de produto sem token", async () => {
    const res = await request(app).post("/api/products").send({
      name: "Produto X",
      price: 10,
    });
    assert.strictEqual(res.status, 401);
  });
});

describe("Pagamento", () => {
  let userToken;
  let userId;
  let productId;
  let adminToken;

  before(async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Teste Pagamento",
      email: `teste-pag-${unique}@example.com`,
      password: "123456",
    });
    userToken = register.body.token;
    userId = register.body.user.id;

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@braslaminas.com.br",
      password: "admin123",
    });
    adminToken = adminLogin.body.token;

    const products = await request(app).get("/api/products?limit=1");
    productId = products.body.products[0].id;
    assert.ok(productId);

    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ product_id: productId, quantity: 1 })
      .expect(201);
  });

  it("rejeita checkout sem método de pagamento", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({});
    assert.strictEqual(res.status, 400);
  });

  it("rejeita método de pagamento inválido", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ payment_method: "cheque" });
    assert.strictEqual(res.status, 400);
  });

  it("rejeita checkout sem endereço de entrega", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ payment_method: "pix" });
    assert.strictEqual(res.status, 400);
  });

  it("rejeita cartão inválido e cancela o pedido", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        payment_method: "credit_card",
        card: { number: "123", holder: "T", expiry: "99/99", cvv: "1" },
        shipping_address: "Rua Teste, 123 - São Paulo/SP",
      });
    assert.strictEqual(res.status, 400);

    const orders = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${userToken}`);
    assert.strictEqual(orders.body.orders[0].status, "cancelled");
  });

  function addToCart() {
    return request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ product_id: productId, quantity: 1 })
      .expect(201);
  }

  it("finaliza com PIX e fica pago imediatamente", async () => {
    await addToCart();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        payment_method: "pix",
        shipping_address: "Rua Teste, 123 - Centro, São Paulo/SP - CEP 01001-000",
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.order.status, "paid");
    assert.strictEqual(res.body.order.payment_status, "paid");
    assert.strictEqual(res.body.payment.method, "pix");
    assert.ok(res.body.payment.details.pix_code);

    const detail = await request(app)
      .get(`/api/orders/${res.body.order.id}`)
      .set("Authorization", `Bearer ${userToken}`);
    assert.strictEqual(detail.body.payment.method, "pix");
  });

  it("finaliza com cartão válido e fica pago", async () => {
    await addToCart();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        payment_method: "credit_card",
        card: { number: "4111111111111111", holder: "Teste Cliente", expiry: "12/28", cvv: "123" },
        shipping_address: "Rua Teste, 123 - São Paulo/SP",
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.order.status, "paid");
    assert.strictEqual(res.body.payment.details.card_last4, "1111");
    assert.ok(res.body.payment.transaction_code);
  });

  it("finaliza com boleto pendente e admin confirma e estorna", async () => {
    await addToCart();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        payment_method: "boleto",
        shipping_address: "Rua Teste, 123 - Centro, São Paulo/SP - CEP 01001-000",
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.order.status, "pending");
    assert.strictEqual(res.body.order.payment_status, "pending");
    assert.strictEqual(res.body.payment.status, "pending");
    assert.ok(res.body.payment.details.barcode);

    const orderId = res.body.order.id;

    const confirmed = await request(app)
      .post(`/api/admin/orders/${orderId}/confirm-payment`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.strictEqual(confirmed.status, 200);
    assert.strictEqual(confirmed.body.payment.status, "paid");
    assert.strictEqual(confirmed.body.order.payment_status, "paid");

    const refunded = await request(app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.strictEqual(refunded.status, 200);
    assert.strictEqual(refunded.body.payment.status, "refunded");
    assert.strictEqual(refunded.body.order.status, "cancelled");
  });
});

describe("Admin autenticado", () => {
  let adminToken;

  before(async () => {
    const login = await request(app).post("/api/auth/login").send({
      email: "admin@braslaminas.com.br",
      password: "admin123",
    });
    adminToken = login.body.token;
    assert.ok(adminToken);
  });

  it("bloqueia dashboard sem token", async () => {
    const res = await request(app).get("/api/admin/dashboard");
    assert.strictEqual(res.status, 401);
  });

  it("bloqueia dashboard para cliente", async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Teste Cliente",
      email: `teste-cli-${unique}@example.com`,
      password: "123456",
    });
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${register.body.token}`);
    assert.strictEqual(res.status, 403);
  });

  it("retorna métricas do dashboard", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.metrics);
    assert.ok("revenue" in res.body.metrics);
    assert.ok("totalOrders" in res.body.metrics);
    assert.ok(Array.isArray(res.body.metrics.revenueByDay));
    assert.ok(Array.isArray(res.body.metrics.topProducts));
  });

  it("lista pedidos administrativos", async () => {
    const res = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.orders));
  });

  it("detalha pedido com itens e pagamento", async () => {
    const list = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.ok(list.body.orders.length > 0);
    const res = await request(app)
      .get(`/api/admin/orders/${list.body.orders[0].id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });

  it("atualiza status e rastreio do pedido", async () => {
    const list = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    const orderId = list.body.orders[0].id;

    const status = await request(app)
      .put(`/api/admin/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "delivered" });
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.body.order.status, "delivered");

    const tracking = await request(app)
      .put(`/api/admin/orders/${orderId}/tracking`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tracking_code: "BR123456789" });
    assert.strictEqual(tracking.status, 200);
    assert.strictEqual(tracking.body.order.tracking_code, "BR123456789");
  });

  it("lista produtos administrativos", async () => {
    const res = await request(app)
      .get("/api/admin/products")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.products));
  });

  it("cria, atualiza e remove categoria", async () => {
    const create = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Teste-${unique}` });
    assert.strictEqual(create.status, 201);
    assert.ok(create.body.category.id);

    const id = create.body.category.id;
    const update = await request(app)
      .put(`/api/admin/categories/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Teste-${unique}-renomeada` });
    assert.strictEqual(update.status, 200);
    assert.strictEqual(update.body.category.name, `Teste-${unique}-renomeada`);

    const remove = await request(app)
      .del(`/api/admin/categories/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(remove.status, 204);
  });

  it("lista clientes cadastrados", async () => {
    const res = await request(app)
      .get("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.customers));
  });

  it("lista e remove mensagens de contato", async () => {
    const res = await request(app)
      .get("/api/admin/contact")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.messages));
  });
});
