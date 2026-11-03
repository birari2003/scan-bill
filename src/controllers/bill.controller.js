const fileService = require('../services/file.service');
const { sendSuccess } = require('../utils/apiResponse');

const update = async (req, res) => {
  sendSuccess(res, await fileService.updateBill(req.user.id, req.params.id, req.body));
};

const pdf = async (req, res) => {
  const { buffer, fileName } = await fileService.getBillPdf(req.user.id, req.params.id);
  res.attachment(fileName);
  res.type('application/pdf');
  res.send(buffer);
};

module.exports = { update, pdf };
