const router = require("express").Router();
const uploadController = require("../controllers/upload.controller");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.post("/image", requireAuth, requireAdmin, upload.single("image"), uploadController.image);

module.exports = router;
