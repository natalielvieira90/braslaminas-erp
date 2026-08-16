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

  const dispatcher = globalThis[Symbol.for("undici.globalDispatcher.1")];
  if (dispatcher && typeof dispatcher.close === "function") {
    await dispatcher.close();
  }
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

describe("CEP", () => {
  it("consulta CEP válido via ViaCEP", async () => {
    const res = await request(app).get("/api/cep/01001000");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.localidade, "São Paulo");
    assert.ok(res.body.logradouro);
  });

  it("rejeita CEP inválido", async () => {
    const res = await request(app).get("/api/cep/123");
    assert.strictEqual(res.status, 400);
  });

  it("retorna 404 para CEP inexistente", async () => {
    const res = await request(app).get("/api/cep/99999999");
    assert.strictEqual(res.status, 404);
  });
});

describe("Frete", () => {
  let userToken;
  let productId;

  before(async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Teste Frete",
      email: `teste-frete-${unique}@example.com`,
      password: "123456",
    });
    userToken = register.body.token;

    const products = await request(app).get("/api/products?limit=1");
    productId = products.body.products[0].id;
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ product_id: productId, quantity: 2 })
      .expect(201);
  });

  it("cota frete com itens explícitos", async () => {
    const items = encodeURIComponent(JSON.stringify([{ product_id: productId, quantity: 1 }]));
    const res = await request(app).get(`/api/shipping/quote?cep_destino=01310100&items=${items}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.options.length, 3);
    for (const option of res.body.options) {
      assert.ok(option.price > 0);
      assert.ok(option.delivery_days > 0);
      assert.ok(option.id);
    }
  });

  it("cota frete usando o carrinho do usuário logado", async () => {
    const res = await request(app)
      .get("/api/shipping/quote?cep_destino=01310100")
      .set("Authorization", `Bearer ${userToken}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.options.length, 3);
  });

  it("rejeita cotação sem itens", async () => {
    const res = await request(app).get("/api/shipping/quote?cep_destino=01310100");
    assert.strictEqual(res.status, 400);
  });

  it("rejeita CEP de destino inválido", async () => {
    const items = encodeURIComponent(JSON.stringify([{ product_id: productId, quantity: 1 }]));
    const res = await request(app).get(`/api/shipping/quote?cep_destino=abc&items=${items}`);
    assert.strictEqual(res.status, 400);
  });

  it("retorna 404 para rastreamento inexistente", async () => {
    const res = await request(app).get("/api/shipping/tracking/BR-DEMO-NADA");
    assert.strictEqual(res.status, 404);
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

  function addToCart() {
    return request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ product_id: productId, quantity: 1 })
      .expect(201);
  }

  async function shippingOptionId(token = userToken) {
    const res = await request(app)
      .get("/api/shipping/quote?cep_destino=01310100")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return res.body.options[0].id;
  }

  const checkoutBody = {
    cep: "01310100",
    shipping_address: "Rua Teste, 123 - Centro, São Paulo/SP",
  };

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
      .send({ payment_method: "pix", cep: "01310100", shipping_option_id: await shippingOptionId() });
    assert.strictEqual(res.status, 400);
  });

  it("rejeita checkout sem CEP", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ payment_method: "pix", shipping_address: checkoutBody.shipping_address });
    assert.strictEqual(res.status, 400);
  });

  it("rejeita opção de frete inválida", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ ...checkoutBody, payment_method: "pix", shipping_option_id: "nao-existe" });
    assert.strictEqual(res.status, 400);
  });

  it("rejeita cartão inválido e cancela o pedido", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        ...checkoutBody,
        payment_method: "credit_card",
        card: { number: "123", holder: "T", expiry: "99/99", cvv: "1" },
        shipping_option_id: await shippingOptionId(),
      });
    assert.strictEqual(res.status, 400);

    const orders = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${userToken}`);
    assert.strictEqual(orders.body.orders[0].status, "cancelled");
  });

  it("finaliza com PIX, nasce pendente e é aprovado por simulação", async () => {
    await addToCart();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ ...checkoutBody, payment_method: "pix", shipping_option_id: await shippingOptionId() });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.order.status, "pending");
    assert.strictEqual(res.body.order.payment_status, "pending");
    assert.strictEqual(res.body.order.shipping_cost > 0, true);
    assert.strictEqual(
      Number(res.body.order.subtotal) + Number(res.body.order.shipping_cost),
      Number(res.body.order.total)
    );
    assert.strictEqual(res.body.payment.method, "pix");
    assert.strictEqual(res.body.payment.status, "pending");
    assert.ok(res.body.payment.details.pix_code);

    const simulated = await request(app)
      .post(`/api/orders/${res.body.order.id}/simulate-payment`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ outcome: "approved" });
    assert.strictEqual(simulated.status, 200);
    assert.strictEqual(simulated.body.order.payment_status, "approved");
    assert.strictEqual(simulated.body.order.status, "paid");

    const detail = await request(app)
      .get(`/api/orders/${res.body.order.id}`)
      .set("Authorization", `Bearer ${userToken}`);
    assert.strictEqual(detail.body.payment.method, "pix");
    assert.strictEqual(detail.body.payment.status, "approved");
  });

  it("finaliza com cartão válido, fica pendente e é aprovado via webhook", async () => {
    await addToCart();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        ...checkoutBody,
        payment_method: "credit_card",
        card: { number: "4111111111111111", holder: "Teste Cliente", expiry: "12/28", cvv: "123" },
        shipping_option_id: await shippingOptionId(),
      });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.order.status, "pending");
    assert.strictEqual(res.body.payment.details.card_last4, "1111");
    assert.ok(res.body.payment.transaction_code);

    const webhook = await request(app)
      .post("/api/webhooks/payment/payment")
      .send({ event: "payment.approved", order_id: res.body.order.id });
    assert.strictEqual(webhook.status, 200);
    assert.strictEqual(webhook.body.order.payment_status, "approved");
  });

  it("finaliza com boleto pendente e admin confirma e estorna", async () => {
    await addToCart();
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ ...checkoutBody, payment_method: "boleto", shipping_option_id: await shippingOptionId() });
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
    assert.strictEqual(confirmed.body.payment.status, "approved");
    assert.strictEqual(confirmed.body.order.payment_status, "approved");

    const refunded = await request(app)
      .post(`/api/admin/orders/${orderId}/refund`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    assert.strictEqual(refunded.status, 200);
    assert.strictEqual(refunded.body.payment.status, "refunded");
    assert.strictEqual(refunded.body.order.status, "cancelled");
  });

  it("bloqueia simulação de pagamento de outro usuário", async () => {
    const other = await request(app).post("/api/auth/register").send({
      name: "Outro Usuário",
      email: `teste-outro-${unique}@example.com`,
      password: "123456",
    });
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${other.body.token}`)
      .send({ product_id: productId, quantity: 1 })
      .expect(201);
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${other.body.token}`)
      .send({ ...checkoutBody, payment_method: "pix", shipping_option_id: await shippingOptionId(other.body.token) });

    const blocked = await request(app)
      .post(`/api/orders/${res.body.order.id}/simulate-payment`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ outcome: "approved" });
    assert.strictEqual(blocked.status, 403);
  });
});

describe("Rastreamento DEMO", () => {
  let userToken;
  let adminToken;
  let productId;
  let orderId;
  let trackingCode;

  before(async () => {
    const register = await request(app).post("/api/auth/register").send({
      name: "Teste Rastreio",
      email: `teste-rast-${unique}@example.com`,
      password: "123456",
    });
    userToken = register.body.token;

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: "admin@braslaminas.com.br",
      password: "admin123",
    });
    adminToken = adminLogin.body.token;

    const products = await request(app).get("/api/products?limit=1");
    productId = products.body.products[0].id;
    await request(app)
      .post("/api/cart")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ product_id: productId, quantity: 1 })
      .expect(201);

    const quote = await request(app)
      .get("/api/shipping/quote?cep_destino=01310100")
      .set("Authorization", `Bearer ${userToken}`)
      .expect(200);
    const optionId = quote.body.options[0].id;

    const checkout = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        cep: "01310100",
        shipping_address: "Rua Teste, 123 - Centro, São Paulo/SP",
        payment_method: "pix",
        shipping_option_id: optionId,
      })
      .expect(201);
    orderId = checkout.body.order.id;

    await request(app)
      .post(`/api/orders/${orderId}/simulate-payment`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ outcome: "approved" })
      .expect(200);
  });

  it("admin gera envio e código de rastreamento", async () => {
    const res = await request(app)
      .post(`/api/admin/orders/${orderId}/simulate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "ship" });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.order.tracking_code);
    assert.strictEqual(res.body.order.shipping_status, "shipped");
    trackingCode = res.body.order.tracking_code;
  });

  it("rastreamento público retorna eventos", async () => {
    const res = await request(app).get(`/api/shipping/tracking/${trackingCode}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.events.some((e) => e.status === "posted"));
  });

  it("avança a entrega pelos status", async () => {
    for (const action of ["in_transit", "out_for_delivery", "delivered"]) {
      const res = await request(app)
        .post(`/api/admin/orders/${orderId}/simulate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ action });
      assert.strictEqual(res.status, 200);
    }
    const detail = await request(app)
      .get(`/api/admin/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(detail.body.order.status, "delivered");
    assert.ok(detail.body.tracking.length >= 4);
  });

  it("cliente vê timeline do pedido", async () => {
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${userToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.tracking.length > 0);
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

  it("categoria ativa aparece e inativa some da loja", async () => {
    const create = await request(app)
      .post("/api/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Teste-${unique}-vitrine` });
    assert.strictEqual(create.status, 201);
    const id = create.body.category.id;

    const shown = await request(app).get("/api/categories");
    assert.strictEqual(shown.status, 200);
    assert.ok(shown.body.categories.some((c) => c.id === id));

    await request(app)
      .put(`/api/admin/categories/${id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });

    const hidden = await request(app).get("/api/categories");
    assert.strictEqual(hidden.status, 200);
    assert.ok(!hidden.body.categories.some((c) => c.id === id));

    await request(app)
      .del(`/api/admin/categories/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);
  });

  it("lista clientes cadastrados", async () => {
    const res = await request(app)
      .get("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.customers));
  });

  it("cria cliente pelo admin", async () => {
    const email = `teste-admin-cli-${unique}@example.com`;

    const created = await request(app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Cliente Criado Pelo Admin", email, password: "123456" });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.customer.email, email);
    assert.strictEqual(created.body.customer.role, "customer");
    assert.ok(created.body.customer.id);

    const login = await request(app).post("/api/auth/login").send({ email, password: "123456" });
    assert.strictEqual(login.status, 200);

    const list = await request(app)
      .get("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.ok(list.body.customers.some((c) => c.email === email));
  });

  it("rejeita e-mail duplicado ao criar cliente", async () => {
    const res = await request(app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Duplicado",
        email: `teste-admin-cli-${unique}@example.com`,
        password: "123456",
      });
    assert.strictEqual(res.status, 409);
  });

  it("valida dados ao criar cliente pelo admin", async () => {
    const shortPass = await request(app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Cliente", email: `teste-admin-inv-${unique}@example.com`, password: "123" });
    assert.strictEqual(shortPass.status, 400);

    const badEmail = await request(app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Cliente", email: "sem-arroba", password: "123456" });
    assert.strictEqual(badEmail.status, 400);

    const noName = await request(app)
      .post("/api/admin/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "  ", email: `teste-admin-inv2-${unique}@example.com`, password: "123456" });
    assert.strictEqual(noName.status, 400);
  });

  it("bloqueia criação de cliente sem token de admin", async () => {
    const res = await request(app)
      .post("/api/admin/customers")
      .send({ name: "Sem Token", email: `teste-admin-noid-${unique}@example.com`, password: "123456" });
    assert.strictEqual(res.status, 401);
  });

  it("lista e remove mensagens de contato", async () => {
    const res = await request(app)
      .get("/api/admin/contact")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.messages));
  });
});
