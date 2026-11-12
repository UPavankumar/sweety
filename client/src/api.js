// API Client for Sweety Frontend
const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Helper to get the saved auth token from localStorage
 */
function getToken() {
  return localStorage.getItem('sweety_token');
}

/**
 * Universal request wrapper that injects:
 * 1. Authorization: Bearer <token>
 * 2. X-Client-Date: Local calendar date YYYY-MM-DD
 * 3. Handles JSON parsing and server error message extraction
 */
async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-Client-Date': new Date().toLocaleDateString('en-CA'),
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage = data.error || data.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth endpoints
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name, email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  // Readings endpoints
  getReadings: (date) => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return request(`/readings${query}`);
  },

  createReading: (reading) =>
    request('/readings', {
      method: 'POST',
      body: JSON.stringify(reading),
    }),

  updateReading: (id, reading) =>
    request(`/readings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reading),
    }),

  deleteReading: (id) =>
    request(`/readings/${id}`, {
      method: 'DELETE',
    }),

  // Reports endpoint
  getReport: (type, date) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (date) params.append('date', date);
    return request(`/reports?${params.toString()}`);
  },
};
