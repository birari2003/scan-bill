const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { signAccessToken } = require('../utils/jwt');

const buildSession = (user) => {
  const token = signAccessToken(user);
  const { exp } = jwt.decode(token);
  return { user: user.toJSON(), token, expiresAt: exp * 1000 };
};

const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const hashed = await bcrypt.hash(password, env.bcryptSaltRounds);
  const user = await User.create({ name, email, password: hashed, lastLoginAt: new Date() });
  return buildSession(user);
};

const login = async ({ email, password }) => {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  // Same message for unknown email and wrong password to avoid account enumeration.
  const valid = user && (await bcrypt.compare(password, user.password));
  if (!valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  await user.update({ lastLoginAt: new Date() });
  return buildSession(user);
};

const updateProfile = async (user, { name, email }) => {
  if (email && email !== user.email) {
    const taken = await User.findOne({ where: { email } });
    if (taken) throw ApiError.conflict('An account with this email already exists');
  }
  await user.update({ ...(name !== undefined && { name }), ...(email !== undefined && { email }) });
  return user.toJSON();
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
    throw ApiError.validation(
      [{ field: 'currentPassword', message: 'Current password is incorrect' }],
      'Current password is incorrect'
    );
  }
  await user.update({ password: await bcrypt.hash(newPassword, env.bcryptSaltRounds) });
  return { updated: true };
};

module.exports = { register, login, updateProfile, changePassword };
