const express = require('express');
const { uploadMemory } = require('../middleware/upload');
const { transcribeAudio } = require('../controllers/transcriptionController');

const router = express.Router();
const upload = uploadMemory;

// POST /api/transcribe-audio using AssemblyAI
router.post('/transcribe-audio', upload.single('audio'), transcribeAudio);

module.exports = router;
