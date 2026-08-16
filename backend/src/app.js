require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { notFound, errorHandler } = require("./middleware/error");
const config = require("./config");

const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const cartRoutes = require("./routes/cart.routes");
const orderRoutes = require("./routes/order.routes");
const uploadRoutes = require("./routes/upload.routes");
const contactRoutes = require("./routes/contact.routes");
const adminRoutes = require("./routes/admin.routes");
const cepRoutes = require("./routes/cep.routes");
const shippingRoutes = require("./routes/shipping.routes");
const webhookRoutes = require("./routes/webhook.routes");
const categoriesRoutes = require("./routes/categories.routes");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente mais tarde." },
});
app.use("/api", apiLimiter);

app.use("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "braslaminas-api",
    appMode: config.appMode,
    paymentProvider: config.paymentProvider,
    shippingProvider: config.shippingProvider,
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/cep", cepRoutes);
app.use("/api/shipping", shippingRoutes);
app.use("/api/webhooks", webhookRoutes);

const frontendDir = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendDir));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
