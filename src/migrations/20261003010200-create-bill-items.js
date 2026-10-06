'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bill_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      bill_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'bills', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sr_no: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      particular: { type: Sequelize.STRING(500), allowNull: false },
      rate: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      qty: { type: Sequelize.DECIMAL(10, 3), allowNull: false, defaultValue: 1 },
      amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      confidence: { type: Sequelize.FLOAT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('bill_items', ['bill_id', 'sr_no']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bill_items');
  },
};
