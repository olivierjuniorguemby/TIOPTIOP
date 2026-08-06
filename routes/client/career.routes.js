const router = require("express").Router();
const career = require("../../controllers/client/career.controller");
const { careerUpload } = require("../../config/uploads");

router.get("/carrieres", career.list);
router.get("/emploi/:id", career.detail);
router.post("/candidatures", careerUpload.array("documents", 5), career.apply);

module.exports = router;
