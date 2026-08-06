const router = require("express").Router();
const productService = require("../../services/product.service");

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: process.env.APP_NAME || "TiopTiop",
    database: "mysql"
  });
});

router.get("/products", async (req, res, next) => {
  try {
    res.json(await productService.list(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/products/:id", async (req, res, next) => {
  try {
    res.json(await productService.detail(req.params.id));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
