const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "..", "frontend", "images", "produtos"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem não permitido (use JPG, PNG, WEBP, GIF ou SVG)."));
    }
    cb(null, true);
  },
});

module.exports = upload;
