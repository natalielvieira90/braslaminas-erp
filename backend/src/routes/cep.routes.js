const router = require("express").Router();
const cepController = require("../controllers/cep.controller");
const asyncHandler = require("../utils/asyncHandler");

router.get("/:cep", asyncHandler(cepController.lookup));

module.exports = router;
