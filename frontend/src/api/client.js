import axios from 'axios';

const apiOrigin =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

const apiClient = axios.create({
  baseURL: apiOrigin,
});

// Attach stored JWT token automatically to outgoing requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('gw_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;