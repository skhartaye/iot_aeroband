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
  } = req.body;
  
  try {
    const sensorData = await prisma.sensorData.create({
      data: { 
        temperature: temperature || 0,
        humidity: humidity || 0,
        pressure: pressure || 0,
        gas_resistance: gas_resistance || 0,
        co: co || 0,
        nh3: nh3 || 0,
        no2: no2 || 0,
        pm2_5: pm2_5 || 0,
        pm10: pm10 || 0,
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

// For Vercel deployment
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
} 