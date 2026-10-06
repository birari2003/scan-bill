const fileService = require('../services/file.service');
const ApiError = require('../utils/ApiError');
const { filePath } = require('../utils/fileStorage');
const { verifyFileToken } = require('../utils/fileToken');
const { sendSuccess } = require('../utils/apiResponse');
const env = require('../config/env');

const upload = async (req, res) => {
  const file = await fileService.createUpload(req.user.id, req.file);
  sendSuccess(res, file, 201);
};

const list = async (req, res) => {
  sendSuccess(res, await fileService.listFiles(req.user.id, req.validated.query));
};

const recent = async (req, res) => {
  sendSuccess(res, await fileService.recentFiles(req.user.id, req.validated.query.limit));
};

const getOne = async (req, res) => {
  sendSuccess(res, await fileService.getFile(req.user.id, req.params.id));
};

const reprocess = async (req, res) => {
  sendSuccess(res, await fileService.reprocessFile(req.user.id, req.params.id), 202);
};

const remove = async (req, res) => {
  sendSuccess(res, await fileService.deleteFile(req.user.id, req.params.id));
};

// Authorised by a signed, file-scoped token in the query string (see utils/fileToken.js).
const content = async (req, res) => {
  let payload;
  try {
    payload = verifyFileToken(String(req.query.token || ''));
  } catch {
    throw ApiError.unauthorized('File link expired. Refresh the page to get a new one.');
  }
  if (payload.sub !== req.params.id) throw ApiError.forbidden();

  const file = await fileService.getFileForDownload(req.params.id, payload.uid);
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  // Allow the frontend to embed PDFs in an <iframe> and images cross-origin.
  res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${env.clientUrl}`);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.removeHeader('X-Frame-Options');
  res.sendFile(filePath(file.userId, file.storedName));
};

module.exports = { upload, list, recent, getOne, reprocess, remove, content };
