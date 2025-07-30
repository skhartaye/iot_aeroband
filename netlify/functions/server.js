import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// POST endpoint to create a new device
app.post('/devices', async (req, res) => {
  const { name, deviceId, location } = req.body;
  try {
    const device = await prisma.device.create({
      data: { name, deviceId, location }
    });
    res.status(201).json(device);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET endpoint to fetch all devices
app.get('/devices', async (req, res) => {
  try {
    const devices = await prisma.device.findMany({
      include: {
        sensorData: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST endpoint to receive sensor data
app.post('/sensor-data', async (req, res) => {
  const { temp, hum, pm1, pm25, pm10, nh3, deviceId = 'ESP32_Sensor' } = req.body;
  try {
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
    res.status(201).json(sensorData);
  } catch (error) {
    console.error('Error saving sensor data:', error);
    res.status(400).json({ error: error.message });
  }
});

// GET endpoint to fetch all sensor data
app.get('/sensor-data', async (req, res) => {
  try {
    const data = await prisma.sensorData.findMany({
      include: {
        device: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    res.json(data);
  } catch (error) {
    console.error('Error fetching sensor data:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET endpoint to fetch sensor data by device
app.get('/sensor-data/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  try {
    const data = await prisma.sensorData.findMany({
      where: { deviceId },
      include: {
        device: true
      },
      orderBy: {
        timestamp: 'desc'
      }
    });
    res.json(data);
  } catch (error) {
    console.error('Error fetching sensor data for device:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('API is running!');
});

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

  // Convert Netlify event to Express request
  const { httpMethod, path, queryStringParameters, body } = event;
  
  // Mock Express request/response
  const req = {
    method: httpMethod,
    url: path,
    query: queryStringParameters || {},
    body: body ? JSON.parse(body) : {}
  };

  const res = {
    statusCode: 200,
    headers: {},
    json: (data) => ({ ...res, body: JSON.stringify(data) }),
    status: (code) => ({ ...res, statusCode: code }),
    send: (data) => ({ ...res, body: data })
  };

  // Route the request
  const pathSegments = path.split('/').filter(Boolean);
  if (pathSegments[0] === 'api') {
    const apiPath = '/' + pathSegments.slice(1).join('/');
    
    switch (apiPath) {
      case '/':
        return res.send('API is running!');
      case '/devices':
        if (httpMethod === 'GET') {
          return await app.get('/devices')(req, res);
        } else if (httpMethod === 'POST') {
          return await app.post('/devices')(req, res);
        }
        break;
      case '/sensor-data':
        if (httpMethod === 'GET') {
          return await app.get('/sensor-data')(req, res);
        } else if (httpMethod === 'POST') {
          return await app.post('/sensor-data')(req, res);
        }
        break;
      default:
        if (apiPath.startsWith('/sensor-data/')) {
          const deviceId = pathSegments[2];
          req.params = { deviceId };
          return await app.get('/sensor-data/:deviceId')(req, res);
        }
    }
  }

  return {
    statusCode: 404,
    headers,
    body: 'Not Found'
  };
}; 