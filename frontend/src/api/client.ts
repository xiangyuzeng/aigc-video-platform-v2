import axios from "axios";

/**
 * Axios instance for all API calls.
 * In dev, Vite proxies /api/* to localhost:8000 (see vite.config.ts).
 * In production, set VITE_API_BASE_URL env var.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Response interceptor: unwrap data, handle errors
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err.response?.data?.detail ??
      err.response?.data?.message ??
      err.message ??
      "Network error";
    console.error("[API]", msg);
    return Promise.reject(new Error(msg));
  }
);

export default client;
