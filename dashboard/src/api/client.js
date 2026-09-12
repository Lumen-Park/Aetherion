import axios from 'axios';

const API_BASE = `${(import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('aetherion_token') || sessionStorage.getItem('aetherion_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  providers: () => apiClient.get('/auth/providers'),
  oauthLoginUrl: (provider) => apiClient.get(`/oauth/login/${provider}`),
};

// Tasks endpoints
export const tasksAPI = {
  runPipeline: (goal, mode, idempotencyKey) =>
    apiClient.post('/tasks/pipeline', { goal, mode }, {
      headers: { 'Idempotency-Key': idempotencyKey }
    }),
  getPipelineStatus: (taskId) => apiClient.get(`/tasks/pipeline/${taskId}`),
  runLab: (goal, idempotencyKey) =>
    apiClient.post('/tasks/lab', { goal }, {
      headers: { 'Idempotency-Key': idempotencyKey }
    }),
  getLabStatus: (taskId) => apiClient.get(`/tasks/lab/${taskId}`),
  override: (taskId, reason) =>
    apiClient.post(`/tasks/override/${taskId}`, null, { params: { reason } }),
};

// Agents endpoints
export const agentsAPI = {
  list: () => apiClient.get('/agents'),
  colleges: () => apiClient.get('/agents/colleges'),
};

// Council endpoints
export const councilAPI = {
  stats: () => apiClient.get('/council/stats'),
  judges: () => apiClient.get('/council/judges'),
};

// WebSocket for real-time deliberation
export const connectDeliberationSocket = (onMessage) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/api/ws/deliberation`);
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  ws.onclose = () => setTimeout(() => connectDeliberationSocket(onMessage), 3000);
  return ws;
};

export default apiClient;
