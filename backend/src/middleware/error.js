const multer = require("multer");

function notFound(req, res, next) {
  res.status(404).json({ error: "Rota não encontrada." });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.type === "validation") {
    return res.status(400).json({ error: "Dados inválidos.", details: err.errors });
  }

  if (err.code === "23505") {
    return res.status(409).json({ error: "Registro duplicado." });
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "Arquivo muito grande (máximo 5MB)." : err.message;
    return res.status(400).json({ error: message });
  }

  if (err.message && err.message.includes("não permitido")) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: "Erro interno do servidor." });
}

module.exports = { notFound, errorHandler };
