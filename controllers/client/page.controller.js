const productService = require("../../services/product.service");

function render(view, title, data = {}) {
  return { view, options: { title, layout: "layouts/client", ...data } };
}

exports.home = async (req, res, next) => {
  try {
    const products = await productService.list({});
    const page = render("client/home", "Accueil", { products: products.slice(0, 8) });
    res.render(page.view, page.options);
  } catch (error) {
    next(error);
  }
};

exports.menu = async (req, res, next) => {
  try {
    const products = await productService.list(req.query);
    const page = render("client/catalog/menu", "Menu", { products });
    res.render(page.view, page.options);
  } catch (error) {
    next(error);
  }
};

exports.product = async (req, res, next) => {
  try {
    const product = await productService.detail(req.params.id);
    const page = render("client/catalog/product", product.name, { product });
    res.render(page.view, page.options);
  } catch (error) {
    next(error);
  }
};

exports.staticPage = (view, title) => (req, res) => {
  const page = render(view, title);
  res.render(page.view, page.options);
};
