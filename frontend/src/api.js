/**
 * Axios instance with correct baseURL for both environments:
 * - Dev (Vite): relative '/api/...' → proxied to localhost:3010 by Vite
 * - Electron (file://): must use absolute 'http://localhost:3010/api/...'
 */
import axios from 'axios';

// When running inside Electron (loaded via file://), window.location.protocol === 'file:'
const isElectron = window.location.protocol === 'file:';

const api = axios.create({
  baseURL: isElectron ? 'http://localhost:3010' : '',
  timeout: 60000,
});

// Replace the default axios to use our configured instance globally
// This way all existing axios.get('/api/...') calls still work
Object.assign(axios.defaults, {
  baseURL: isElectron ? 'http://localhost:3010' : '',
});

export default api;
