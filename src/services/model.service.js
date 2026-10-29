const { ProductModel, Stock, sequelize } = require('../models');
const ApiError = require('../utils/ApiError');

// Each model comes back with how many products are linked to it.
const getAllModels = async () =>
  ProductModel.findAll({
    attributes: {
      include: [[sequelize.literal('(SELECT COUNT(*) FROM stocks WHERE stocks.model_id = ProductModel.id)'), 'productCount']],
    },
    order: [['name', 'ASC']],
  });

const getModelById = async (id) => {
  const model = await ProductModel.findByPk(id);
  if (!model) throw ApiError.notFound('Model not found');
  return model;
};

const assertNameAvailable = async (name, exceptId) => {
  const existing = await ProductModel.findOne({ where: { name } });
  if (existing && existing.id !== exceptId) throw ApiError.conflict(`A model named "${name}" already exists`);
};

const createModel = async (data) => {
  await assertNameAvailable(data.name);
  return ProductModel.create(data);
};

const updateModel = async (id, data) => {
  const model = await getModelById(id);
  await assertNameAvailable(data.name, id);
  return model.update(data);
};

// Linked products are kept; their model_id is set to NULL by the foreign key.
const deleteModel = async (id) => {
  const model = await getModelById(id);
  const unlinked = await Stock.count({ where: { modelId: id } });
  await model.destroy();
  return { id, unlinkedProducts: unlinked };
};

module.exports = { getAllModels, getModelById, createModel, updateModel, deleteModel };
