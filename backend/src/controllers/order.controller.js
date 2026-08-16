const orderModel = require("../models/order.model");
const cartModel = require("../models/cart.model");
const paymentModel = require("../models/payment.model");

async function checkout(req, res) {
  const { payment_method, card, shipping_address } = req.body;

  if (!payment_method || !["pix", "credit_card", "boleto"].includes(payment_method)) {
    return res.status(400).json({ error: "Escolha um método de pagamento (pix, credit_card ou boleto)." });
  }

  if (!shipping_address || !String(shipping_address).trim()) {
    return res.status(400).json({ error: "Informe o endereço de entrega." });
  }

  const cartItems = await cartModel.listByUser(req.user.id);

  if (!cartItems.length) {
    return res.status(400).json({ error: "Carrinho vazio." });
  }

  const order = await orderModel.create(
    req.user.id,
    cartItems.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    { paymentMethod: payment_method, shippingAddress: shipping_address }
  );

  let payment;
  try {
    payment = await paymentModel.create(order.id, {
      method: payment_method,
      amount: order.total,
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

  const [items, payment] = await Promise.all([
    orderModel.itemsByOrder(order.id),
    paymentModel.findByOrder(order.id),
  ]);
  res.json({ order, items, payment });
}

module.exports = { checkout, listOrders, showOrder };
