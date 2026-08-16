const router = require("express").Router();
const categoriesController = require("../controllers/categories.controller");
const asyncHandler = require("../utils/asyncHandler");

router.get("/", asyncHandler(categoriesController.list));

module.exports = router;
