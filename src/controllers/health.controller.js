const env = require('../config/env');
const { sequelize } = require('../models');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const health = async (_req, res) => {
  try {
    await sequelize.authenticate();
    sendSuccess(res, {
      status: 'ok',
      database: 'connected',
      ocr: { provider: 'ocr.space', configured: Boolean(env.ocrSpace.apiKey) },
      ai: { provider: 'groq', model: env.groq.model, configured: Boolean(env.groq.apiKey) },
      uptime: process.uptime(),
    });
  } catch {
    sendError(res, 503, 'SERVICE_UNAVAILABLE', 'Database unreachable');
  }
};

module.exports = { health };
