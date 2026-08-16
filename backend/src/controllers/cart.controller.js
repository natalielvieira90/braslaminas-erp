const cartModel = require("../models/cart.model");
const productModel = require("../models/product.model");

async function getCart(req, res) {
  const items = await cartModel.listByUser(req.user.id);
  const total = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  res.json({ items, total });
}

async function addItem(req, res) {
  const { product_id, quantity = 1 } = req.body;

  if (!product_id) {
    return res.status(400).json({ error: "product_id é obrigatório." });
  }
  if (quantity < 1) {
    return res.status(400).json({ error: "Quantidade deve ser maior que zero." });
  }

  const product = await productModel.findById(product_id);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }

  await cartModel.addItem(req.user.id, product_id, quantity);
  const items = await cartModel.listByUser(req.user.id);
  const total = items.reduce((sum, i) => sum + Number(i.subtotal), 0);

  res.status(201).json({ items, total });
}

async function updateItem(req, res) {
  const { product_id } = req.params;
  const { quantity } = req.body;

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "Quantidade inválida." });
  }

  const updated = await cartModel.updateItem(req.user.id, product_id, quantity);
  if (!updated) {
    return res.status(404).json({ error: "Item não encontrado no carrinho." });
  }

  const items = await cartModel.listByUser(req.user.id);
  const total = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  res.json({ items, total });
}

async function removeItem(req, res) {
  const { product_id } = req.params;
  await cartModel.removeItem(req.user.id, product_id);
  const items = await cartModel.listByUser(req.user.id);
  const total = items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  res.json({ items, total });
}

module.exports = { getCart, addItem, updateItem, removeItem };
