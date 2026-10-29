'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 'none' keeps existing bills' totals unchanged; 'default' = 18%; 'custom' = user-chosen rate.
    await queryInterface.addColumn('bills', 'gst_type', {
      type: Sequelize.ENUM('none', 'default', 'custom'),
      allowNull: false,
      defaultValue: 'none',
      after: 'extra_charges',
    });
    await queryInterface.addColumn('bills', 'gst_rate', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'gst_type',
    });
    await queryInterface.addColumn('bills', 'gst_amount', {
      type: Sequelize.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
      after: 'gst_rate',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('bills', 'gst_amount');
    await queryInterface.removeColumn('bills', 'gst_rate');
    await queryInterface.removeColumn('bills', 'gst_type');
  },
};
