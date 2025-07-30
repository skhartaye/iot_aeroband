import React from 'react';
import { API_ENDPOINTS } from './config.js';

export default function Trial() {
  // Connect and listen to BLE sensor
  async function connectAndListenToSensor() {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'ESP32-MultiSensor' }],
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
      const characteristic = await service.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleSensorData);

      alert('Connected and listening for sensor data!');
    } catch (err) {
      alert('BLE error: ' + err);
      console.error('BLE error:', err);
    }
  }

  // Handle incoming BLE sensor data
  function handleSensorData(event) {
    const value = event.target.value;
    let str = '';
    for (let i = 0; i < value.byteLength; i++) {
      str += String.fromCharCode(value.getUint8(i));
    }
    console.log('Received BLE:', str);

    try {
      const data = JSON.parse(str);
      console.log('Parsed sensor data:', data);
      
      // Map the simple sensor data format
      const sensorData = {
        temperature: data.temp || 0,
        humidity: data.hum || 0,
        pressure: 0, // Not included in new format
        gas_resistance: 0, // Not included in new format
        ammonia: data.nh3 || 0,
        pm1: data.pm1 || 0,
        pm25: data.pm25 || 0,
        pm10: data.pm10 || 0,
        deviceId: 'AerobandSensor',
        location: 'lab',
        status: 'ok'
      };
      
      // Log the simple data for debugging
      console.log('Temperature:', data.temp);
      console.log('Humidity:', data.hum);
      console.log('Ammonia:', data.nh3);
      console.log('PM1:', data.pm1);
      console.log('PM25:', data.pm25);
      console.log('PM10:', data.pm10);

                        fetch(API_ENDPOINTS.SENSOR_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sensorData)
      })
        .then(res => res.json())
        .then(resData => console.log('Posted to backend:', resData))
        .catch(err => console.error('POST error:', err));
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }

  return (
    <div>
      <h2>BLE Sensor Data Test</h2>
      <button onClick={connectAndListenToSensor}>Connect to Sensor</button>
    </div>
  );
}
