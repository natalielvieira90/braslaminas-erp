const router = require("express").Router();
const adminController = require("../controllers/admin.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

router.use(requireAuth, requireAdmin);

router.get("/dashboard", asyncHandler(adminController.dashboard));

router.get("/products", asyncHandler(adminController.listProducts));

router.get("/orders", asyncHandler(adminController.listOrders));
router.get("/orders/:id", asyncHandler(adminController.showOrder));
router.put("/orders/:id/status", asyncHandler(adminController.updateStatus));
router.put("/orders/:id/tracking", asyncHandler(adminController.updateTracking));
router.post("/orders/:id/confirm-payment", asyncHandler(adminController.confirmPayment));
router.post("/orders/:id/refund", asyncHandler(adminController.refundPayment));
router.post("/orders/:id/simulate", asyncHandler(adminController.simulate));

router.get("/categories", asyncHandler(adminController.listCategories));
router.post("/categories", asyncHandler(adminController.createCategory));
router.put("/categories/:id", asyncHandler(adminController.updateCategory));
router.delete("/categories/:id", asyncHandler(adminController.removeCategory));

router.get("/customers", asyncHandler(adminController.listCustomers));
router.post("/customers", asyncHandler(adminController.createCustomer));
router.get("/customers/:id", asyncHandler(adminController.showCustomer));

router.get("/contact", asyncHandler(adminController.listContact));
router.delete("/contact/:id", asyncHandler(adminController.removeContact));

module.exports = router;
