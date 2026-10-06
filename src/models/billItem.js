const { Model } = require('sequelize');

const asNumber = (DataTypes, field, type, defaultValue) => ({
  type,
  allowNull: false,
  defaultValue,
  get() {
    const raw = this.getDataValue(field);
    return raw === null || raw === undefined ? 0 : Number(raw);
  },
});

module.exports = (sequelize, DataTypes) => {
  class BillItem extends Model {
    static associate(models) {
      BillItem.belongsTo(models.Bill, { foreignKey: 'billId', as: 'bill' });
    }
  }

  BillItem.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      billId: { type: DataTypes.UUID, allowNull: false },
      srNo: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      particular: { type: DataTypes.STRING(500), allowNull: false },
      rate: asNumber(DataTypes, 'rate', DataTypes.DECIMAL(14, 2), 0),
      qty: asNumber(DataTypes, 'qty', DataTypes.DECIMAL(10, 3), 1),
      amount: asNumber(DataTypes, 'amount', DataTypes.DECIMAL(14, 2), 0),
      confidence: DataTypes.FLOAT,
    },
    {
      sequelize,
      modelName: 'BillItem',
      tableName: 'bill_items',
      underscored: true,
    }
  );

  return BillItem;
};
