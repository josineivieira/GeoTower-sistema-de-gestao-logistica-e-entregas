const path = require('path');

function getUploadsBaseDir() {
  return process.env.BACKEND_UPLOADS_DIR
    ? path.resolve(process.env.BACKEND_UPLOADS_DIR)
    : path.join(__dirname, '..', 'uploads');
}

function getLocalUploadPath(relativePath) {
  return path.join(getUploadsBaseDir(), relativePath);
}

module.exports = {
  getUploadsBaseDir,
  getLocalUploadPath
};
