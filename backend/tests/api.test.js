const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const pool = require("../src/config/db");
const app = require("../src/app");

const unique = Date.now();

after(async () => {
  await pool.query("DELETE FROM contacts WHERE email LIKE $1", [`teste-%@example.com`]);
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`teste-%@example.com`]);
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
