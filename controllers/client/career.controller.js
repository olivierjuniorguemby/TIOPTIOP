const careerService = require("../../services/career.service");

exports.list = async (req, res, next) => {
  try {
    const jobs = await careerService.listJobs();
    res.render("client/careers/list", {
      title: "Carrières",
      layout: "layouts/client",
      jobs
    });
  } catch (error) {
    next(error);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const job = await careerService.jobDetail(req.params.id);
    res.render("client/careers/detail", {
      title: job.title,
      layout: "layouts/client",
      job
    });
  } catch (error) {
    next(error);
  }
};

exports.apply = async (req, res, next) => {
  try {
    const result = await careerService.submitApplication(
      req.body,
      req.files,
      req.session?.user?.id || null
    );
    req.session.flashSuccess = `Votre candidature est bien partie. Référence : ${result.reference}`;
    res.redirect(`/emploi/${req.body.job_id}`);
  } catch (error) {
    next(error);
  }
};
