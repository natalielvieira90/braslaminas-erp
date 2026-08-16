const contactModel = require("../models/contact.model");

async function submit(req, res) {
  const { name, email, message } = req.body;
  const contact = await contactModel.create({ name, email, message });
  res.status(201).json({ contact });
}

module.exports = { submit };
