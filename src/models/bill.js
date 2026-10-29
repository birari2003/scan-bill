const { Model } = require('sequelize');

const DOCUMENT_TYPES = ['bill', 'invoice', 'quotation', 'estimate', 'job_card', 'receipt', 'other'];
const GST_TYPES = ['none', 'default', 'custom'];
const DEFAULT_GST_RATE = 18;

// DECIMAL columns come back from mysql2 as strings; expose them as numbers.
const decimal = (DataTypes, field, defaultValue = 0, precision = 14) => ({
  type: DataTypes.DECIMAL(precision, 2),
  allowNull: false,
  defaultValue,
  get() {
    const raw = this.getDataValue(field);
    return raw === null || raw === undefined ? 0 : Number(raw);
  },
});

module.exports = (sequelize, DataTypes) => {
  class Bill extends Model {
    static associate(models) {
      Bill.belongsTo(models.File, { foreignKey: 'fileId', as: 'file' });
      Bill.hasMany(models.BillItem, { foreignKey: 'billId', as: 'items', onDelete: 'CASCADE', hooks: true });
    }
  }

  Bill.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      fileId: { type: DataTypes.UUID, allowNull: false, unique: true },
      documentType: { type: DataTypes.ENUM(...DOCUMENT_TYPES), allowNull: false, defaultValue: 'bill' },
      vendorName: DataTypes.STRING(255),
      vendorContact: DataTypes.STRING(255),
      billNumber: DataTypes.STRING(100),
      billDate: DataTypes.DATEONLY,
      customerName: DataTypes.STRING(255),
      vehicleNumber: DataTypes.STRING(50),
      vehicleModel: DataTypes.STRING(150),
      kmReading: DataTypes.STRING(50),
      mobile: DataTypes.STRING(50),
      subTotal: decimal(DataTypes, 'subTotal'),
      extraCharges: decimal(DataTypes, 'extraCharges'),
      gstType: { type: DataTypes.ENUM(...GST_TYPES), allowNull: false, defaultValue: 'none' },
      gstRate: decimal(DataTypes, 'gstRate', 0, 5),
      gstAmount: decimal(DataTypes, 'gstAmount'),
      grandTotal: decimal(DataTypes, 'grandTotal'),
      amountInWords: DataTypes.STRING(500),
      notes: DataTypes.TEXT,
      confidence: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      fieldConfidence: DataTypes.JSON,
      corrections: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Bill',
      tableName: 'bills',
      underscored: true,
    }
  );

  Bill.DOCUMENT_TYPES = DOCUMENT_TYPES;
  Bill.GST_TYPES = GST_TYPES;
  Bill.DEFAULT_GST_RATE = DEFAULT_GST_RATE;
  return Bill;
};
