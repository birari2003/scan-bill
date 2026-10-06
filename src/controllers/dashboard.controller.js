const fileService = require('../services/file.service');
const { sendSuccess } = require('../utils/apiResponse');

const stats = async (req, res) => {
  sendSuccess(res, await fileService.dashboardStats(req.user.id));
};

module.exports = { stats };
