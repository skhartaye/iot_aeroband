# Aeroband IoT App

This project is an end-to-end IoT solution that collects sensor data from a microcontroller (e.g., ESP32), sends it to a Node.js backend via HTTP, and stores it in a Neon (PostgreSQL) database using Prisma. The backend also supports BLE (Bluetooth Low Energy) integration for real-time sensor data streaming to a web frontend.

---

## Features
- **Microcontroller Integration:** ESP32/Arduino sends sensor data via HTTP POST and BLE.
- **Backend:** Node.js + Express API with Prisma ORM, connected to Neon Postgres.
- **Frontend:** React app with BLE support to receive and forward sensor data.
- **Interactive Maps:** Real-time sensor location mapping with Leaflet integration.
- **Database:** Neon (serverless Postgres) for scalable, cloud-based storage.

---

## Prerequisites
- Node.js (v18+ recommended)
- npm
- Neon account ([neon.tech](https://neon.tech/))
- ESP32/ESP8266 or compatible microcontroller (for hardware integration)
- Chrome browser (for Web Bluetooth API)

---

## Setup

### 1. Clone the Repository
```sh
git clone <repo-url>
cd aeroband-iot-app
```

### 2. Install Dependencies
```sh
npm install
```

### 3. Configure Neon Database
- Create a Neon project and database.
- Copy your Neon Postgres connection string.
- Create a `.env` file in the project root:
  ```env
  DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
  ```

### 4. Set Up Prisma Schema
- Edit `prisma/schema.prisma` to define your models (e.g., `SensorData`).
- Push the schema to Neon:
  ```sh
  npx prisma db push
  npx prisma generate
  ```

### 5. Run the Backend
```sh
node src/server.js
```
- The API will run on `http://localhost:39000` (or the port you set).

### 6. Run the Frontend
```sh
npm run dev
```
- Open your browser to the provided local URL.

---

## Microcontroller Integration
- Use the provided `esp32_post_example.ino` as a template.
- Update WiFi credentials and set the `endpointUrl` to your backend's IP and port.
- The microcontroller will POST sensor data as JSON to `/sensor-data` every 5 seconds.

---

## BLE Integration (Frontend)
- Use the `trial.jsx` React component to connect to the BLE device (`AerobandSensor`).
- The frontend listens for BLE notifications, parses the JSON, and can POST to the backend.

## Maps Feature
- **Interactive Sensor Map:** Navigate to the Maps view to see all sensor locations on an interactive map.
- **Real-time Data:** View current sensor readings including temperature, humidity, PM2.5, PM10, and CO levels.
- **Location Management:** Click on map markers or use the sidebar to select and center on specific sensors.
- **Air Quality Indicators:** Color-coded air quality status (Excellent, Good, Moderate, Poor) for quick assessment.
- **User Location Detection:** Automatically detects and displays your current location on the map.
- **IQ Air Integration:** Shows real-time air quality data from nearby monitoring stations.
- **Responsive Design:** Works seamlessly on both desktop and mobile devices.

### Setting up IQ Air API
1. **Get Free API Key:** Visit [https://aqicn.org/data-platform/token/](https://aqicn.org/data-platform/token/) to get your free API key.
2. **Configure API Key:** Update `src/config.js` with your API key:
   ```javascript
   export const IQ_AIR_CONFIG = {
     API_KEY: 'your_actual_api_key_here',
     // ... other config
   };
   ```
3. **Features:** The API provides real-time AQI data, PM2.5, PM10, temperature, humidity, and pressure readings from monitoring stations worldwide.

---

## API Endpoints
- `POST /sensor-data` — Add new sensor data (expects JSON)
- `GET /sensor-data` — Retrieve all sensor data

---

## Troubleshooting
- **Database connection errors:**
  - Ensure Neon database is running and credentials are correct in `.env`.
  - Check your internet connection and firewall settings.
- **Microcontroller cannot POST:**
  - Make sure backend is running and accessible from the microcontroller's network.
  - Use your computer's local IP address in `endpointUrl`.
- **BLE not working in browser:**
  - Use Chrome and ensure your device supports Web Bluetooth API.

---

## Credits
- Neon (https://neon.tech/)
- Prisma (https://www.prisma.io/)
- Arduino, ESP32, and the open-source community

---

## License
MIT
