import { PrismaClient } from '@prisma/client';

let prisma = null;

// Helper function to calculate data quality score (0-100)
const calculateDataQuality = (temperature, humidity, pressure, co, nh3, no2, pm2_5, pm10) => {
  let qualityScore = 100;
  
  // Check for valid temperature range
  if (temperature < -40 || temperature > 80) qualityScore -= 20;
  
  // Check for valid humidity range
  if (humidity < 0 || humidity > 100) qualityScore -= 15;
  
  // Check for valid pressure range
  if (pressure < 800 || pressure > 1200) qualityScore -= 10;
  
  // Check for extreme pollution levels (indicates sensor issues)
  if (co > 1000 || nh3 > 1000 || no2 > 1000) qualityScore -= 25;
  if (pm2_5 > 500 || pm10 > 1000) qualityScore -= 20;
  
  // Check for missing or zero values
  const values = [temperature, humidity, pressure, co, nh3, no2, pm2_5, pm10];
  const missingValues = values.filter(v => v === null || v === undefined || v === 0).length;
  qualityScore -= missingValues * 5;
  
  return Math.max(0, Math.min(100, qualityScore));
};

// Helper function to calculate token value based on environmental impact
const calculateTokenValue = (dataBlob) => {
  const { sensorData, metadata } = dataBlob;
  const { co, nh3, no2, pm2_5, pm10 } = sensorData;
  const quality = metadata.quality;
  
  // Base value for any environmental data
  let baseValue = 1.0;
  
  // Environmental impact multiplier
  let impactMultiplier = 1.0;
  
  // Calculate air quality index (AQI) components
  const coImpact = Math.min(co / 9, 1); // CO threshold: 9 ppm
  const no2Impact = Math.min(no2 / 0.053, 1); // NO2 threshold: 0.053 ppm
  const pm25Impact = Math.min(pm2_5 / 12, 1); // PM2.5 threshold: 12 μg/m³
  const pm10Impact = Math.min(pm10 / 54, 1); // PM10 threshold: 54 μg/m³
  
  // Higher pollution = higher value (more important data)
  impactMultiplier = 1 + (coImpact + no2Impact + pm25Impact + pm10Impact) * 0.5;
  
  // Quality multiplier (better quality = higher value)
  const qualityMultiplier = quality / 100;
  
  // Time-based multiplier (newer data = higher value)
  const timeMultiplier = 1.0; // Could be adjusted based on timestamp
  
  const finalValue = baseValue * impactMultiplier * qualityMultiplier * timeMultiplier;
  
  return Math.round(finalValue * 1000) / 1000; // Round to 3 decimal places
};

// Helper function to generate unique token ID
const generateTokenId = (dataBlob) => {
  const { sensorData, metadata } = dataBlob;
  const dataString = JSON.stringify({
    ...sensorData,
    deviceId: metadata.deviceId,
    timestamp: metadata.timestamp
  });
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex and add timestamp for uniqueness
  const timestamp = Date.now().toString(16);
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  
  return `AQT_${hashHex}_${timestamp}`;
};

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
              
              // Try to save to database using Prisma client
              try {
                const prismaClient = getPrismaClient();
                if (prismaClient) {
                  // First, ensure the device exists
                  try {
                    await prismaClient.device.upsert({
                      where: { deviceId: deviceId },
                      update: {},
                      create: {
                        name: deviceId,
                        deviceId: deviceId,
                        location: 'Default',
                        status: 'active'
                      }
                    });
                  } catch (deviceError) {
                    console.log('Device creation failed, continuing without device:', deviceError.message);
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
          
        case '/data-to-coin':
          if (httpMethod === 'POST') {
            try {
              console.log('Processing data-to-coin transformation:', requestBody);
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
                deviceId = 'ESP32_Sensor',
                walletAddress,
                metadata = {}
              } = requestBody;
              
              // Create data blob for blockchain
              const dataBlob = {
                sensorData: {
                  temperature: parseFloat(temperature) || 0,
                  humidity: parseFloat(humidity) || 0,
                  pressure: parseFloat(pressure) || 0,
                  gas_resistance: parseFloat(gas_resistance) || 0,
                  co: parseFloat(co) || 0,
                  nh3: parseFloat(nh3) || 0,
                  no2: parseFloat(no2) || 0,
                  pm2_5: parseInt(pm2_5) || 0,
                  pm10: parseInt(pm10) || 0
                },
                metadata: {
                  deviceId,
                  timestamp: new Date().toISOString(),
                  location: metadata.location || 'Unknown',
                  quality: calculateDataQuality(temperature, humidity, pressure, co, nh3, no2, pm2_5, pm10),
                  ...metadata
                },
                owner: walletAddress || 'anonymous'
              };
              
              // Generate unique token ID based on data hash
              const tokenId = generateTokenId(dataBlob);
              
              // Calculate token value based on data quality and environmental impact
              const tokenValue = calculateTokenValue(dataBlob);
              
              // Create coin/token object
              const coin = {
                tokenId,
                name: `AirQuality_${deviceId}_${Date.now()}`,
                symbol: 'AQT', // Air Quality Token
                value: tokenValue,
                dataBlob,
                mintedAt: new Date().toISOString(),
                owner: walletAddress || 'anonymous',
                blockchain: 'sui', // Using Sui blockchain
                status: 'minted'
              };
              
              // Save to database (optional - for tracking)
              try {
                const prismaClient = getPrismaClient();
                if (prismaClient) {
                  await prismaClient.sensorData.create({
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
                      location: metadata.location || 'Default',
                      status: 'tokenized'
                    }
                  });
                }
              } catch (dbError) {
                console.log('Database save failed, continuing with tokenization:', dbError.message);
              }
              
              console.log('Data successfully tokenized:', coin);
              
              return {
                statusCode: 201,
                headers,
                body: JSON.stringify({
                  message: 'Data successfully converted to coin/token',
                  coin,
                  dataBlob: dataBlob,
                  tokenId,
                  value: tokenValue
                })
              };
              
            } catch (error) {
              console.error('Error in data-to-coin transformation:', error);
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