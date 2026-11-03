const { Stock, ProductModel, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');

const withModel = { include: [{ model: ProductModel, as: 'model', attributes: ['id', 'name'] }] };

// '' / undefined from the form means "no model"; any other id must exist.
const resolveModelId = async (modelId) => {
  if (modelId === undefined) return undefined;
  if (!modelId) return null;
  if (!(await ProductModel.findByPk(modelId))) throw ApiError.badRequest('Selected model does not exist');
  return modelId;
};

// newStock is the quantity just brought in: it tops up both counters and is kept as
// the last restock. Sent as 0 it adds nothing and the previous restock stays on record.
const applyNewStock = (data, stock = {}) => {
  const { newStock: rawNewStock, ...fields } = data;
  const newStock = Number(rawNewStock ?? 0);
  if (!Number.isInteger(newStock) || newStock < 0) {
    throw ApiError.badRequest('New stock must be a whole number, 0 or more');
  }
  if (!newStock) return fields;
  return {
    ...fields,
    newStock,
    quantity: Number(fields.quantity ?? stock.quantity ?? 0) + newStock,
    totalStock: Number(fields.totalStock ?? stock.totalStock ?? 0) + newStock,
  };
};

const getAllStocks = async () => Stock.findAll(withModel);

const getStockById = async (id) => {
  const stock = await Stock.findByPk(id, withModel);
  if (!stock) throw new ApiError(404, 'NOT_FOUND', 'Stock not found');
  return stock;
};

const createStock = async (data) => {
  const stock = await Stock.create({ ...applyNewStock(data), modelId: await resolveModelId(data.modelId) });
  return getStockById(stock.id);
};

const updateStock = async (id, data) => {
  const stock = await Stock.findByPk(id);
  if (!stock) throw new ApiError(404, 'NOT_FOUND', 'Stock not found');
  const modelId = await resolveModelId(data.modelId);
  const fields = applyNewStock(data, stock);
  await stock.update(modelId === undefined ? fields : { ...fields, modelId });
  return getStockById(id);
};

const deleteStock = async (id) => {
  const stock = await Stock.findByPk(id);
  if (!stock) throw new ApiError(404, 'NOT_FOUND', 'Stock not found');
  await stock.destroy();
  return { id };
};

const adjustStockForItems = async (items, multiplier, transaction) => {
  for (const item of items) {
    if (!item.particular || !item.qty) continue;
    const stock = await Stock.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('product_name')),
        sequelize.fn('LOWER', item.particular.trim())
      ),
      transaction,
    });
    if (stock) {
      await stock.increment('quantity', { by: item.qty * multiplier, transaction });
    }
  }
};

module.exports = { getAllStocks, getStockById, createStock, updateStock, deleteStock, adjustStockForItems };
