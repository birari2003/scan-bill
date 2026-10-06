'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DEMO_EMAIL = 'demo@billscan.app';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('users', [
      {
        id: crypto.randomUUID(),
        name: 'Demo User',
        email: DEMO_EMAIL,
        password: await bcrypt.hash('Demo@1234', 12),
        role: 'admin',
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { email: DEMO_EMAIL });
  },
};
