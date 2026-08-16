const router = require("express").Router();
const orderController = require("../controllers/order.controller");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

router.use(requireAuth);

router.post("/", asyncHandler(orderController.checkout));
router.get("/", asyncHandler(orderController.listOrders));
router.get("/:id", asyncHandler(orderController.showOrder));

module.exports = router;
