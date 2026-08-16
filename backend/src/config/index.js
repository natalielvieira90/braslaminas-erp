require("dotenv").config();

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

const config = {
  port: Number(process.env.PORT) || 3000,

  appMode: (process.env.APP_MODE || "demo").toLowerCase(),
  isDemo: (process.env.APP_MODE || "demo").toLowerCase() !== "production",

  paymentProvider: (process.env.PAYMENT_PROVIDER || "demo").toLowerCase(),
  shippingProvider: (process.env.SHIPPING_PROVIDER || "demo").toLowerCase(),
  viaCepEnabled: bool(process.env.VIACEP_ENABLED, true),
  providerTimeoutMs: Number(process.env.PROVIDER_TIMEOUT_MS) || 5000,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  mercadopago: {
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || "",
    publicKey: process.env.MERCADOPAGO_PUBLIC_KEY || "",
    webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET || "",
  },

  melhorEnvio: {
    token: process.env.MELHOR_ENVIO_TOKEN || "",
    webhookSecret: process.env.MELHOR_ENVIO_WEBHOOK_SECRET || "",
  },
};

module.exports = config;
