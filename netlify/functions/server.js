import { PrismaClient } from '@prisma/client';

let prisma;

try {
  prisma = new PrismaClient();
} catch (error) {
  console.error('Failed to initialize Prisma:', error);
  prisma = null;
}

// Netlify function handler - Updated to remove Express dependency
export const handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Check if Prisma is available
  if (!prisma) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection not available' })
    };
  }

  const { httpMethod, path, queryStringParameters, body } = event;
  
  try {
    // Parse body if it exists
    const requestBody = body ? JSON.parse(body) : {};
    
    // Route the request
    const pathSegments = path.split('/').filter(Boolean);
    
    if (pathSegments[0] === 'api') {
      const apiPath = '/' + pathSegments.slice(1).join('/');
      
      switch (apiPath) {
        case '/':
          return {
            statusCode: 200,
            headers,
            body: 'API is running!'
          };
          
        case '/devices':
          if (httpMethod === 'GET') {
            const devices = await prisma.device.findMany();
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(devices)
            };
          } else if (httpMethod === 'POST') {
            const { name, deviceId, location } = requestBody;
            const device = await prisma.device.create({
              data: { name, deviceId, location }
            });
            return {
              statusCode: 201,
              headers,
              body: JSON.stringify(device)
            };
          }
          break;
          
        case '/sensor-data':
          if (httpMethod === 'GET') {
            const data = await prisma.sensorData.findMany({
              orderBy: {
                timestamp: 'desc'
              }
            });
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(data)
            };
          } else if (httpMethod === 'POST') {
            const { temp, hum, pm1, pm25, pm10, nh3, deviceId = 'ESP32_Sensor' } = requestBody;
            const sensorData = await prisma.sensorData.create({
              data: { 
                temperature: temp,
                humidity: hum,
                pressure: null,
                gas_resistance: nh3,
                ammonia: nh3,
                pm1: pm1,
                pm25: pm25,
                pm10: pm10,
                deviceId: deviceId,
                location: 'Default',
                status: 'active'
              }
            });
            return {
              statusCode: 201,
              headers,
              body: JSON.stringify(sensorData)
            };
          }
          break;
          
        default:
          // Handle /sensor-data/:deviceId
          if (apiPath.startsWith('/sensor-data/')) {
            const deviceId = pathSegments[2];
            const data = await prisma.sensorData.findMany({
              where: { deviceId },
              orderBy: {
                timestamp: 'desc'
              }
            });
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(data)
            };
          }
      }
    }

    return {
      statusCode: 404,
      headers,
      body: 'Not Found'
    };
    
  } catch (error) {
    console.error('Error in Netlify function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 