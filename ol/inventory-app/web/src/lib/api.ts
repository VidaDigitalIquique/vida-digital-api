import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000',
});

export const healthCheck = () => api.get('/health');
export const getProduct = (code: string) => api.get(\/ro/producto?code=\\);
export const getInventory = (code: string) => api.get(\/ro/inventar?code=\\);

export default api;
