const app = require('./app');
const env = require('./config/env');
const { sequelize } = require('./models');
const { recoverInterruptedJobs } = require('./services/extraction.service');

const start = async () => {
  try {
    await sequelize.authenticate();
    console.log(`✔ Database connected (${env.db.name}@${env.db.host}:${env.db.port})`);
    await recoverInterruptedJobs();
  } catch (err) {
    console.error('✖ Unable to connect to the database:', err.message);
    process.exit(1);
  }

  if (!env.ocrSpace.apiKey || !env.groq.apiKey) {
    console.warn('⚠ OCR_SPACE_API_KEY / GROQ_API_KEY not set — uploads will fail extraction.');
  }

  const server = app.listen(env.port, () => {
    console.log(`✔ API listening on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start();
