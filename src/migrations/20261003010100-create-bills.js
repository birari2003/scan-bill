'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bills', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      file_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      document_type: {
        type: Sequelize.ENUM('bill', 'invoice', 'quotation', 'estimate', 'job_card', 'receipt', 'other'),
        allowNull: false,
        defaultValue: 'bill',
      },
      vendor_name: { type: Sequelize.STRING(255), allowNull: true },
      vendor_contact: { type: Sequelize.STRING(255), allowNull: true },
      bill_number: { type: Sequelize.STRING(100), allowNull: true },
      bill_date: { type: Sequelize.DATEONLY, allowNull: true },
      customer_name: { type: Sequelize.STRING(255), allowNull: true },
      vehicle_number: { type: Sequelize.STRING(50), allowNull: true },
      vehicle_model: { type: Sequelize.STRING(150), allowNull: true },
      km_reading: { type: Sequelize.STRING(50), allowNull: true },
      mobile: { type: Sequelize.STRING(50), allowNull: true },
      sub_total: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      extra_charges: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      grand_total: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      amount_in_words: { type: Sequelize.STRING(500), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      confidence: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      field_confidence: { type: Sequelize.JSON, allowNull: true },
      corrections: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('bills', ['vendor_name']);
    await queryInterface.addIndex('bills', ['bill_number']);
    await queryInterface.addIndex('bills', ['vehicle_number']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bills');
  },
};
