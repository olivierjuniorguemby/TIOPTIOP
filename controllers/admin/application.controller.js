const Application = require("../../models/application.model");

exports.index = async (req, res, next) => {
  try {
    const applications = await Application.findAllForAdmin();
    res.render("admin/content/applications", {
      title: "Candidatures",
      layout: "layouts/admin",
      applications
    });
  } catch (error) {
    next(error);
  }
};
