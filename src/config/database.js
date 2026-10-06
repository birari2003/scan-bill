// Shared by the Sequelize CLI (.sequelizerc) and the runtime models/index.js.
const env = require('./env');

const base = {
  username: env.db.user,
  password: env.db.password,
  database: env.db.name,
  host: env.db.host,
  port: env.db.port,
  dialect: 'mysql',
  timezone: '+00:00',
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
};

module.exports = {
  development: { ...base, logging: false },
  test: { ...base, database: `${env.db.name}_test`, logging: false },
  production: { ...base, logging: false },
};
