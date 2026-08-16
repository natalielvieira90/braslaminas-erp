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

async function googleLogin(req, res) {
  const { id_token } = req.body;
  if (!id_token) {
    return res.status(400).json({ error: "Token do Google não informado." });
  }

  let payload;
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`
    );
    if (!response.ok) {
      return res.status(401).json({ error: "Token do Google inválido." });
    }
    payload = await response.json();
  } catch {
    return res.status(401).json({ error: "Falha ao validar token do Google." });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && payload.aud !== clientId) {
    return res.status(401).json({ error: "Client ID do Google não corresponde." });
  }

  if (!payload.email || !payload.email_verified) {
    return res.status(401).json({ error: "E-mail do Google não verificado." });
  }

  const email = payload.email.toLowerCase();
  let user = await userModel.findByEmail(email);

  if (!user) {
    user = await userModel.create({
      name: payload.name || payload.given_name || email.split("@")[0],
      email,
    });
  }

  const { password_hash, ...safeUser } = user;
  res.json({
    token: signToken(safeUser),
    user: safeUser,
  });
}

module.exports = { register, login, me, googleLogin };
