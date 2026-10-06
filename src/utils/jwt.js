const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAccessToken = (user) =>
  jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });

const verifyAccessToken = (token) => jwt.verify(token, env.jwt.secret);

module.exports = { signAccessToken, verifyAccessToken };
