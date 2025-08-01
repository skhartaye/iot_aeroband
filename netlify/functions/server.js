import { PrismaClient } from '@prisma/client';

let prisma = null;

// Initialize Prisma client
const getPrismaClient = () => {
  if (!prisma) {
    try {
      prisma = new PrismaClient({
        log: ['query', 'info', 'warn', 'error'],
      });
      console.log('Prisma client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Prisma:', error);
      return null;
    }
  }
  return prisma;
};

// Netlify function handler
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
            const prismaClient = getPrismaClient();
            if (!prismaClient) {
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database connection not available' })
              };
            }
            
            const devices = await prismaClient.device.findMany();
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify(devices)
            };
          } else if (httpMethod === 'POST') {
            const prismaClient = getPrismaClient();
            if (!prismaClient) {
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database connection not available' })
              };
            }
            
            const { name, deviceId, location } = requestBody;
            const device = await prismaClient.device.create({
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
            const prismaClient = getPrismaClient();
            if (!prismaClient) {
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database connection not available' })
              };
            }
            
            const data = await prismaClient.sensorData.findMany({
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
            try {
              console.log('Received sensor data:', requestBody);
              const { 
                temperature, 
                humidity, 
                pressure, 
                gas_resistance, 
                co, 
                nh3, 
                no2, 
                pm2_5, 
                pm10, 
                deviceId = 'ESP32_Sensor' 
              } = requestBody;
              
              console.log('Parsed values:', { 
                temperature, 
                humidity, 
                pressure, 
                gas_resistance, 
                co, 
                nh3, 
                no2, 
                pm2_5, 
                pm10, 
                deviceId 
              });
              
              const prismaClient = getPrismaClient();
              if (!prismaClient) {
                return {
                  statusCode: 500,
                  headers,
                  body: JSON.stringify({ error: 'Database connection not available' })
                };
              }
              
              // Test database connection
              try {
                await prismaClient.$connect();
                console.log('Database connected successfully');
              } catch (dbError) {
                console.error('Database connection failed:', dbError);
                return {
                  statusCode: 500,
                  headers,
                  body: JSON.stringify({ error: 'Database connection failed', details: dbError.message })
                };
              }
              
              const sensorData = await prismaClient.sensorData.create({
                data: { 
                  temperature: parseFloat(temperature) || 0,
                  humidity: parseFloat(humidity) || 0,
                  pressure: parseFloat(pressure) || 0,
                  gas_resistance: parseFloat(gas_resistance) || 0,
                  co: parseFloat(co) || 0,
                  nh3: parseFloat(nh3) || 0,
                  no2: parseFloat(no2) || 0,
                  pm2_5: parseInt(pm2_5) || 0,
                  pm10: parseInt(pm10) || 0,
                  deviceId: deviceId,
                  location: 'Default',
                  status: 'active'
                }
              });
              
              console.log('Sensor data saved successfully:', sensorData);
              
              return {
                statusCode: 201,
                headers,
                body: JSON.stringify(sensorData)
              };
            } catch (error) {
              console.error('Error saving sensor data:', error);
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: error.message, details: error.stack })
              };
            }
          }
          break;
          
        default:
          // Handle /sensor-data/:deviceId
          if (apiPath.startsWith('/sensor-data/')) {
            const prismaClient = getPrismaClient();
            if (!prismaClient) {
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Database connection not available' })
              };
            }
            
            const deviceId = pathSegments[2];
            const data = await prismaClient.sensorData.findMany({
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