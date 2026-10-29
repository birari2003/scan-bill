const { Model } = require('sequelize');

// A "model" (e.g. vehicle/product model) that inventory products can be linked to.
module.exports = (sequelize, DataTypes) => {
  class ProductModel extends Model {
    static associate(models) {
      ProductModel.hasMany(models.Stock, { foreignKey: 'modelId', as: 'stocks' });
    }
  }
  ProductModel.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
      description: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'ProductModel',
      tableName: 'models',
      underscored: true,
    }
  );
  return ProductModel;
};
