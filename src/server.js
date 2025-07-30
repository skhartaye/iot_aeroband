import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// POST endpoint to receive sensor data
app.post('/sensor-data', async (req, res) => {
  const { temp, hum, pm1, pm25, pm10, nh3 } = req.body;
  try {
    const sensorData = await prisma.sensorData.create({
      data: { 
        temperature: temp,
        humidity: hum,
        pressure: null, // Not available in current format
        gas_resistance: nh3, // Using nh3 as gas resistance
        ammonia: nh3, // Also store as ammonia
        pm1: pm1,
        pm25: pm25,
        pm10: pm10,
        deviceId: 'ESP32_Sensor',
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

// (Optional) GET endpoint to fetch all sensor data
app.get('/sensor-data', async (req, res) => {
  const data = await prisma.sensorData.findMany();
  res.json(data);
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