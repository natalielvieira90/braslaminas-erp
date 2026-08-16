const adminModel = require("../models/admin.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");
const trackingModel = require("../models/tracking.model");
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
  const [items, payment, tracking] = await Promise.all([
    orderModel.itemsByOrder(order.id),
    paymentModel.findByOrder(order.id),
    trackingModel.listByOrder(order.id),
  ]);
  res.json({ order, items, payment, tracking });
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ["pending", "paid", "preparing", "shipped", "in_transit", "out_for_delivery", "delivered", "cancelled"];
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
  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  const paymentWebhook = require("../webhooks/payment.webhook");
  const result = await paymentWebhook.handlePaymentEvent({
    event: "payment.approved",
    order_id: order.id,
  });
  res.json(result);
}

async function refundPayment(req, res) {
  const order = await orderModel.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  const paymentWebhook = require("../webhooks/payment.webhook");
  const result = await paymentWebhook.handlePaymentEvent({
    event: "payment.refunded",
    order_id: order.id,
  });
  res.json(result);
}

const SIMULATE_ACTIONS = {
  approve_payment: { event: "payment.approved", handler: "payment" },
  reject_payment: { event: "payment.rejected", handler: "payment" },
  ship: { event: "shipment.created", handler: "shipping" },
  in_transit: { event: "tracking.in_transit", handler: "shipping" },
  out_for_delivery: { event: "tracking.out_for_delivery", handler: "shipping" },
  delivered: { event: "tracking.delivered", handler: "shipping" },
};

async function simulate(req, res) {
  if (!require("../config").isDemo) {
    return res.status(400).json({ error: "Simulação disponível apenas no modo demo." });
  }

  const { id } = req.params;
  const { action, outcome } = req.body;

  const order = await orderModel.findById(id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }

  if (action === "approve_payment" || action === "reject_payment") {
    const paymentWebhook = require("../webhooks/payment.webhook");
    const result = await paymentWebhook.handlePaymentEvent({
      event: action === "approve_payment" ? "payment.approved" : "payment.rejected",
      order_id: order.id,
    });
    return res.json({ success: true, ...result });
  }

  const mapping = SIMULATE_ACTIONS[action];
  if (!mapping) {
    return res.status(400).json({ error: "Ação de simulação inválida." });
  }

  const shippingWebhook = require("../webhooks/shipping.webhook");
  const result = await shippingWebhook.handleShippingEvent({
    event: mapping.event,
    order_id: order.id,
    option: outcome,
  });
  res.json({ success: true, ...result });
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
  simulate,
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
