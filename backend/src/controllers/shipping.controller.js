const shippingService = require("../services/shipping");
const cartModel = require("../models/cart.model");
const productModel = require("../models/product.model");

function normalizeCep(cep) {
  return String(cep || "").replace(/\D/g, "");
}

async function resolveItems(req) {
  let items = null;

  if (req.query.items) {
    try {
      items = JSON.parse(req.query.items);
    } catch {
      const err = new Error("Parâmetro items inválido.");
      err.status = 400;
      throw err;
    }
  }

  if (!items && req.user) {
    const cart = await cartModel.listByUser(req.user.id);
    items = cart.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
    }));
  }

  if (!items || !Array.isArray(items) || !items.length) {
    const err = new Error("Informe os itens do pedido para cotar o frete.");
    err.status = 400;
    throw err;
  }

  const productIds = items.map((i) => i.product_id);
  const products = [];
  for (const id of productIds) {
    const product = await productModel.findById(id);
    if (!product) {
      const err = new Error("Produto não encontrado na cotação.");
      err.status = 400;
      throw err;
    }
    products.push(product);
  }

  return items.map((i) => {
    const product = products.find((p) => p.id === i.product_id);
    return {
      product_id: i.product_id,
      quantity: i.quantity,
      name: product.name,
      price: Number(product.price),
      weight: Number(product.weight),
      height: Number(product.height),
      width: Number(product.width),
      length: Number(product.length),
    };
  });
}

async function quote(req, res) {
  const cepDestino = normalizeCep(req.query.cep_destino);
  if (cepDestino.length !== 8) {
    return res.status(400).json({ error: "CEP de destino inválido." });
  }

  const items = await resolveItems(req);
  const options = await shippingService.calculateQuote(cepDestino, items);

  res.json({ success: true, cep_destino: cepDestino, items, options });
}

async function getTracking(req, res) {
  const { code } = req.params;
  const tracking = await shippingService.getTracking(code);
  res.json(tracking);
}

module.exports = { quote, getTracking };
