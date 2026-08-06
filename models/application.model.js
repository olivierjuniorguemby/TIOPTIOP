const db = require("../config/database");

async function create(data) {
  const result = await db.query(
    `INSERT INTO job_applications
      (public_id, reference, job_id, user_id, first_name, last_name,
       email, phone, experience, availability, cover_message, source, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "CAREERS_WEB", "NEW")`,
    [
      data.publicId,
      data.reference,
      data.jobId,
      data.userId || null,
      data.firstName,
      data.lastName,
      data.email,
      data.phone,
      data.experience || null,
      data.availability || null,
      data.coverMessage || null
    ]
  );
  return result.insertId;
}

async function addDocument(applicationId, file) {
  return db.query(
    `INSERT INTO job_application_documents
      (application_id, document_type, file_name, file_url, mime_type, file_size)
     VALUES (?, "CV", ?, ?, ?, ?)`,
    [
      applicationId,
      file.originalname,
      `/uploads/careers/${file.filename}`,
      file.mimetype,
      file.size
    ]
  );
}

async function findAllForAdmin() {
  return db.query(
    `SELECT a.*, j.title AS job_title,
      (SELECT d.file_url
       FROM job_application_documents d
       WHERE d.application_id = a.id
       ORDER BY d.id
       LIMIT 1) AS cv_url
     FROM job_applications a
     INNER JOIN jobs j ON j.id = a.job_id
     ORDER BY a.created_at DESC`
  );
}

module.exports = { create, addDocument, findAllForAdmin };
