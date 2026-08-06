exports.dashboard = (req, res) => {
  res.render("client/account/dashboard", {
    title: "Mon compte",
    layout: "layouts/client"
  });
};

exports.profile = (req, res) => {
  res.render("client/account/profile", {
    title: "Mon profil",
    layout: "layouts/client"
  });
};

exports.settings = (req, res) => {
  res.render("client/account/settings", {
    title: "Paramètres",
    layout: "layouts/client"
  });
};
