const { Stock, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');

const getAllStocks = async () => Stock.findAll();

const getStockById = async (id) => {
  const stock = await Stock.findByPk(id);
  if (!stock) throw new ApiError(404, 'NOT_FOUND', 'Stock not found');
  return stock;
};

const createStock = async (data) => Stock.create(data);

const updateStock = async (id, data) => {
  const stock = await Stock.findByPk(id);
  if (!stock) throw new ApiError(404, 'NOT_FOUND', 'Stock not found');
  return stock.update(data);
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
