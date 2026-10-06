const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const required = ['DB_NAME', 'DB_USER', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  // Prefix used when building file URLs returned to the browser.
  publicApiPath: process.env.PUBLIC_API_PATH || '/api',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  upload: {
    dir: path.resolve(__dirname, '../..', process.env.UPLOAD_DIR || 'uploads'),
    maxBytes: (Number(process.env.MAX_UPLOAD_MB) || 15) * 1024 * 1024,
    urlTtl: process.env.FILE_URL_TTL || '2h',
  },
  ocrSpace: {
    apiKey: process.env.OCR_SPACE_API_KEY || '',
    engine: Number(process.env.OCR_SPACE_ENGINE) || 3,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    reasoningEffort: process.env.GROQ_REASONING_EFFORT || 'medium',
  },
};

module.exports = env;
