## AI Interview Assistant

Full-stack app for technical interviews: resume parsing, AI-generated questions, timed recordings, batch transcription + scoring, and an interviewer dashboard.

## Stack
- Frontend: React + Vite, Redux Toolkit, Ant Design, Tailwind
- Backend: Node.js, Express, Gemini (Google Generative AI), AssemblyAI (STT)
- Storage: Redux Persist (localStorage)

## Environment

Backend (.env):
- PORT=5000
- GEMINI_API_KEY=...
- GEMINI_MODEL=gemini-2.5-flash (As per choice)
- ASSEMBLYAI_API_KEY=...

Frontend (.env):
- VITE_API_BASE_URL=http://localhost:5000/api

## Development

Backend
- cd backend
- npm install
- npm start

Frontend
- cd frontend
- npm install
- npm run dev

## Features
- Resume upload (PDF/DOCX) and text extraction
- 6 AI-generated questions (2 Easy, 2 Medium, 2 Hard) preloaded before start
- 3s “get ready” + TTS of question + 5s pre-record countdown
- Record each answer; after the last, batch upload → transcribe (AssemblyAI) → score (Gemini)
- Final summary with average score; empty answers score 0
- Interviewer dashboard with sorting and details
 
Notes:
- Audio recordings are kept in-memory on the client and uploaded only at the end.
- We can use cloud for temporary storage, and allow resuming from any audio.
- If we use cloud storage, we can evaluate in backend, even if tab is closed.

## Project Structure

backend/
- server.js
- routes/interview.js, routes/transcribe.js
- controllers/interviewController.js, controllers/transcriptionController.js
- middleware/upload.js
- services/ai.js, services/resume.js
- utils/aiJson.js
- constants/difficulty.js

frontend/
- src/components (ChatInterface, IntervieweeTab, InterviewerTab)
- src/services (api.js)
- src/store (Redux slices)
- vite.config.js
 - public/ (static assets served at root: placed favicon.ico, logo.svg/png)