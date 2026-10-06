const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/apiResponse');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    sendError(res, 429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again in a few minutes.'),
});

module.exports = { authLimiter };
