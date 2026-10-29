'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Optional: existing products have no model. Deleting a model un-links its products.
    await queryInterface.addColumn('stocks', 'model_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'models', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'product_name',
    });
    await queryInterface.addIndex('stocks', ['model_id']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('stocks', ['model_id']);
    await queryInterface.removeColumn('stocks', 'model_id');
  },
};
