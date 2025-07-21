# iot_aeroband

A modern IoT web dashboard for Aeroband BLE sensors, built with React, Vite, Tailwind CSS, and Chart.js. Connects to BLE devices, displays live sensor data, and visualizes trends with responsive charts.

## Features
- Connect to BLE sensors (Web Bluetooth API)
- Live data cards for Humidity, Temperature, Pressure, PM2.5, Gas Resistance
- Responsive design: mobile and desktop layouts
- Light/Dark theme toggle
- Graphs for each metric (last 20 values)
- Mobile bottom nav and desktop graph toggle

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run Locally
```sh
cd frontend
npm install
npm run dev
```
Visit [http://localhost:5173](http://localhost:5173) in your browser.

### BLE Device Requirements
- Device must advertise a service with UUID: `19b10000-e8f2-537e-4f6c-d104768a1214`
- Device must have a characteristic with UUID: `19b10001-e8f2-537e-4f6c-d104768a1214`
- Data should be sent as a compact JSON string (see Arduino example in repo)

## Deployment

### Deploy to Netlify
1. Push this repo to GitHub.
2. Import the repo in Netlify and deploy.
3. Add your custom subdomain (e.g., `iot.aeroband.org`) in Netlify domain settings.
4. Set up a CNAME record in your DNS provider pointing `iot.aeroband.org` to your Netlify app.

### Custom Domain Example
- **Host:** `iot.aeroband.org`
- **Type:** `CNAME`
- **Value:** `your-app.netlify.app`

## License
MIT
