const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/apiResponse');

const register = async (req, res) => {
  const session = await authService.register(req.body);
  sendSuccess(res, session, 201);
};

const login = async (req, res) => {
  const session = await authService.login(req.body);
  sendSuccess(res, session);
};

const me = async (req, res) => {
  sendSuccess(res, req.user.toJSON());
};

const updateProfile = async (req, res) => {
  sendSuccess(res, await authService.updateProfile(req.user, req.body));
};

const changePassword = async (req, res) => {
  sendSuccess(res, await authService.changePassword(req.user.id, req.body));
};

// JWTs are stateless; the client discards its token. Endpoint kept for API symmetry
// and as the hook for token revocation later.
const logout = async (_req, res) => {
  sendSuccess(res, { loggedOut: true });
};

module.exports = { register, login, me, updateProfile, changePassword, logout };
