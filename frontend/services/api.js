import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "")
});

export async function checkBackendHealth() {
  const response = await api.get("/api/health");
  return response.data;
}

export async function listPrompts() {
  const response = await api.get("/prompts");
  return response.data;
}

export async function createPrompt(payload) {
  const response = await api.post("/prompts", payload);
  return response.data;
}

export async function listPromptVersions(promptId) {
  const response = await api.get(`/prompts/${promptId}/versions`);
  return response.data;
}

export async function createPromptVersion(promptId, payload) {
  const response = await api.post(`/prompts/${promptId}/version`, payload);
  return response.data;
}

export async function promotePromptVersion(promptId, versionId) {
  const response = await api.post(`/prompts/${promptId}/promote/${versionId}`);
  return response.data;
}

export async function rollbackPromptVersion(promptId, versionId) {
  const response = await api.post(`/prompts/${promptId}/rollback/${versionId}`);
  return response.data;
}

export async function listPromptDatasets(promptId) {
  const response = await api.get(`/prompts/${promptId}/datasets`);
  return response.data;
}

export async function createDataset(payload) {
  const response = await api.post("/datasets", payload);
  return response.data;
}

export async function runEvaluation(payload) {
  const response = await api.post("/evaluations/run", payload);
  return response.data;
}

export async function compareEvaluation(payload) {
  const response = await api.post("/evaluations/compare", payload);
  return response.data;
}

export async function listEvaluations(promptId) {
  const response = await api.get("/evaluations", {
    params: promptId ? { promptId } : {}
  });
  return response.data;
}

export function getApiErrorMessage(error) {
  return error.response?.data?.error || error.message || "Something went wrong";
}

export default api;
