const router = require("express").Router();
const account = require("../../controllers/client/account.controller");
const { requireUser } = require("../../middleware/auth");

router.use(requireUser);
router.get("/compte", account.dashboard);
router.get("/profil", account.profile);
router.get("/parametres", account.settings);
router.get("/paiements-client", (req, res) => {
  res.render("client/account/payments", {
    title: "Moyens de paiement",
    layout: "layouts/client"
  });
});

module.exports = router;
