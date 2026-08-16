const adminModel = require("../models/admin.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");
const productModel = require("../models/product.model");

async function dashboard(req, res) {
  const { de, ate } = req.query;
  const data = await adminModel.dashboard({ from: de, to: ate });
  res.json({ metrics: data });
}

async function listOrders(req, res) {
  const { status, busca } = req.query;
  const limit = Math.min(parseInt(req.query.limite, 10) || 100, 500);
  const offset = parseInt(req.query.offset, 10) || 0;
  const orders = await orderModel.listAdmin({ status, search: busca, limit, offset });
  res.json({ orders, limit, offset, count: orders.length });
}

async function showOrder(req, res) {
  const { id } = req.params;
  const order = await orderModel.findById(id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  const [items, payment] = await Promise.all([
    orderModel.itemsByOrder(order.id),
    paymentModel.findByOrder(order.id),
  ]);
  res.json({ order, items, payment });
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ["pending", "paid", "shipped", "delivered", "cancelled"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }
  const order = await orderModel.updateStatus(id, status);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  res.json({ order });
}

async function updateTracking(req, res) {
  const { id } = req.params;
  const trackingCode = (req.body.tracking_code || "").trim();
  const order = await orderModel.updateTracking(id, trackingCode || null);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  res.json({ order });
}

async function confirmPayment(req, res) {
  const { id } = req.params;
  const order = await orderModel.findById(id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }

  const payment = await paymentModel.findByOrder(id);
  if (!payment) {
    return res.status(404).json({ error: "Pagamento não encontrado." });
  }

  const updated = await paymentModel.confirm(payment.id);
  if (!updated) {
    return res.status(400).json({ error: "Pagamento já confirmado ou não pode ser confirmado." });
  }

  await orderModel.updatePaymentStatus(id, "paid");
  if (order.status === "pending") {
    await orderModel.updateStatus(id, "paid");
  }

  res.json({ payment: updated, order: await orderModel.findById(id) });
}

async function refundPayment(req, res) {
  const { id } = req.params;
  const order = await orderModel.findById(id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }

  const payment = await paymentModel.findByOrder(id);
  if (!payment) {
    return res.status(404).json({ error: "Pagamento não encontrado." });
  }

  const updated = await paymentModel.refund(payment.id);
  if (!updated) {
    return res.status(400).json({ error: "Pagamento não está pago para ser estornado." });
  }

  await orderModel.updatePaymentStatus(id, "refunded");
  if (order.status === "paid") {
    await orderModel.updateStatus(id, "cancelled");
  }

  res.json({ payment: updated, order: await orderModel.findById(id) });
}

async function listCategories(req, res) {
  const categories = await adminModel.listCategories();
  res.json({ categories });
}

async function createCategory(req, res) {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Nome da categoria é obrigatório." });
  }
  const category = await adminModel.createCategory(String(name).trim());
  res.status(201).json({ category });
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, active } = req.body;

  const existing = await adminModel.findCategoryById(id);
  if (!existing) {
    return res.status(404).json({ error: "Categoria não encontrada." });
  }

  const updates = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (active !== undefined) updates.active = Boolean(active);

  const category = await adminModel.updateCategory(id, updates);
  if (updates.name) {
    await adminModel.syncCategoryName(id, updates.name);
  }
  res.json({ category });
}

async function removeCategory(req, res) {
  const removed = await adminModel.removeCategory(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Categoria não encontrada." });
  }
  res.status(204).end();
}

async function listCustomers(req, res) {
  const customers = await adminModel.listCustomers({ search: req.query.busca });
  res.json({ customers });
}

async function showCustomer(req, res) {
  const customer = await adminModel.customerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: "Cliente não encontrado." });
  }
  const orders = await adminModel.customerOrders(customer.id);
  res.json({ customer, orders });
}

async function listContact(req, res) {
  const messages = await adminModel.listContactMessages();
  res.json({ messages });
}

async function removeContact(req, res) {
  const removed = await adminModel.removeContactMessage(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Mensagem não encontrada." });
  }
  res.status(204).end();
}

async function listProducts(req, res) {
  const { busca } = req.query;
  const products = await productModel.list({
    search: busca,
    active: null,
    limit: 500,
    offset: 0,
  });
  res.json({ products });
}

module.exports = {
  dashboard,
  listOrders,
  showOrder,
  updateStatus,
  updateTracking,
  confirmPayment,
  refundPayment,
  listCategories,
  createCategory,
  updateCategory,
  removeCategory,
  listCustomers,
  showCustomer,
  listContact,
  removeContact,
  listProducts,
};
