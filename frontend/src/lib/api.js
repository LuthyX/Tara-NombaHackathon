// src/lib/api.js
//
// Central API client for all backend requests.
// Uses axios with interceptors to:
//   1. Automatically attach the Bearer token to every request
//   2. Automatically refresh the token when it expires (401 response)
//   3. Redirect to login if refresh also fails

import axios from "axios";

// Base URL of our FastAPI backend
// During development this is localhost:8000
// On Render deployment it's your Render URL
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Create the axios instance with base config
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// ── Request Interceptor ────────────────────────────────────────────────────
// Runs before EVERY request — attaches the access token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor ───────────────────────────────────────────────────
// Runs after EVERY response
// If we get a 401 (token expired), try to refresh automatically
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  // Success — just return the response
  (response) => response,

  // Error — check if it's a 401 and try to refresh
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Another request is already refreshing — queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");

      if (!refreshToken) {
        // No refresh token — send to login
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // Try to get a new access token
        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);

        // Retry all queued requests with new token
        processQueue(null, access_token);

        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed — clear everything and go to login
        processQueue(refreshError, null);
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
