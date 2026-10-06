const { Model } = require('sequelize');

const FILE_STATUSES = ['pending', 'uploading', 'processing', 'completed', 'failed'];

module.exports = (sequelize, DataTypes) => {
  class File extends Model {
    static associate(models) {
      File.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
      File.hasOne(models.Bill, { foreignKey: 'fileId', as: 'bill', onDelete: 'CASCADE', hooks: true });
    }
  }

  File.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      originalName: { type: DataTypes.STRING(255), allowNull: false },
      storedName: { type: DataTypes.STRING(255), allowNull: false },
      mimeType: { type: DataTypes.STRING(100), allowNull: false },
      size: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      status: { type: DataTypes.ENUM(...FILE_STATUSES), allowNull: false, defaultValue: 'pending' },
      errorMessage: { type: DataTypes.STRING(500), allowNull: true },
      ocrText: { type: DataTypes.TEXT('long'), allowNull: true },
      processingMs: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
      processedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'File',
      tableName: 'files',
      underscored: true,
    }
  );

  File.STATUSES = FILE_STATUSES;
  return File;
};
