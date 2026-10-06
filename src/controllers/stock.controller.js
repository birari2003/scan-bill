const stockService = require('../services/stock.service');
const { sendSuccess } = require('../utils/apiResponse');

const getAll = async (req, res) => {
  const stocks = await stockService.getAllStocks();
  sendSuccess(res, stocks);
};

const getById = async (req, res) => {
  const stock = await stockService.getStockById(req.params.id);
  sendSuccess(res, stock);
};

const create = async (req, res) => {
  const stock = await stockService.createStock(req.body);
  sendSuccess(res, stock, 201);
};

const update = async (req, res) => {
  const stock = await stockService.updateStock(req.params.id, req.body);
  sendSuccess(res, stock);
};

const remove = async (req, res) => {
  const result = await stockService.deleteStock(req.params.id);
  sendSuccess(res, result);
};

module.exports = { getAll, getById, create, update, remove };
