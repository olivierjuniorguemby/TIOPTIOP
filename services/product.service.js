const Product = require("../models/product.model");

async function list(filters) {
  return Product.findAll(filters);
}

async function detail(id) {
  const product = await Product.findById(id);
  if (!product) {
    const error = new Error("Produit introuvable");
    error.status = 404;
    throw error;
  }
  return product;
}

module.exports = { list, detail };
