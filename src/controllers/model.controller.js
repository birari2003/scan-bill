const modelService = require('../services/model.service');
const { sendSuccess } = require('../utils/apiResponse');

const getAll = async (req, res) => {
  sendSuccess(res, await modelService.getAllModels());
};

const getById = async (req, res) => {
  sendSuccess(res, await modelService.getModelById(req.params.id));
};

const create = async (req, res) => {
  sendSuccess(res, await modelService.createModel(req.body), 201);
};

const update = async (req, res) => {
  sendSuccess(res, await modelService.updateModel(req.params.id, req.body));
};

const remove = async (req, res) => {
  sendSuccess(res, await modelService.deleteModel(req.params.id));
};

module.exports = { getAll, getById, create, update, remove };
