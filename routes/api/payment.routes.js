const router = require("express").Router();
const payment = require("../../controllers/api/payment.controller");

router.post("/mtn-momo/callback", payment.mtnMomoCallback);
router.put("/mtn-momo/callback", payment.mtnMomoCallback);

module.exports = router;
