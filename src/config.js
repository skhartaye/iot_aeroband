// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3001' : 'https://aeroband-iot-9lu6zrnvo-mercadoleimorat-gmailcoms-projects.vercel.app/api');

export const API_ENDPOINTS = {
  SENSOR_DATA: `${API_BASE_URL}/sensor-data`,
  ROOT: `${API_BASE_URL}/`
};

export default API_ENDPOINTS; 