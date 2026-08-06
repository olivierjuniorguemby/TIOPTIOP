exports.render = (view, title) => (req, res) => {
  res.render(view, {
    title,
    layout: "layouts/admin"
  });
};
