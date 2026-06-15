// Tiny API client for the Hakim backend. The base URL comes from an env var
// at build time (VITE_API_URL); defaults to localhost for development.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

const TOKEN_KEY = "hakim:token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function req(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const api = {
  // auth
  signup: (b) => req("/auth/signup", { method: "POST", body: b }),
  login: (b) => req("/auth/login", { method: "POST", body: b }),
  google: (b) => req("/auth/google", { method: "POST", body: b }),
  me: () => req("/auth/me"),
  facultyUpgrade: (code) => req("/auth/faculty-upgrade", { method: "POST", body: { code } }),

  // stations
  listStations: () => req("/stations"),
  createStation: (b) => req("/stations", { method: "POST", body: b }),
  updateStation: (id, b) => req(`/stations/${id}`, { method: "PUT", body: b }),
  deleteStation: (id) => req(`/stations/${id}`, { method: "DELETE" }),

  // attempts
  saveAttempt: (b) => req("/attempts", { method: "POST", body: b }),
  myAttempts: () => req("/attempts/me"),
  allAttempts: (userId) => req("/attempts" + (userId ? `?userId=${userId}` : "")),

  // ai proxy
  claude: ({ system, messages }) => req("/api/claude", { method: "POST", body: { system, messages } }),
};

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
