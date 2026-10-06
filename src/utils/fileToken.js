const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Short-lived, file-scoped tokens so <img>/<iframe> can load protected files
// (browsers can't attach an Authorization header to those requests).
const AUDIENCE = 'file-content';

const signFileToken = (fileId, userId) =>
  jwt.sign({ sub: fileId, uid: userId }, env.jwt.secret, { audience: AUDIENCE, expiresIn: env.upload.urlTtl });

const verifyFileToken = (token) => jwt.verify(token, env.jwt.secret, { audience: AUDIENCE });

module.exports = { signFileToken, verifyFileToken };
