const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { userDir } = require('../utils/fileStorage');

const ALLOWED_TYPES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => cb(null, userDir(req.user.id)),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${ALLOWED_TYPES[file.mimetype]}`),
});

const uploader = multer({
  storage,
  limits: { fileSize: env.upload.maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(ApiError.badRequest('Unsupported file type. Upload a PDF, JPG, PNG or WEBP file.'));
    }
    cb(null, true);
  },
});

// Wraps multer so its errors become ApiErrors with friendly messages.
const uploadSingle = (field) => (req, res, next) => {
  uploader.single(field)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds the ${Math.round(env.upload.maxBytes / 1024 / 1024)} MB limit`
          : err.message;
      return next(ApiError.badRequest(message));
    }
    if (err) return next(err);
    if (!req.file) return next(ApiError.badRequest(`No file uploaded (expected form field "${field}")`));
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    req.file.extension = path.extname(req.file.filename);
    next();
  });
};

module.exports = { uploadSingle, ALLOWED_TYPES };
