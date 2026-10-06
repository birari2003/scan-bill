const fileService = require('../services/file.service');
const { sendSuccess } = require('../utils/apiResponse');

const update = async (req, res) => {
  sendSuccess(res, await fileService.updateBill(req.user.id, req.params.id, req.body));
};

module.exports = { update };
