const router = require("express").Router();
const { body } = require("express-validator");
const authController = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório.").isLength({ max: 120 }),
    body("email").isEmail().withMessage("E-mail inválido.").normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Senha deve ter ao menos 6 caracteres."),
  ],
  validate,
  asyncHandler(authController.register)
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("E-mail inválido.").normalizeEmail(),
    body("password").notEmpty().withMessage("Senha é obrigatória."),
  ],
  validate,
  asyncHandler(authController.login)
);

router.get("/me", requireAuth, asyncHandler(authController.me));

module.exports = router;
