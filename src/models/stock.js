const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Stock extends Model {}
  Stock.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      productName: { type: DataTypes.STRING(255), allowNull: false },
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
