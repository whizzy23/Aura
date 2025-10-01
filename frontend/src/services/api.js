import axios from "axios";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const api = axios.create({ baseURL: API_BASE_URL });

export const apiService = {
  // Extract resume data
  extractResume: async (file) => {
    const formData = new FormData();
    formData.append("resume", file);

    const response = await api.post("/extract-resume", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  // Generate all questions upfront
  generateQuestions: async (candidateInfo) => {
    const response = await api.post("/generate-questions", { candidateInfo });
    return response.data;
  },

  // Generate final summary
  generateSummary: async (candidateInfo, questions, answers, scores) => {
    const response = await api.post("/generate-summary", {
      candidateInfo,
      questions,
      answers,
      scores,
    });
    return response.data;
  },

  // Helper that accepts a pre-constructed FormData
  batchEvaluateWithFormData: async (formData) => {
    const response = await api.post("/batch-evaluate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

export default apiService;
