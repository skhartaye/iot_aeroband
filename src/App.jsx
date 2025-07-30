import { useState, useEffect, useRef } from 'react';
import { CloudIcon, SunIcon, ArrowTrendingUpIcon, SparklesIcon, FireIcon, MoonIcon, HomeIcon, ChartBarIcon } from '@heroicons/react/24/solid';
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
    humid: null,
    temp: null,
    pressure: null,
    pm25: null,
    gasResistance: null,
  });
  const [history, setHistory] = useState({
    humid: [],
    temp: [],
    pressure: [],
    pm25: [],
    gasResistance: [],
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('home'); // 'home' or 'graphs'

  // Theme toggle effect
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // BLE UUIDs
  const SERVICE_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';
  const CHARACTERISTIC_UUID = '19b10000-e8f2-537e-4f6c-d104768a1214';

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
            // Extract values from the ESP32 format: {"temp":22.8,"hum":40.7,"pm1":21,"pm25":19,"pm10":31,"nh3":913.08}
            const temp = dataObj.temp;
            const humid = dataObj.hum;
            const pm1 = dataObj.pm1;
            const pm25 = dataObj.pm25;
            const pm10 = dataObj.pm10;
            const nh3 = dataObj.nh3;
            
            // Update history for each metric
            setHistory(h => ({
              humid: updateHistory(h.humid, humid),
              temp: updateHistory(h.temp, temp),
              pressure: updateHistory(h.pressure, null), // Not in current format
              pm25: updateHistory(h.pm25, pm25),
              gasResistance: updateHistory(h.gasResistance, nh3), // Using nh3 as gas resistance
            }));
            
            // Send data to API
            sendToAPI({
              temp: temp,
              hum: humid,
              pm1: pm1,
              pm25: pm25,
              pm10: pm10,
              nh3: nh3
            });
            
            return {
              temp: temp,
              humid: humid,
              pressure: null, // Not available in current format
              pm25: pm25,
              gasResistance: nh3, // Using nh3 as gas resistance
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
    { key: 'humid', label: 'Humidity', value: data.humid, unit: '%', icon: CloudIcon, color: 'from-blue-200 to-blue-100' },
    { key: 'temp', label: 'Temperature', value: data.temp, unit: '°C', icon: SunIcon, color: 'from-red-200 to-red-100' },
    { key: 'pm25', label: 'PM 2.5', value: data.pm25, unit: 'µg/m³', icon: SparklesIcon, color: 'from-yellow-200 to-yellow-100' },
    { key: 'gasResistance', label: 'NH3 (Ammonia)', value: data.gasResistance, unit: 'ppm', icon: FireIcon, color: 'from-purple-200 to-purple-100' },
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
        <h1 className="text-3xl font-extrabold mb-4 text-gray-800 dark:text-gray-100 drop-shadow-sm">BLE Dashboard</h1>
        {error && <div className="mb-4 text-red-600 font-medium">{error}</div>}
        <section className="w-full max-w-4xl">
          <div className="flex flex-col items-center mb-2">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-1 tracking-tight">Live Sensor Data</h2>
            <div className="w-12 h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-yellow-400 rounded-full mb-1" />
            <p className="text-gray-400 dark:text-gray-500 text-xs">Updated in real time from your BLE device</p>
          </div>
          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {cards.map((card, idx) => (
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
