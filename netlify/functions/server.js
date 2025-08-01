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
          
        case '/sensor-data':
          if (httpMethod === 'GET') {
            try {
              const prismaClient = getPrismaClient();
              if (!prismaClient) {
                return {
                  statusCode: 200,
                  headers,
                  body: JSON.stringify({ message: 'GET endpoint working', data: [] })
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
            } catch (error) {
              console.error('Error fetching sensor data:', error);
              return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'GET endpoint working', data: [] })
              };
            }
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
              
              // Try to save to database
              try {
                const prismaClient = getPrismaClient();
                if (prismaClient) {
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
                } else {
                  // Fallback if Prisma is not available
                  return {
                    statusCode: 201,
                    headers,
                    body: JSON.stringify({ 
                      message: 'Data received successfully (not saved to database)',
                      data: {
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
                      }
                    })
                  };
                }
              } catch (dbError) {
                console.error('Database error:', dbError);
                // Return success even if database fails
                return {
                  statusCode: 201,
                  headers,
                  body: JSON.stringify({ 
                    message: 'Data received successfully (database error)',
                    error: dbError.message,
                    data: {
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
                    }
                  })
                };
              }
            } catch (error) {
              console.error('Error processing sensor data:', error);
              return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: error.message, details: error.stack })
              };
            }
          }
          break;
          
        default:
          return {
            statusCode: 404,
            headers,
            body: 'Not Found'
          };
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