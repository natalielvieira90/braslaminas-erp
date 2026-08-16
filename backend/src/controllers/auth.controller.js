const bcrypt = require("bcryptjs");
const userModel = require("../models/user.model");
const { signToken } = require("../middleware/auth");

async function register(req, res) {
  const { name, email, password } = req.body;
  const existing = await userModel.findByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "E-mail já cadastrado." });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userModel.create({ name, email, passwordHash });

  res.status(201).json({
    token: signToken(user),
    user,
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const { password_hash, ...safeUser } = user;
  res.json({
    token: signToken(safeUser),
    user: safeUser,
  });
}

async function me(req, res) {
  const user = await userModel.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }
  res.json({ user });
}

module.exports = { register, login, me };
