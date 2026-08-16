const router = require("express").Router();
const jwt = require("jsonwebtoken");
const shippingController = require("../controllers/shipping.controller");
const config = require("../config");
const asyncHandler = require("../utils/asyncHandler");

// Autenticação opcional: permite cotar com items explícitos sem login,
// e usar o carrinho do usuário quando estiver logado.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, config.jwt.secret);
    } catch {
      req.user = null;
    }
  }
  next();
}

router.get("/quote", optionalAuth, asyncHandler(shippingController.quote));
router.get("/tracking/:code", asyncHandler(shippingController.getTracking));

module.exports = router;
