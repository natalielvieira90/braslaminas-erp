const productModel = require("../models/product.model");

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function list(req, res) {
  const { category, search } = req.query;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const offset = parseInt(req.query.offset, 10) || 0;

  const products = await productModel.list({ category, search, limit, offset });
  res.json({ products, limit, offset, count: products.length });
}

async function show(req, res) {
  const { slug } = req.params;
  const product = await productModel.findBySlug(slug);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }
  res.json({ product });
}

async function create(req, res) {
  const { name, description, price, stock, category, image_url, weight, height, width, length } = req.body;

  if (!name || price == null) {
    return res.status(400).json({ error: "Nome e preço são obrigatórios." });
  }

  const slug = req.body.slug || slugify(name);
  const product = await productModel.create({
    name,
    slug,
    description,
    price,
    stock: stock ?? 0,
    category,
    imageUrl: image_url,
    weight,
    height,
    width,
    length,
  });

  res.status(201).json({ product });
}

async function update(req, res) {
  const { id } = req.params;
  const product = await productModel.update(id, req.body);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }
  res.json({ product });
}

async function remove(req, res) {
  const { id } = req.params;
  const product = await productModel.findById(id);
  if (!product) {
    return res.status(404).json({ error: "Produto não encontrado." });
  }
  await productModel.remove(id);
  res.status(204).end();
}

module.exports = { list, show, create, update, remove };
