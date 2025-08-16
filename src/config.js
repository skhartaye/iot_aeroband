// API endpoints
export const API_ENDPOINTS = {
  SENSOR_DATA: 'https://iot.aeroband.org/api/sensor-data',
  // Add your local backend URL for development
  LOCAL_SENSOR_DATA: 'http://localhost:39000/sensor-data'
};

// World Air Quality Index (WAQI) Configuration
export const WAQI_CONFIG = {
  API_KEY: '5f520a2f9f53d8322383467162e61dfffb797f94',
  BASE_URL: 'https://api.waqi.info',
  ENDPOINTS: {
    AIR_QUALITY: '/feed',
    FORECAST: '/feed'
  }
};

// Air Quality Index (AQI) levels and colors
export const AQI_LEVELS = {
  GOOD: { min: 0, max: 50, color: '#00e400', label: 'Good' },
  MODERATE: { min: 51, max: 100, color: '#ffff00', label: 'Moderate' },
  UNHEALTHY_SENSITIVE: { min: 101, max: 150, color: '#ff7e00', label: 'Unhealthy for Sensitive Groups' },
  UNHEALTHY: { min: 151, max: 200, color: '#ff0000', label: 'Unhealthy' },
  VERY_UNHEALTHY: { min: 201, max: 300, color: '#8f3f97', label: 'Very Unhealthy' },
  HAZARDOUS: { min: 301, max: 500, color: '#7e0023', label: 'Hazardous' }
}; 