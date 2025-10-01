const express = require("express");
const { uploadMemory } = require("../middleware/upload");
const {
  extractResume,
  generateQuestions,
  generateSummary,
  batchEvaluate,
} = require("../controllers/interviewController");

const router = express.Router();
const upload = uploadMemory;

// extract resume
router.post("/extract-resume", upload.single("resume"), extractResume);

// generate all questions upfront
router.post("/generate-questions", generateQuestions);

// summary
router.post("/generate-summary", generateSummary);

// batch evaluate after all recordings are done
router.post("/batch-evaluate", upload.array("audios", 6), batchEvaluate);

module.exports = router;
