const axios = require("axios");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { createModel } = require("../services/ai");
const { extractTextFromBuffer } = require("../services/resume");
const { parseModelJson } = require("../utils/aiJson");
const {
  QUESTION_DIFFICULTY_BY_INDEX,
  TIMERS_BY_DIFFICULTY,
} = require("../constants/difficulty");

// Initialize model once per process
const model = createModel();

async function extractResume(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const text = await extractTextFromBuffer(req.file);
    if (!text.trim()) {
      return res.json({
        success: true,
        data: { name: null, email: null, phone: null },
        resumeText: "",
      });
    }
    const truncated = text.length > 8000 ? text.slice(0, 8000) : text;
    const prompt = `Extract Name, Email, Phone as JSON {"name","email","phone"}. Resume: ${truncated}`;
    let data = { name: null, email: null, phone: null };
    try {
      const result = await model.generateContent(prompt);
      const responseText = (await result.response.text()).trim();
      data = parseModelJson(responseText, data);
    } catch (_err) {
      console.log(_err);
    }
    res.json({ success: true, data, resumeText: text });
  } catch (err) {
    res.status(500).json({
      error: "Failed to extract resume data",
      details: err?.message,
    });
  }
}

async function generateQuestions(req, res) {
  try {
    const { candidateInfo } = req.body;
    const results = [];
    for (let i = 0; i < 6; i++) {
      const qNum = i + 1;
      const difficulty = QUESTION_DIFFICULTY_BY_INDEX[i];
      try {
        const prompt = `
				You are acting as a senior technical interviewer.
				Generate one high-quality full-stack (React + Node) interview question.

				Difficulty: ${difficulty}
				Question number: Q${qNum} of 6
				Candidate: ${JSON.stringify(candidateInfo || {})}

				Requirements:
				• Frame the question as a realistic scenario that requires the candidate to verbally explain their approach.
				• The problem must involve both React (frontend) and Node/Express (backend).
				• The question should make the candidate talk about data flow, logic, performance, or edge cases.
				• Avoid abstract system design prompts. The question must be answerable step by step in speech.
				• No list format, no preamble, no code snippets.
				• Output only the question as a single sentence or short paragraph.
				• Word & sentence limits:
				Easy: ≤20 words / 1 sentence
				Medium: ≤35 words / 2 sentences
				Hard: ≤60 words / 2 sentences

				Output ONLY the question.
			`;
        const r = await model.generateContent(prompt);
        const question = (await r.response.text()).trim();
        if (!question) throw new Error("Empty question");
        results.push({ questionNumber: qNum, difficulty, question });
      } catch (_errOne) {
        console.error("Error generating question", {
          qNum,
          difficulty,
          error: _errOne,
        });
        return res.status(503).json({
          success: false,
          error:
            "Unable to generate questions at the moment. Please try again later.",
        });
      }
    }
    res.json({ success: true, questions: results });
  } catch (err) {
    console.error("Failed to generate questions:", err);
    res.status(500).json({
      error: "Failed to generate questions",
      details: err?.message,
      stack: err?.stack,
    });
  }
}

async function generateSummary(req, res) {
  try {
    const { candidateInfo, questions, answers, scores } = req.body;
    const safeAnswers = Array.isArray(answers) ? answers : [];
    const safeScores = Array.isArray(scores) ? scores : [];
    const avg = (
      safeScores.reduce((a, b) => a + b, 0) / Math.max(safeScores.length, 1)
    ).toFixed(1);
    const noAnswers =
      safeAnswers.length === 0 ||
      safeAnswers.every((a) => !a || String(a).trim().length === 0);
    if (noAnswers) {
      const summary = `${
        candidateInfo?.name || "The candidate"
      } did not provide spoken responses to the questions during the interview. As a result, no assessment of technical accuracy, completeness, approach, or clarity could be made. Consider rescheduling the interview or ensuring microphone access before retrying.`;
      return res.json({ success: true, summary, averageScore: 0 });
    }

    const qa = questions
      .map(
        (q, i) =>
          `Q${i + 1}: ${q}\nA${i + 1}: ${safeAnswers[i] || ""}\nScore:${
            safeScores[i] ?? 0
          }/10`
      )
      .join("\n\n");
    const prompt = `Write a concise 2-3 sentence interview summary for ${
      candidateInfo?.name || "the candidate"
    } (Avg:${avg}/10).\n${qa}`;
    const result = await model.generateContent(prompt);
    const summary = (await result.response.text()).trim();
    res.json({ success: true, summary, averageScore: parseFloat(avg) });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate summary" });
  }
}

async function batchEvaluate(req, res) {
  try {
    const payload = JSON.parse(req.body?.payload || "{}");
    const { questions } = payload;
    const files = Array.isArray(req.files) ? req.files.slice(0, 6) : [];

    if (!Array.isArray(questions) || questions.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No questions provided" });
    }
    if (!files.length) {
      return res
        .status(400)
        .json({ success: false, error: "No audio files uploaded" });
    }

    async function transcribeBufferToText(buffer) {
      const tmpPath = path.join(
        os.tmpdir(),
        `ans-${Date.now()}-${Math.random().toString(16).slice(2)}.webm`
      );
      fs.writeFileSync(tmpPath, buffer);
      try {
        const uploadResponse = await axios({
          method: "post",
          url: "https://api.assemblyai.com/v2/upload",
          headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
          data: fs.createReadStream(tmpPath),
        });
        const audio_url = uploadResponse.data.upload_url;
        const transcriptResponse = await axios({
          method: "post",
          url: "https://api.assemblyai.com/v2/transcript",
          headers: {
            authorization: process.env.ASSEMBLYAI_API_KEY,
            "content-type": "application/json",
          },
          data: { audio_url, language_code: "en" },
        });
        const transcriptId = transcriptResponse.data.id;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const statusRes = await axios({
            method: "get",
            url: `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
            headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
          });
          if (statusRes.data.status === "completed")
            return statusRes.data.text || "";
          if (statusRes.data.status === "failed")
            throw new Error("Transcription failed");
        }
        throw new Error("Transcription timed out");
      } finally {
        try {
          fs.unlinkSync(tmpPath);
        } catch (_) {}
      }
    }

    const transcripts = new Array(questions.length).fill("");
    for (const file of files) {
      let idx = null;
      try {
        const m = /q(\d+)/i.exec(file.originalname || "");
        if (m) idx = parseInt(m[1], 10) - 1;
      } catch (_) {}
      if (idx !== null && idx >= 0 && idx < questions.length) {
        if (!file || !file.buffer || file.buffer.length === 0) {
          transcripts[idx] = "";
          continue;
        }
        try {
          transcripts[idx] = await transcribeBufferToText(file.buffer);
        } catch (_) {
          transcripts[idx] = "";
        }
      }
    }

    const evaluations = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const ans = transcripts[i] || "";
      const difficulty =
        q.difficulty ||
        QUESTION_DIFFICULTY_BY_INDEX[(q.questionNumber || i + 1) - 1];
      const timeLimitSeconds = TIMERS_BY_DIFFICULTY[difficulty] || 60;
      const trimmed = ans.trim();
      if (!trimmed || trimmed.length < 3) {
        evaluations.push({
          score: 0,
          feedback: "No answer provided or audio was unintelligible.",
        });
        continue;
      }
      try {
        const prompt = `
          You are an evaluator. Score the answer from 0 to 10 based on the following criteria:
          1. Accuracy – Is the answer factually correct?
          2. Completeness – Does it address all required parts of the question?
          3. Approach – Is the reasoning or method appropriate for the problem?
          4. Clarity – Is the answer easy to understand and well-structured?
          5. Fit for Constraints – Is it appropriate for the given time limit (${timeLimitSeconds} seconds) and difficulty level (${difficulty})?

          Provide your response strictly in the following JSON format:
          {"score": number, "feedback": "string"}

          Here is the question and answer to evaluate:

          Q: ${q.question}
          A: ${trimmed}
        `;
        
        const r = await model.generateContent(prompt);
        const responseText = (await r.response.text()).trim();
        const ev = parseModelJson(responseText, { score: 0, feedback: "" });
        evaluations.push(ev);
      } catch (_e) {
        evaluations.push({ score: 0, feedback: "Evaluation failed" });
      }
    }

    res.json({ success: true, transcripts, evaluations });
  } catch (err) {
    console.error("Batch evaluate failed:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Batch evaluate failed",
    });
  }
}

module.exports = {
  extractResume,
  generateQuestions,
  generateSummary,
  batchEvaluate,
};
