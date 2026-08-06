const { randomUUID } = require("crypto");
const Job = require("../models/job.model");
const Application = require("../models/application.model");

async function listJobs() {
  return Job.findAll();
}

async function jobDetail(id) {
  const job = await Job.findById(id);
  if (!job) {
    const error = new Error("Offre introuvable");
    error.status = 404;
    throw error;
  }
  return job;
}

async function submitApplication(body, files, userId = null) {
  const reference = `TIOP-JOB-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const applicationId = await Application.create({
    publicId: randomUUID(),
    reference,
    jobId: body.job_id,
    userId,
    firstName: body.first_name,
    lastName: body.last_name,
    email: body.email,
    phone: body.phone,
    experience: body.experience,
    availability: body.availability,
    coverMessage: body.cover_message
  });

  for (const file of files || []) {
    await Application.addDocument(applicationId, file);
  }

  return { applicationId, reference };
}

module.exports = { listJobs, jobDetail, submitApplication };
