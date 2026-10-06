const { sequelize } = require('../models');

(async () => {
  try {
    await sequelize.authenticate();
    const [[row]] = await sequelize.query('SELECT DATABASE() AS db, VERSION() AS version');
    console.log(`✔ Connected to MySQL ${row.version} — database "${row.db}"`);
    process.exitCode = 0;
  } catch (err) {
    console.error('✖ Database connection failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
