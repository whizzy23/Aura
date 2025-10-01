const multer = require('multer');

// Centralized Multer instance using in-memory storage
const uploadMemory = multer({ storage: multer.memoryStorage() });

module.exports = { uploadMemory };
