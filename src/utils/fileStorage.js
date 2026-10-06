const fs = require('fs');
const path = require('path');
const env = require('../config/env');

fs.mkdirSync(env.upload.dir, { recursive: true });

const userDir = (userId) => {
  const dir = path.join(env.upload.dir, userId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const filePath = (userId, storedName) => path.join(env.upload.dir, userId, path.basename(storedName));

const removeFile = async (userId, storedName) => {
  try {
    await fs.promises.unlink(filePath(userId, storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
};

module.exports = { userDir, filePath, removeFile };
