import { useState, useEffect, useRef } from 'react';
import { CloudIcon, SunIcon, ArrowTrendingUpIcon, SparklesIcon, FireIcon, MoonIcon, HomeIcon, ChartBarIcon, BeakerIcon, EyeIcon } from '@heroicons/react/24/solid';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js';
import './App.css';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler);

function App() {
  const [device, setDevice] = useState(null);
  const [server, setServer] = useState(null);
  const [data, setData] = useState({
    temperature: null,
    humidity: null,
    pressure: null,
    gas_resistance: null,
    co: null,
    nh3: null,
    no2: null,
    pm2_5: null,
    pm10: null,
  });
  const [history, setHistory] = useState({
    temperature: [],
    humidity: [],
    pressure: [],
    gas_resistance: [],
    co: [],
    nh3: [],
    no2: [],
    pm2_5: [],
    pm10: [],
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('home'); // 'home' or 'graphs'
  const [lastUpdate, setLastUpdate] = useState(null);

  // Theme toggle effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // BLE UUIDs
  const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
  const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

  const handleConnect = async () => {
    setError('');
    setConnecting(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID],
      });
      setDevice(device);
      setDeviceName(device.name || 'Unknown Device');
      const server = await device.gatt.connect();
      setServer(server);
      setIsConnected(true);
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        let jsonStr = '';
        for (let i = 0; i < value.byteLength; i++) {
          jsonStr += String.fromCharCode(value.getUint8(i));
        }
        try {
          const dataObj = JSON.parse(jsonStr);
          console.log('Received BLE data:', dataObj);
          
          setData(prev => {
            // Extract values from the new ESP32 format
            const {
              temperature,
              humidity,
              pressure,
              gas_resistance,
              co,
              nh3,
              no2,
              pm2_5,
              pm10
            } = dataObj;
            
            // Update history for each metric
            setHistory(h => ({
              temperature: updateHistory(h.temperature, temperature),
              humidity: updateHistory(h.humidity, humidity),
              pressure: updateHistory(h.pressure, pressure),
              gas_resistance: updateHistory(h.gas_resistance, gas_resistance),
              co: updateHistory(h.co, co),
              nh3: updateHistory(h.nh3, nh3),
              no2: updateHistory(h.no2, no2),
              pm2_5: updateHistory(h.pm2_5, pm2_5),
              pm10: updateHistory(h.pm10, pm10),
            }));
            
            // Send data to API
            sendToAPI({
              ...dataObj,
              deviceId: 'ESP32_001' // Use the existing device ID
            });
            
            // Update last update timestamp
            setLastUpdate(new Date());
            
            return {
              temperature,
              humidity,
              pressure,
              gas_resistance,
              co,
              nh3,
              no2,
              pm2_5,
              pm10,
            };
          });
        } catch (e) {
          console.error('Failed to parse sensor data:', e);
          setError('Failed to parse sensor data');
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
      setIsConnected(false);
      setDevice(null);
      setServer(null);
      setDeviceName('');
    }
  };

  function updateHistory(arr, val) {
    if (val === null || val === undefined || isNaN(val)) return arr;
    const newArr = [...arr, val];
    if (newArr.length > 20) newArr.shift();
    return newArr;
  }

  // Function to send data to API
  const sendToAPI = async (sensorData) => {
    try {
      const response = await fetch('https://iot.aeroband.org/api/sensor-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sensorData),
      });
      
      if (response.ok) {
        console.log('Data sent to API successfully');
      } else {
        console.error('Failed to send data to API:', response.status);
      }
    } catch (error) {
      console.error('Error sending data to API:', error);
    }
  };

  // Card data array for easier mapping
  const cards = [
    { key: 'temperature', label: 'Temperature', value: data.temperature, unit: '°C', icon: SunIcon, color: 'from-red-200 to-red-100' },
    { key: 'humidity', label: 'Humidity', value: data.humidity, unit: '%', icon: CloudIcon, color: 'from-blue-200 to-blue-100' },
    { key: 'pressure', label: 'Pressure', value: data.pressure, unit: 'hPa', icon: ArrowTrendingUpIcon, color: 'from-green-200 to-green-100' },
    { key: 'gas_resistance', label: 'Gas Resistance', value: data.gas_resistance, unit: 'kΩ', icon: FireIcon, color: 'from-orange-200 to-orange-100' },
    { key: 'co', label: 'CO', value: data.co, unit: 'ppm', icon: BeakerIcon, color: 'from-purple-200 to-purple-100' },
    { key: 'nh3', label: 'NH3', value: data.nh3, unit: 'ppm', icon: EyeIcon, color: 'from-indigo-200 to-indigo-100' },
    { key: 'no2', label: 'NO2', value: data.no2, unit: 'ppm', icon: SparklesIcon, color: 'from-pink-200 to-pink-100' },
    { key: 'pm2_5', label: 'PM2.5', value: data.pm2_5, unit: 'µg/m³', icon: SparklesIcon, color: 'from-amber-200 to-amber-100' },
    { key: 'pm10', label: 'PM10', value: data.pm10, unit: 'µg/m³', icon: SparklesIcon, color: 'from-orange-200 to-orange-100' },
  ];

  return (
    <div className={`w-screen min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500 pb-16 md:pb-0`}>
      {/* Nav Bar */}
      <nav className="w-full flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/80 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <span className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Aeroband</span>
        <div className="flex items-center gap-4">
          {/* Connection status dot, green if connected, red if not */}
          <span className="inline-block align-middle">
            <span
              className={`inline-block w-3 h-3 rounded-full mr-1 border border-gray-300 dark:border-gray-700 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              aria-label={isConnected ? 'Connected' : 'Disconnected'}
              title={isConnected ? 'Connected' : 'Disconnected'}
            />
          </span>
          {/* Connect/Disconnect button */}
          {!isConnected ? (
            <button
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
              onClick={handleConnect}
              disabled={connecting || !!server}
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          ) : (
            <button
              className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition"
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          )}
          {/* Graphs toggle (desktop only) */}
          <button
            className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
            onClick={() => setViewMode(viewMode === 'home' ? 'graphs' : 'home')}
          >
            {viewMode === 'home' ? <ChartBarIcon className="h-5 w-5" /> : <HomeIcon className="h-5 w-5" />}
            <span>{viewMode === 'home' ? 'Graphs' : 'Default'}</span>
          </button>
          {/* Theme toggle */}
          <button
            className="flex items-center gap-2 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <MoonIcon className="h-5 w-5" /> : <SunIcon className="h-5 w-5" />}
            <span className="hidden md:inline">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </nav>
      <main className="w-full flex flex-col items-center flex-1 py-6 px-2">
        {error && <div className="mb-4 text-red-600 font-medium">{error}</div>}
        {lastUpdate && (
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
        <section className="w-full max-w-6xl">
          <div className="flex flex-col items-center mb-2">
          <h1 className="text-3xl font-extrabold mb-4 text-gray-800 dark:text-gray-100 drop-shadow-sm">Live Sensor Data</h1>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400 rounded-full mb-1" />
            <p className="text-gray-400 dark:text-gray-500 text-xs">Updated in real time from your BLE device</p>
          </div>
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4 max-w-6xl mx-auto">
              {cards.slice(0, 4).map((card, idx) => (
                <DataCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  unit={card.unit}
                  Icon={card.icon}
                  history={history[card.key]}
                  showGraph={viewMode === 'graphs'}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-4 max-w-6xl mx-auto mt-4">
              {cards.slice(4).map((card, idx) => (
                <DataCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  unit={card.unit}
                  Icon={card.icon}
                  history={history[card.key]}
                  showGraph={viewMode === 'graphs'}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 w-full flex md:hidden justify-around items-center bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-700 z-50 h-14">
        <button
          className={`flex flex-col items-center justify-center flex-1 py-2 ${viewMode === 'home' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setViewMode('home')}
        >
          <HomeIcon className="h-6 w-6 mb-1" />
          <span className="text-xs">Home</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center flex-1 py-2 ${viewMode === 'graphs' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setViewMode('graphs')}
        >
          <ChartBarIcon className="h-6 w-6 mb-1" />
          <span className="text-xs">Graphs</span>
        </button>
      </nav>
    </div>
  );
}

function DataCard({ label, value, unit, Icon, history = [], showGraph }) {
  // Animate value change
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Chart.js data and options
  const chartData = {
    labels: history.map((_, i) => i + 1),
    datasets: [
      {
        data: history,
        fill: true,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
  };

  return (
    <div className="w-full h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col items-center transition-all duration-300">
      <Icon className="h-8 w-8 mb-1 text-gray-500 dark:text-gray-300" />
      <div className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 transition-all duration-300">
        {displayValue !== null && displayValue !== undefined ? displayValue : '--'} <span className="text-sm font-normal">{unit}</span>
      </div>
      {showGraph && (
        <div className="w-full h-16 mt-2">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}

export default App;
