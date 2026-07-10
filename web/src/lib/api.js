import axios from "axios";
import toast from "react-hot-toast";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Request: attach JWT
api.interceptors.request.use((config) => {
  const raw = localStorage.getItem("eldercare-auth");
  if (raw) {
    try {
      const { state } = JSON.parse(raw);
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`;
    } catch {}
  }
  return config;
});

// Response: handle 401 + show toast on errors
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.error || "Something went wrong";

    if (status === 401) {
      localStorage.removeItem("eldercare-auth");
      window.location.href = "/login";
      return Promise.reject(error);
    }

    if (status >= 500) toast.error("Server error. Please try again.");
    return Promise.reject(error);
  },
);

export { api };
export default api;
