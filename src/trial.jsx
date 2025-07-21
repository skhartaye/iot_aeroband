import React from 'react';

export default function Trial() {
  // Connect and listen to BLE sensor
  async function connectAndListenToSensor() {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'AerobandSensor' }],
        optionalServices: ['19b10000-e8f2-537e-4f6c-d104768a1214']
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService('19b10000-e8f2-537e-4f6c-d104768a1214');
      const characteristic = await service.getCharacteristic('19b10001-e8f2-537e-4f6c-d104768a1214');

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
      // Map compact keys to full names as needed
      const sensorData = {
        value: data.t, // temperature
        type: 'temperature',
        unit: 'C',
        deviceId: 'AerobandSensor',
        location: 'lab',
        status: 'ok',
        // Add more fields if needed
      };

      fetch('http://localhost:39000/sensor-data', {
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
