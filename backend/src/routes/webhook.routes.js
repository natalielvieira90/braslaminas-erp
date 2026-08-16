const router = require("express").Router();
const paymentWebhook = require("../webhooks/payment.webhook");
const shippingWebhook = require("../webhooks/shipping.webhook");
const config = require("../config");
const asyncHandler = require("../utils/asyncHandler");

function verifySecret(req, res, next) {
  if (config.isDemo) return next();
  const secret = config[req.params.provider === "payment" ? "mercadopago" : "melhorEnvio"].webhookSecret;
  const received = req.headers["x-webhook-secret"];
  if (!secret || received !== secret) {
    return res.status(401).json({ error: "Assinatura de webhook inválida." });
  }
  next();
}

router.post(
  "/:provider/payment",
  verifySecret,
  asyncHandler(async (req, res) => {
    const result = await paymentWebhook.handlePaymentEvent(req.body);
    res.json({ success: true, ...result });
  })
);

router.post(
  "/:provider/shipping",
  verifySecret,
  asyncHandler(async (req, res) => {
    const result = await shippingWebhook.handleShippingEvent(req.body);
    res.json({ success: true, ...result });
  })
);

module.exports = router;
