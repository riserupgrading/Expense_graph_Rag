import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export const getDashboardSummary = () => api.get("/dashboard/summary").then((r) => r.data);
export const getGraphData = () => api.get("/dashboard/graph").then((r) => r.data);
export const getTransactions = (params) => api.get("/transactions", { params }).then((r) => r.data);
export const getSubscriptions = () => api.get("/subscriptions").then((r) => r.data);
export const rescanSubscriptions = () => api.post("/subscriptions/rescan").then((r) => r.data);
export const markSubscriptionUsed = (id) => api.post(`/subscriptions/${id}/mark-used`).then((r) => r.data);
export const askQuestion = (question) => api.post("/query", { question }).then((r) => r.data);

export default api;
