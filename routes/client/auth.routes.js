const router = require("express").Router();
const auth = require("../../controllers/client/auth.controller");
const { guestOnly, requireUser } = require("../../middleware/auth");

router.get("/connexion", guestOnly, auth.loginPage);
router.post("/connexion", guestOnly, auth.login);
router.get("/mot-de-passe-oublie", guestOnly, auth.forgotPasswordPage);
router.get("/inscription", guestOnly, auth.registerPage);
router.post("/inscription", guestOnly, auth.register);
router.post("/deconnexion", requireUser, auth.logout);

module.exports = router;
