const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Stock extends Model {
    static associate(models) {
      Stock.belongsTo(models.ProductModel, { foreignKey: 'modelId', as: 'model' });
    }
  }
  Stock.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productName: { type: DataTypes.STRING(255), allowNull: false },
      modelId: { type: DataTypes.UUID, allowNull: true },
      price: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      totalStock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'Stock',
      tableName: 'stocks',
      underscored: true,
    }
  );
  return Stock;
};
