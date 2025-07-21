import express from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// POST endpoint to receive sensor data
app.post('/sensor-data', async (req, res) => {
  const { value, type, unit, deviceId, location, status } = req.body;
  try {
    const sensorData = await prisma.sensorData.create({
      data: { value, type, unit, deviceId, location, status }
    });
    res.status(201).json(sensorData);
  } catch (error) {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 