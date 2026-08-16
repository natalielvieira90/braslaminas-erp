const viaCepService = require("../services/cep/ViaCepService");

async function lookup(req, res) {
  const { cep } = req.params;
  const address = await viaCepService.lookup(cep);
  res.json(address);
}

module.exports = { lookup };
