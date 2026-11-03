'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The quantity of the most recent restock. Existing products start at 0.
    await queryInterface.addColumn('stocks', 'new_stock', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: 'total_stock',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('stocks', 'new_stock');
  },
};
