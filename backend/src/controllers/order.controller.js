const orderModel = require("../models/order.model");
const cartModel = require("../models/cart.model");
const paymentModel = require("../models/payment.model");
const shippingService = require("../services/shipping");
const paymentService = require("../services/payment");
const trackingModel = require("../models/tracking.model");

function normalizeCep(cep) {
  return String(cep || "").replace(/\D/g, "");
}

async function checkout(req, res) {
  const { payment_method, card, shipping_address, cep, shipping_option_id } = req.body;

  if (!payment_method || !["pix", "credit_card", "boleto"].includes(payment_method)) {
    return res.status(400).json({ error: "Escolha um método de pagamento (pix, credit_card ou boleto)." });
  }

  if (!shipping_address || !String(shipping_address).trim()) {
    return res.status(400).json({ error: "Informe o endereço de entrega." });
  }

  const cepDigits = normalizeCep(cep);
  if (cepDigits.length !== 8) {
    return res.status(400).json({ error: "Informe o CEP de destino." });
  }

  const cartItems = await cartModel.listByUser(req.user.id);
  if (!cartItems.length) {
    return res.status(400).json({ error: "Carrinho vazio." });
  }

  const items = cartItems.map((i) => ({
    product_id: i.product_id,
    name: i.name,
    price: Number(i.price),
    quantity: i.quantity,
    weight: Number(i.weight),
    height: Number(i.height),
    width: Number(i.width),
    length: Number(i.length),
  }));

  // O frete é recalculado no servidor: nunca confiar no preço vindo do front.
  const shippingOption = await shippingService.findOption(cepDigits, items, shipping_option_id);

  const order = await orderModel.create(
    req.user.id,
    items,
    {
      paymentMethod: payment_method,
      shippingAddress: shipping_address,
      cep: cepDigits,
      shippingOption,
      shippingCost: shippingOption.price,
      discount: 0,
    }
  );

  let payment;
  try {
    payment = await paymentService.createPayment({
      order,
      method: payment_method,
      card,
    });
  } catch (err) {
    await orderModel.updateStatus(order.id, "cancelled");
    throw err;
  }

  res.status(201).json({ order, payment });
}

async function listOrders(req, res) {
  const orders = await orderModel.listByUser(req.user.id);
  res.json({ orders });
}

async function showOrder(req, res) {
  const { id } = req.params;
  const order = await orderModel.findById(id);

  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  if (order.user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso negado." });
  }

  const [items, payment, tracking] = await Promise.all([
    orderModel.itemsByOrder(order.id),
    paymentModel.findByOrder(order.id),
    trackingModel.listByOrder(order.id),
  ]);
  res.json({ order, items, payment, tracking });
}

async function simulatePayment(req, res) {
  const { id } = req.params;
  const { outcome = "approved" } = req.body;

  const order = await orderModel.findById(id);
  if (!order) {
    return res.status(404).json({ error: "Pedido não encontrado." });
  }
  if (order.user_id !== req.user.id) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  const paymentWebhook = require("../webhooks/payment.webhook");
  const result = await paymentWebhook.handlePaymentEvent({
    event: outcome === "approved" ? "payment.approved" : "payment.rejected",
    order_id: order.id,
  });

  res.json({ success: true, ...result });
}

module.exports = { checkout, listOrders, showOrder, simulatePayment };
