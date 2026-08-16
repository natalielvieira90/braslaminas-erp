const orderModel = require("../models/order.model");
const cartModel = require("../models/cart.model");

async function checkout(req, res) {
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
    }))
  );

  res.status(201).json({ order });
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

  const items = await orderModel.itemsByOrder(order.id);
  res.json({ order, items });
}

module.exports = { checkout, listOrders, showOrder };
