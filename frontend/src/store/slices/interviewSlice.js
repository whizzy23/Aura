import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentCandidate: null,
  currentQuestion: null,
  questionNumber: 0,
  answers: [],
  questions: [],
  scores: [],
  timeRemaining: 0,
  isActive: false,
  isPaused: false,
  isCompleted: false,
  resumeData: null,
  preloadedQuestions: []
};

const interviewSlice = createSlice({
  name: 'interview',
  initialState,
  reducers: {
    setPreloadedQuestions: (state, action) => {
      // Store full question objects for navigation
      state.preloadedQuestions = action.payload || [];
    },
    setCurrentCandidate: (state, action) => {
      state.currentCandidate = action.payload;
    },
    setResumeData: (state, action) => {
      state.resumeData = action.payload;
    },
    startInterview: (state) => {
      state.isActive = true;
      state.isPaused = false;
      state.questionNumber = 1;
      state.answers = [];
      state.questions = [];
      state.scores = [];
      state.isCompleted = false;
    },
    setCurrentQuestion: (state, action) => {
      state.currentQuestion = action.payload;
      state.questions.push(action.payload.question);
      
      // Set timer based on difficulty
      const timers = { Easy: 20, Medium: 60, Hard: 120 };
      state.timeRemaining = timers[action.payload.difficulty];
    },
    // Advance to next question index without recording an answer
    advanceQuestion: (state) => {
      if (state.questionNumber < 6) {
        state.questionNumber += 1;
      } else {
        state.isCompleted = true;
        state.isActive = false;
      }
    },
    submitAnswer: (state, action) => {
      state.answers.push(action.payload.answer);
      state.scores.push(action.payload.score || 0);
      
      if (state.questionNumber < 6) {
        state.questionNumber += 1;
      } else {
        state.isCompleted = true;
        state.isActive = false;
      }
    },
    // After batch evaluation, set all answers and scores at once
    setFinalResults: (state, action) => {
      const { answers, scores, feedbacks } = action.payload || {};
      state.answers = answers || [];
      state.scores = scores || [];
      state.feedbacks = feedbacks || [];
      state.isCompleted = true;
      state.isActive = false;
    },
    updateTimer: (state, action) => {
      state.timeRemaining = action.payload;
    },
    pauseInterview: (state) => {
      state.isPaused = true;
    },
    resumeInterview: (state) => {
      state.isPaused = false;
    },
    resetInterview: (state) => {
      return { ...initialState };
    }
  }
});

export const {
  setCurrentCandidate,
  setResumeData,
  startInterview,
  setPreloadedQuestions,
  setCurrentQuestion,
  advanceQuestion,
  submitAnswer,
  setFinalResults,
  updateTimer,
  pauseInterview,
  resumeInterview,
  resetInterview
} = interviewSlice.actions;

export default interviewSlice.reducer;