const router = require("express").Router();
const { body } = require("express-validator");
const contactController = require("../controllers/contact.controller");
const validate = require("../middleware/validate");
const asyncHandler = require("../utils/asyncHandler");

router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório.").isLength({ max: 120 }),
    body("email").isEmail().withMessage("E-mail inválido.").normalizeEmail(),
    body("message").trim().notEmpty().withMessage("Mensagem é obrigatória.").isLength({ max: 2000 }),
  ],
  validate,
  asyncHandler(contactController.submit)
);

module.exports = router;
