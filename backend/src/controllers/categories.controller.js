const adminModel = require("../models/admin.model");

async function list(req, res) {
  const categories = await adminModel.listActiveCategories();
  res.json({ categories });
}

module.exports = { list };
