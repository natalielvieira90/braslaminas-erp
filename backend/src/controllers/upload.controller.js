function image(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }
  res.status(201).json({ url: `/images/produtos/${req.file.filename}` });
}

module.exports = { image };
