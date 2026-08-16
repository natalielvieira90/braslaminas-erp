const router = require("express").Router();
const productController = require("../controllers/product.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(productController.list));
router.get("/:slug", asyncHandler(productController.show));

router.post("/", requireAuth, requireAdmin, asyncHandler(productController.create));
router.put("/:id", requireAuth, requireAdmin, asyncHandler(productController.update));
router.delete("/:id", requireAuth, requireAdmin, asyncHandler(productController.remove));

module.exports = router;
