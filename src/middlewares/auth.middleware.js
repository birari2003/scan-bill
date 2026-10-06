const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');

const authenticate = async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized();
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired or invalid. Please sign in again.');
  }

  const user = await User.findByPk(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Account no longer exists');
  }

  req.user = user;
  next();
};

const authorize = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw ApiError.forbidden();
  }
  next();
};

module.exports = { authenticate, authorize };
