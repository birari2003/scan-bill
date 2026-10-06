'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('files', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      stored_name: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(100), allowNull: false },
      size: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      status: {
        type: Sequelize.ENUM('pending', 'uploading', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error_message: { type: Sequelize.STRING(500), allowNull: true },
      ocr_text: { type: Sequelize.TEXT('long'), allowNull: true },
      processing_ms: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      processed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('files', ['user_id', 'created_at']);
    await queryInterface.addIndex('files', ['user_id', 'status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('files');
  },
};
