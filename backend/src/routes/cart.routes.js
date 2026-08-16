const router = require("express").Router();
const cartController = require("../controllers/cart.controller");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

router.use(requireAuth);

router.get("/", asyncHandler(cartController.getCart));
router.post("/", asyncHandler(cartController.addItem));
router.put("/:product_id", asyncHandler(cartController.updateItem));
router.delete("/:product_id", asyncHandler(cartController.removeItem));

module.exports = router;
