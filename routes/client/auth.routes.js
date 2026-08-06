const router = require("express").Router();
const auth = require("../../controllers/client/auth.controller");
const { guestOnly } = require("../../middleware/auth");

router.get("/connexion", guestOnly, auth.loginPage);
router.post("/connexion", guestOnly, auth.login);
router.post("/deconnexion", auth.logout);

router.get("/inscription", (req, res) => {
  res.render("client/auth/register", {
    title: "Inscription",
    layout: "layouts/client"
  });
});

module.exports = router;
