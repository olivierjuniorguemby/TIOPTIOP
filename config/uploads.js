const fs = require("fs");
const path = require("path");
const multer = require("multer");

const root = path.join(__dirname, "..", "uploads");
const folders = {
  products: path.join(root, "products"),
  profiles: path.join(root, "profiles"),
  restaurants: path.join(root, "restaurants"),
  careers: path.join(root, "careers"),
  cms: path.join(root, "cms"),
  promotions: path.join(root, "promotions"),
  formulas: path.join(root, "formulas"),
  temp: path.join(root, "temp")
};

Object.values(folders).forEach((folder) => {
  fs.mkdirSync(folder, { recursive: true });
});

function safeName(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function createUpload(folder, allowedTypes) {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, folders[folder]),
      filename: (_req, file, callback) => {
        callback(null, `${Date.now()}-${safeName(file.originalname)}`);
      }
    }),
    limits: {
      fileSize: Number(process.env.UPLOAD_MAX_MB || 12) * 1024 * 1024
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedTypes.includes(file.mimetype)) {
        return callback(new Error(`Type de fichier non autorisé : ${file.mimetype}`));
      }
      callback(null, true);
    }
  });
}

const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const documentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

module.exports = {
  folders,
  productUpload: createUpload("products", imageTypes),
  profileUpload: createUpload("profiles", imageTypes),
  restaurantUpload: createUpload("restaurants", imageTypes),
  careerUpload: createUpload("careers", documentTypes),
  cmsUpload: createUpload("cms", imageTypes),
  promotionUpload: createUpload("promotions", imageTypes),
  formulaUpload: createUpload("formulas", imageTypes)
};
