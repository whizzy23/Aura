import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  candidates: [],
  selectedCandidate: null
};

const candidatesSlice = createSlice({
  name: 'candidates',
  initialState,
  reducers: {
    addCandidate: (state, action) => {
      const providedId = action.payload?.id;
      const candidate = {
        ...action.payload,
        id: providedId || Date.now().toString(),
        createdAt: action.payload?.createdAt || new Date().toISOString()
      };
      state.candidates.push(candidate);
    },
    updateCandidate: (state, action) => {
      const { id, ...updates } = action.payload;
      const candidateIndex = state.candidates.findIndex(c => c.id === id);
      if (candidateIndex !== -1) {
        state.candidates[candidateIndex] = { ...state.candidates[candidateIndex], ...updates };
      }
    },
    setSelectedCandidate: (state, action) => {
      state.selectedCandidate = action.payload;
    },
    clearSelectedCandidate: (state) => {
      state.selectedCandidate = null;
    }
  }
});

export const {
  addCandidate,
  updateCandidate,
  setSelectedCandidate,
  clearSelectedCandidate
} = candidatesSlice.actions;

export default candidatesSlice.reducer;