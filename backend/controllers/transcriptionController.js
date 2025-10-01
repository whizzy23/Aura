const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');

async function transcribeAudio(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file uploaded.' });
    }
    const buf = req.file.buffer;
    if (!buf || buf.length === 0) {
      return res.status(400).json({ success: false, error: 'Empty audio file uploaded.' });
    }

    // Write buffer to a temp file for streaming upload
    const tmpPath = path.join(
      os.tmpdir(),
      `one-${Date.now()}-${Math.random().toString(16).slice(2)}.webm`
    );
    fs.writeFileSync(tmpPath, buf);
    try {
      // Upload to AssemblyAI
      const uploadResponse = await axios({
        method: 'post',
        url: 'https://api.assemblyai.com/v2/upload',
        headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
        data: fs.createReadStream(tmpPath),
      });
      const audio_url = uploadResponse.data.upload_url;

      // Request transcription
      const transcriptResponse = await axios({
        method: 'post',
        url: 'https://api.assemblyai.com/v2/transcript',
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
          'content-type': 'application/json',
        },
        data: { audio_url, language_code: 'en' },
      });
      const transcriptId = transcriptResponse.data.id;

      // Poll for completion
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await axios({
          method: 'get',
          url: `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          headers: { authorization: process.env.ASSEMBLYAI_API_KEY },
        });
        if (statusRes.data.status === 'completed') {
          return res.json({ success: true, transcript: statusRes.data.text || '' });
        }
        if (statusRes.data.status === 'failed') {
          return res.status(500).json({ success: false, error: 'Transcription failed.' });
        }
      }
      return res.status(500).json({ success: false, error: 'Transcription timed out.' });
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { transcribeAudio };
