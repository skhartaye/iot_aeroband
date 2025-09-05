import { useState, useEffect, useRef } from 'react';
import { CloudIcon, SunIcon, ArrowTrendingUpIcon, SparklesIcon, FireIcon, MoonIcon, HomeIcon, ChartBarIcon, BeakerIcon, EyeIcon, MapIcon, WalletIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid';
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
import Maps from './Maps.jsx';
import Tasks from './Tasks.jsx';
import Modal from './components/Modal.jsx';
import { useSuiWallet } from './hooks/useSuiWallet.js';
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
    ethanol: null,
    h2: null,
    nh3: null,
    ch4: null,
    pm2_5: null,
    pm10: null,
  });
  const [history, setHistory] = useState({
    temperature: [],
    humidity: [],
    pressure: [],
    gas_resistance: [],
    co: [],
    ethanol: [],
    h2: [],
    nh3: [],
    ch4: [],
    pm2_5: [],
    pm10: [],
  });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [theme, setTheme] = useState('light');
  const [viewMode, setViewMode] = useState('home'); // 'home', 'graphs', 'maps', or 'tasks'
  const [lastUpdate, setLastUpdate] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [modalLastUpdated, setModalLastUpdated] = useState(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : true);
  const [modalPage, setModalPage] = useState(1);
  const itemsPerPage = 6;
  const lastNotifCountRef = useRef(0);

  // Responsive detector for mobile vs desktop
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handleChange = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', handleChange);
    } else {
      // Safari
      mq.addListener(handleChange);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handleChange);
      } else {
        mq.removeListener(handleChange);
      }
    };
  }, []);

  // Get wallet connection status
  const { connectedWallet, connectedAccounts, isWalletConnected, wallets, isInitializing, walletLoadingStates, error: walletError, connectToWallet, disconnectFromWallet, connectionStatus, suiClient, noWalletDetected, walletInstallHint, currentAccount } = useSuiWallet()
  const isWalletConnectedStatus = connectedWallet && isWalletConnected(connectedWallet)

  // Debug logging
  console.log('Wallet Debug:', {
    connectedWallet,
    isWalletConnected,
    isWalletConnectedStatus,
    hasAccounts: connectedWallet?.accounts?.length > 0,
    suiClient: !!suiClient,
    suiClientType: typeof suiClient,
    connectionStatus,
    connectedWalletAccounts: connectedWallet?.accounts?.length || 0,
    connectedWalletName: connectedWallet?.name
  })

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
      
      // Auto-reconnect on disconnection
      device.addEventListener('gattserverdisconnected', async () => {
        console.warn('BLE device disconnected, attempting reconnect...');
        setIsConnected(false);
        try {
          const gatt = await device.gatt.connect();
          setServer(gatt);
          setIsConnected(true);
          const svc = await gatt.getPrimaryService(SERVICE_UUID);
          const ch = await svc.getCharacteristic(CHARACTERISTIC_UUID);
          await ch.startNotifications();
        } catch (reErr) {
          console.error('Failed to auto-reconnect:', reErr);
        }
      });

      // Always use latest GATT server to avoid stale references
      const gatt = device.gatt.connected ? device.gatt : await device.gatt.connect();
      setServer(gatt);
      const service = await gatt.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      // Watchdog to detect if no data is received
      let lastDataTs = Date.now();
      let watchdogTimer = null;
      const startWatchdog = () => {
        if (watchdogTimer) clearInterval(watchdogTimer);
        watchdogTimer = setInterval(async () => {
          const elapsed = Date.now() - lastDataTs;
          if (elapsed > 15000) {
            console.warn('No BLE data for >15s, attempting to restart notifications');
            try {
              await characteristic.stopNotifications();
      await characteristic.startNotifications();
              lastDataTs = Date.now();
            } catch (e) {
              console.error('Failed to restart notifications:', e);
            }
          }
        }, 5000);
      };

      await characteristic.startNotifications();
      startWatchdog();

      // Attempt an initial read to prompt the peripheral
      try {
        const initialValue = await characteristic.readValue();
        const decoder = new TextDecoder('utf-8');
        const str = decoder.decode(initialValue.buffer);
        if (str) console.log('Initial read value:', str);
      } catch (e) {
        console.log('Initial read not supported or failed:', e?.message || e);
      }

      const decoder = new TextDecoder('utf-8');
      let partialBuffer = '';
      characteristic.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        lastDataTs = Date.now();
        const chunk = decoder.decode(value.buffer);
        let jsonStr = chunk;
        // Concatenate partial frames if needed
        if (partialBuffer) {
          jsonStr = partialBuffer + chunk;
          partialBuffer = '';
        }
        console.log('Raw BLE string received:', jsonStr);
        try {
          // Handle cases where multiple JSON objects or partials arrive
          // Split on newline if device separates frames, else try naive parse then fallback
          const frames = jsonStr.includes('\n') ? jsonStr.split('\n').filter(Boolean) : [jsonStr];
          for (const frame of frames) {
            let dataObj;
            try {
              dataObj = JSON.parse(frame);
            } catch (inner) {
              // If not valid JSON, save partial and wait for next chunk
              partialBuffer = frame;
              continue;
            }
          console.log('Received BLE data:', dataObj);
          
          setData(prev => {
            // Extract values with fallback parsing for different formats
            const temperature = dataObj.temperature?.value ?? dataObj.temperature ?? null;
            const humidity = dataObj.humidity?.value ?? dataObj.humidity ?? null;
            const pressure = dataObj.pressure?.value ?? dataObj.pressure ?? null;
            const gas_resistance = dataObj.gas_resistance?.value ?? dataObj.gas_resistance ?? null;
            const co = dataObj.co?.value ?? dataObj.co ?? null;
            const ethanol = dataObj.ethanol?.value ?? dataObj.ethanol ?? null;
            const h2 = dataObj.h2?.value ?? dataObj.h2 ?? null;
            const nh3 = dataObj.nh3?.value ?? dataObj.nh3 ?? dataObj.ammonia?.value ?? dataObj.ammonia ?? null;
            const ch4 = dataObj.ch4?.value ?? dataObj.ch4 ?? null;
            const pm2_5 = dataObj.pm2_5?.value ?? dataObj.pm2_5 ?? dataObj.pm25?.value ?? dataObj.pm25 ?? null;
            const pm10 = dataObj.pm10?.value ?? dataObj.pm10 ?? null;
            
            console.log('Setting data state:', {
              temperature,
              humidity,
              pressure,
              gas_resistance,
              co,
              ethanol,
              h2,
              nh3,
              ch4,
              pm2_5,
              pm10
            });
            
            // Validate and convert to numbers
            const validatedData = {
              temperature: temperature !== null && !isNaN(temperature) ? parseFloat(temperature) : null,
              humidity: humidity !== null && !isNaN(humidity) ? parseFloat(humidity) : null,
              pressure: pressure !== null && !isNaN(pressure) ? parseFloat(pressure) : null,
              gas_resistance: gas_resistance !== null && !isNaN(gas_resistance) ? parseFloat(gas_resistance) : null,
              co: co !== null && !isNaN(co) ? parseFloat(co) : null,
              ethanol: ethanol !== null && !isNaN(ethanol) ? parseFloat(ethanol) : null,
              h2: h2 !== null && !isNaN(h2) ? parseFloat(h2) : null,
              nh3: nh3 !== null && !isNaN(nh3) ? parseFloat(nh3) : null,
              ch4: ch4 !== null && !isNaN(ch4) ? parseFloat(ch4) : null,
              pm2_5: pm2_5 !== null && !isNaN(pm2_5) ? parseFloat(pm2_5) : null,
              pm10: pm10 !== null && !isNaN(pm10) ? parseFloat(pm10) : null,
            };
            
            console.log('Validated data:', validatedData);
            
            // Update history for each metric
            setHistory(h => ({
              temperature: updateHistory(h.temperature, validatedData.temperature),
              humidity: updateHistory(h.humidity, validatedData.humidity),
              pressure: updateHistory(h.pressure, validatedData.pressure),
              gas_resistance: updateHistory(h.gas_resistance, validatedData.gas_resistance),
              co: updateHistory(h.co, validatedData.co),
              ethanol: updateHistory(h.ethanol, validatedData.ethanol),
              h2: updateHistory(h.h2, validatedData.h2),
              nh3: updateHistory(h.nh3, validatedData.nh3),
              ch4: updateHistory(h.ch4, validatedData.ch4),
              pm2_5: updateHistory(h.pm2_5, validatedData.pm2_5),
              pm10: updateHistory(h.pm10, validatedData.pm10),
            }));
            
            // Send data to API
            sendToAPI({
              ...dataObj,
              deviceId: 'ESP32_001' // Use the existing device ID
            });
            
            // Update last update timestamp
            setLastUpdate(new Date());
            
            return validatedData;
          });
          }
        } catch (e) {
          console.error('Failed to parse sensor data:', e);
          console.error('Raw BLE data string:', jsonStr);
          setError(`Failed to parse sensor data: ${e.message}`);
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
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

  // Notifications disabled
  const addNotification = () => {};

  // Auto-open modal only on mobile for new critical alerts
  useEffect(() => {
    if (!isMobile) {
      lastNotifCountRef.current = notifications.length;
      return;
    }
    const prevCount = lastNotifCountRef.current;
    if (notifications.length > prevCount) {
      const newOnes = notifications.slice(prevCount);
      const hasCritical = newOnes.some(n => n.level === 'error');
      if (hasCritical) {
        setShowNotificationModal(true);
        setModalLastUpdated(new Date());
      }
    }
    lastNotifCountRef.current = notifications.length;
  }, [notifications.length, isMobile, notifications]);

  // Function to dismiss notifications
  const dismissNotification = (notificationId) => {
    setNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  };


  // Alert thresholds for different sensor types
  const alertThresholds = {
    temperature: { warning: { min: 10, max: 30 }, critical: { min: 5, max: 35 } },
    humidity: { warning: { min: 30, max: 70 }, critical: { min: 20, max: 80 } },
    pressure: { warning: { min: 950, max: 1050 }, critical: { min: 900, max: 1100 } },
    // Gas resistance (kΩ): higher is better. <50 kΩ = poor, <10 kΩ = very polluted
    gas_resistance: { warning: { min: 50, max: 999999 }, critical: { min: 10, max: 999999 } },
    co: { warning: { min: 0, max: 9 }, critical: { min: 0, max: 15 } },
    ethanol: { warning: { min: 0, max: 100 }, critical: { min: 0, max: 200 } },
    h2: { warning: { min: 0, max: 1000 }, critical: { min: 0, max: 2000 } },
    nh3: { warning: { min: 0, max: 25 }, critical: { min: 0, max: 50 } },
    ch4: { warning: { min: 0, max: 1000 }, critical: { min: 0, max: 2000 } },
    pm2_5: { warning: { min: 0, max: 25 }, critical: { min: 0, max: 50 } },
    pm10: { warning: { min: 0, max: 50 }, critical: { min: 0, max: 100 } },
  };

  // Function to determine alert level for a sensor value
  const getAlertLevel = (sensorKey, value) => {
    if (value === null || value === undefined || isNaN(value)) return null;
    const thresholds = alertThresholds[sensorKey];
    if (!thresholds) return null;

    // For gas_resistance: higher is better; low values are concerning.
    if (sensorKey === 'gas_resistance') {
      if (value < thresholds.critical.min) return 'critical';
      if (value < thresholds.warning.min) return 'warning';
      return null;
    }

    // Default: out-of-range on either side is concerning.
    if (value < thresholds.critical.min || value > thresholds.critical.max) return 'critical';
    if (value < thresholds.warning.min || value > thresholds.warning.max) return 'warning';
    return null;
  };


  // Function to convert sensor data to coin/token
  const convertDataToCoin = async (sensorData) => {
    try {
      // Get wallet address if connected
      const walletAddress = connectedWallet?.accounts?.[0]?.address || null;
      
      const response = await fetch('https://iot.aeroband.org/api/data-to-coin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...sensorData,
          walletAddress,
          metadata: {
            location: 'User Location', // Could be enhanced with GPS
            deviceType: 'ESP32',
            dataSource: 'BLE Sensor'
          }
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Data successfully converted to coin:', result);
        
        // Show success notification
        addNotification(
          'Data Tokenized',
          `Successfully converted sensor data to token!\nToken ID: ${result.tokenId}\nValue: ${result.value} AQT`,
          'success'
        );
        
        
        return result;
      } else {
        console.error('Failed to convert data to coin:', response.status);
        alert('❌ Failed to convert data to coin. Please try again.');
      }
    } catch (error) {
      console.error('Error converting data to coin:', error);
      alert('❌ Error converting data to coin. Please try again.');
    }
  };

  // Card data array for easier mapping
  const cards = [
    { key: 'temperature', label: 'Temperature', value: data.temperature, unit: '°C', icon: SunIcon, color: 'from-red-200 to-red-100' },
    { key: 'humidity', label: 'Humidity', value: data.humidity, unit: '%', icon: CloudIcon, color: 'from-blue-200 to-blue-100' },
    { key: 'pressure', label: 'Pressure', value: data.pressure, unit: 'hPa', icon: ArrowTrendingUpIcon, color: 'from-green-200 to-green-100' },
    { key: 'gas_resistance', label: 'Gas Resistance', value: data.gas_resistance, unit: 'kΩ', icon: FireIcon, color: 'from-orange-200 to-orange-100' },
    { key: 'co', label: 'CO', value: data.co, unit: 'ppm', icon: BeakerIcon, color: 'from-purple-200 to-purple-100' },
    { key: 'ethanol', label: 'Ethanol', value: data.ethanol, unit: 'ppm', icon: SparklesIcon, color: 'from-pink-200 to-pink-100' },
    { key: 'h2', label: 'H2', value: data.h2, unit: 'ppm', icon: SparklesIcon, color: 'from-cyan-200 to-cyan-100' },
    { key: 'nh3', label: 'NH3', value: data.nh3, unit: 'ppm', icon: EyeIcon, color: 'from-indigo-200 to-indigo-100' },
    { key: 'ch4', label: 'CH4', value: data.ch4, unit: 'ppm', icon: SparklesIcon, color: 'from-emerald-200 to-emerald-100' },
    { key: 'pm2_5', label: 'PM2.5', value: data.pm2_5, unit: 'µg/m³', icon: SparklesIcon, color: 'from-amber-200 to-amber-100' },
    { key: 'pm10', label: 'PM10', value: data.pm10, unit: 'µg/m³', icon: SparklesIcon, color: 'from-orange-200 to-orange-100' },
  ];

  // Notifications disabled for alerts
  useEffect(() => {}, [data]);

  return (
    <div className={`w-screen min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 via-white to-purple-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-500 pb-[calc(64px+env(safe-area-inset-bottom,0px))] md:pb-0`}>
      {/* Nav Bar */}
      <nav className="w-full flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/80 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <span className="text-xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">Aeroband</span>
        <div className="flex items-center gap-3">
          {/* BLE Connection status and controls - Only visible when wallet connected */}
          {isWalletConnectedStatus && (
            <div className="flex items-center gap-2">
              {/* Connection status dot, green if connected, red if not */}
              <span className="inline-block align-middle">
                <span
                  className={`inline-block w-2 h-2 rounded-full border border-gray-300 dark:border-gray-700 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                  aria-label={isConnected ? 'Connected' : 'Disconnected'}
                  title={isConnected ? 'Connected' : 'Disconnected'}
                />
              </span>
              {/* Connect/Disconnect button */}
              {!isConnected ? (
                <button
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 transition"
                  onClick={handleConnect}
                  disabled={connecting || !!server}
                >
                  {connecting ? '...' : 'CONNECT'}
                </button>
              ) : (
                <button
                  className="px-2 py-1 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs hover:bg-gray-400 dark:hover:bg-gray-600 transition"
                  onClick={handleDisconnect}
                >
                  BLE
                </button>
              )}
              
              {/* Tokenize Data button - Only show when BLE is connected and data is available */}
              {isConnected && data.temperature !== null && (
                <button
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition"
                  onClick={() => convertDataToCoin({
                    ...data,
                    deviceId: 'ESP32_001'
                  })}
                  title="Convert sensor data to blockchain token"
                >
                  🪙 TOKENIZE
                </button>
              )}
              
            </div>
          )}
          
          {/* Wallet Connection - Compact version */}
          <WalletConnection 
            connectedWallet={connectedWallet}
            isWalletConnected={isWalletConnected}
            isWalletConnectedStatus={isWalletConnectedStatus}
            wallets={wallets}
            isInitializing={isInitializing}
            walletLoadingStates={walletLoadingStates}
            error={walletError}
            connectToWallet={connectToWallet}
            disconnectFromWallet={disconnectFromWallet}
            connectionStatus={connectionStatus}
          />
          
          {/* View mode toggle (desktop only) */}
          <button
            className={`hidden md:flex items-center gap-1 px-2 py-1 rounded transition ${
              viewMode === 'graphs' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
            }`}
            onClick={() => setViewMode(viewMode === 'home' ? 'graphs' : 'home')}
          >
            {viewMode === 'home' ? <ChartBarIcon className="h-4 w-4" /> : <HomeIcon className="h-4 w-4" />}
            <span className="text-xs">{viewMode === 'home' ? 'Graphs' : 'Home'}</span>
          </button>
          
          {/* Maps button */}
          <button
            className={`hidden md:flex items-center gap-1 px-2 py-1 rounded transition ${
              viewMode === 'maps' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
            }`}
            onClick={() => setViewMode('maps')}
          >
            <MapIcon className="h-4 w-4" />
            <span className="text-xs">Maps</span>
          </button>
          
          {/* Tasks button */}
          <button
            className={`hidden md:flex items-center gap-1 px-2 py-1 rounded transition ${
              viewMode === 'tasks' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
            }`}
            onClick={() => setViewMode('tasks')}
          >
            <ClipboardDocumentListIcon className="h-4 w-4" />
            <span className="text-xs">Tasks</span>
          </button>
          
          
          {/* Theme toggle - Last */}
          <button
            className="flex items-center gap-1 px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
            <span className="hidden md:inline text-xs">{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </nav>
      
      {/* Notification Modal (mobile only) */}
      <Modal
        isOpen={isMobile && showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        title={`Notifications (${notifications.length})`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Real-time update indicator */}
          {notifications.length > 0 && (
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Live updates enabled</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Auto-refresh</span>
                {modalLastUpdated && (
                  <span className="text-xs opacity-75">
                    Updated: {modalLastUpdated.toLocaleTimeString()}
                </span>
                )}
              </div>
            </div>
          )}
          
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <>
              {/* Bulk Actions */}
              {notifications.length > 3 && (
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {notifications.length} notifications
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const errorNotifications = notifications.filter(n => n.level === 'error');
                        errorNotifications.forEach(n => dismissNotification(n.id));
                      }}
                      className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                      Dismiss Critical
                    </button>
                    <button
                      onClick={() => {
                        const warningNotifications = notifications.filter(n => n.level === 'warning');
                        warningNotifications.forEach(n => dismissNotification(n.id));
                      }}
                      className="px-3 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                    >
                      Dismiss Warnings
                    </button>
                    <button
                      onClick={() => notifications.forEach(n => dismissNotification(n.id))}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Dismiss All
                    </button>
                  </div>
                </div>
              )}
              
              {/* Notifications List - Limited Height with Scroll */}
              <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                {notifications
                  .sort((a, b) => {
                    // Sort by severity: error > warning > success > info
                    const severityOrder = { error: 0, warning: 1, success: 2, info: 3 };
                    return severityOrder[a.level] - severityOrder[b.level];
                  })
                  .map((notification) => {
                    const getNotificationStyling = (level) => {
                      switch (level) {
                        case 'success':
                          return {
                            bg: 'bg-green-50 dark:bg-green-900/20',
                            border: 'border-green-200 dark:border-green-800',
                            text: 'text-green-800 dark:text-green-200',
                            badge: 'bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-300'
                          };
                        case 'error':
                          return {
                            bg: 'bg-red-50 dark:bg-red-900/20',
                            border: 'border-red-200 dark:border-red-800',
                            text: 'text-red-800 dark:text-red-200',
                            badge: 'bg-red-100 dark:bg-red-800/30 text-red-700 dark:text-red-300'
                          };
                        case 'warning':
                          return {
                            bg: 'bg-yellow-50 dark:bg-yellow-900/20',
                            border: 'border-yellow-200 dark:border-yellow-800',
                            text: 'text-yellow-800 dark:text-yellow-200',
                            badge: 'bg-yellow-100 dark:bg-yellow-800/30 text-yellow-700 dark:text-yellow-300'
                          };
                        default:
                          return {
                            bg: 'bg-blue-50 dark:bg-blue-900/20',
                            border: 'border-blue-200 dark:border-blue-800',
                            text: 'text-blue-800 dark:text-blue-200',
                            badge: 'bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-300'
                          };
                      }
                    };
                    
                    const styling = getNotificationStyling(notification.level);
                    return (
                      <div
                        key={notification.id}
                        className={`rounded-lg border ${styling.bg} ${styling.border} p-3 transition-all hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className={`font-medium ${styling.text} truncate`}>
                                {notification.title}
                              </h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${styling.badge} flex-shrink-0`}>
                                {notification.level.toUpperCase()}
                </span>
                            </div>
                            <p className={`text-sm ${styling.text} opacity-80 break-words`}>
                              {notification.message}
                            </p>
                            <p className={`text-xs ${styling.text} opacity-60 mt-1`}>
                              {notification.timestamp.toLocaleTimeString()}
                            </p>
              </div>
              <button
                            onClick={() => dismissNotification(notification.id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2 flex-shrink-0"
              >
                            <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
                    );
                  })
                }
        </div>
              
              {/* Summary Stats */}
              {notifications.length > 5 && (
                <div className="flex justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {notifications.filter(n => n.level === 'error').length > 0 && (
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      {notifications.filter(n => n.level === 'error').length} Critical
                    </span>
                  )}
                  {notifications.filter(n => n.level === 'warning').length > 0 && (
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      {notifications.filter(n => n.level === 'warning').length} Warnings
                    </span>
                  )}
                  {notifications.filter(n => n.level === 'success').length > 0 && (
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      {notifications.filter(n => n.level === 'success').length} Success
                  </span>
                )}
              </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Desktop Floating Notification Panel (md and up) */}
      {!isMobile && notifications.length > 0 && (
        <div className="hidden md:block fixed right-4 bottom-20 z-40 w-96 max-h-[60vh] overflow-y-auto space-y-3">
          <div className="px-3 py-2 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => notifications.filter(n => n.level === 'error').forEach(n => dismissNotification(n.id))}
                className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded"
              >
                Clear Critical
              </button>
              <button
                onClick={() => notifications.forEach(n => dismissNotification(n.id))}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
              >
                Clear All
              </button>
            </div>
          </div>
          {notifications
            .sort((a, b) => {
              const order = { error: 0, warning: 1, success: 2, info: 3 };
              return order[a.level] - order[b.level];
            })
            .map((notification) => (
              <div key={notification.id} className="bg-white/90 dark:bg-gray-800/90 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{notification.title}</div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {notification.level.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 break-words">{notification.message}</div>
                    <div className="text-[10px] text-gray-400 mt-1">{notification.timestamp.toLocaleTimeString()}</div>
                  </div>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
      
      <main className="w-full flex flex-col items-center flex-1 py-6 px-2">

        {viewMode === 'maps' ? (
          <Maps />
        ) : viewMode === 'tasks' ? (
          <Tasks 
            suiClient={suiClient} 
            connectedWallet={connectedWallet}
            wallets={wallets}
            connectToWallet={connectToWallet}
            noWalletDetected={noWalletDetected}
            walletInstallHint={walletInstallHint}
            currentAccount={currentAccount}
            connectedAccounts={connectedAccounts}
          />
        ) : (
          <>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-4 max-w-6xl mx-auto">
                  {cards.slice(0, 5).map((card, idx) => (
                    <DataCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      unit={card.unit}
                      Icon={card.icon}
                      history={history[card.key]}
                      showGraph={viewMode === 'graphs'}
                      alertLevel={getAlertLevel(card.key, card.value)}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-4 max-w-6xl mx-auto mt-4">
                  {cards.slice(5).map((card, idx) => (
                    <DataCard
                      key={card.label}
                      label={card.label}
                      value={card.value}
                      unit={card.unit}
                      Icon={card.icon}
                      history={history[card.key]}
                      showGraph={viewMode === 'graphs'}
                      alertLevel={getAlertLevel(card.key, card.value)}
                    />
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      {/* Bottom nav for mobile */}
      <nav className="fixed bottom-0 left-0 w-full flex md:hidden justify-around items-center bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-700 z-50 h-16 pb-[env(safe-area-inset-bottom,0px)]">
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
        <button
          className={`flex flex-col items-center justify-center flex-1 py-2 ${viewMode === 'maps' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setViewMode('maps')}
        >
          <MapIcon className="h-6 w-6 mb-1" />
          <span className="text-xs">Maps</span>
        </button>
        <button
          className={`flex flex-col items-center justify-center flex-1 py-2 ${viewMode === 'tasks' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
          onClick={() => setViewMode('tasks')}
        >
          <ClipboardDocumentListIcon className="h-6 w-6 mb-1" />
          <span className="text-xs">Tasks</span>
        </button>
      </nav>
      
    </div>
  );
}

// Wallet Connection Component integrated into nav
function WalletConnection({ 
  connectedWallet, 
  isWalletConnected, 
  isWalletConnectedStatus, 
    wallets,
    isInitializing,
    walletLoadingStates,
  error: walletError,
    connectToWallet,
    disconnectFromWallet,
    connectionStatus
}) {

  const [showDropdown, setShowDropdown] = useState(false)
  const [forceRefresh, setForceRefresh] = useState(0)

  // Force refresh wallets
  const refreshWallets = () => {
    setForceRefresh(prev => prev + 1)
    console.log('🔄 Manually refreshing wallet detection...')
    
    // Force a page focus event to trigger wallet detection
    window.dispatchEvent(new Event('focus'))
    
    // Also try to trigger wallet detection by dispatching a custom event
    window.dispatchEvent(new CustomEvent('wallet-detection-refresh'))
    
    // Force a small delay and then check again
    setTimeout(() => {
      console.log('🔄 Delayed wallet detection check...')
      window.dispatchEvent(new Event('focus'))
    }, 1000)
  }

  // Monitor wallet detection and force refresh
  useEffect(() => {
    if (forceRefresh > 0) {
      console.log('🔄 Force refresh triggered, checking wallet detection...')
      // This will trigger the useSuiWallet hook to re-detect
      const timer = setTimeout(() => {
        console.log('🔄 Wallet detection refresh completed')
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [forceRefresh])

  // Handle copy address
  const handleCopyAddress = (address) => {
    navigator.clipboard.writeText(address)
    setShowDropdown(false)
  }

  // Handle explorer link
  const handleExplorer = (address) => {
    const explorerUrl = `https://testnet.suivision.xyz/account/${address}`
    window.open(explorerUrl, '_blank')
    setShowDropdown(false)
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      console.log('🔌 Disconnecting wallet from component:', {
        walletName: connectedWallet?.name,
        walletObject: connectedWallet,
        hasDisconnectFeature: connectedWallet?.features?.['standard:disconnect']
      })
      
      if (!connectedWallet) {
        console.error('❌ No wallet object to disconnect')
        setShowDropdown(false)
        return
      }
      
      await disconnectFromWallet(connectedWallet)
      setShowDropdown(false)
      console.log('✅ Wallet disconnected successfully')
      
      // Force re-detection of wallets after disconnection
      console.log('🔄 Triggering wallet re-detection...')
      setTimeout(() => {
        refreshWallets()
      }, 500)
      
    } catch (error) {
      console.error('❌ Error disconnecting wallet:', error)
      // Still close dropdown even if disconnect fails
      setShowDropdown(false)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm text-gray-600 dark:text-gray-400">
        <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
        <span className="hidden md:inline">Detecting...</span>
      </div>
    )
  }

  // If wallet is connected, show dropdown button
  if (isWalletConnectedStatus && connectedWallet) {
    const address = connectedWallet.accounts && connectedWallet.accounts[0] ? connectedWallet.accounts[0].address : ''
    const truncatedAddress = address ? `${address.slice(0, 4)}...${address.slice(-3)}` : ''
    
    return (
      <div className="relative">
        {/* Compact Dropdown Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs font-medium flex items-center gap-1"
        >
          <span>{truncatedAddress}</span>
          <svg 
            className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Compact Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-1">
              {/* Copy Address */}
              <button
                onClick={() => handleCopyAddress(address)}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
              
              {/* Explorer Link */}
              <button
                onClick={() => handleExplorer(address)}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Explorer
              </button>
              
              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
              
              {/* Disconnect */}
              <button
                onClick={handleDisconnect}
                disabled={walletLoadingStates[connectedWallet?.name]}
                className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {walletLoadingStates[connectedWallet?.name] ? '...' : 'Disconnect'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // If no wallet connected, show connect button
  if (wallets.length > 0) {
    return (
      <button
        onClick={() => connectToWallet(wallets[0])}
        disabled={walletLoadingStates[wallets[0].name]}
        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-xs font-medium"
      >
        {walletLoadingStates[wallets[0].name] ? '...' : 'Connect'}
      </button>
    )
  }

  // If no wallets detected
  return (
    <div className="flex items-center gap-2">
      <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
        <WalletIcon className="w-3 h-3 inline mr-1" />
        <span className="hidden md:inline">No Wallet</span>
      </div>
      <button
        onClick={refreshWallets}
        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
        title="Refresh wallet detection"
      >
        🔄
      </button>
    </div>
  )
}

function DataCard({ label, value, unit, Icon, history = [], showGraph, alertLevel }) {
  // Animate value change
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Get alert styling based on alert level
  const getAlertStyling = () => {
    switch (alertLevel) {
      case 'critical':
        return {
          border: 'border-red-500 dark:border-red-400',
          background: 'bg-red-50 dark:bg-red-900/20',
          icon: 'text-red-600 dark:text-red-400',
          value: 'text-red-700 dark:text-red-300',
          label: 'text-red-600 dark:text-red-400',
          alertIcon: <ExclamationCircleIcon className="h-4 w-4 text-red-600 dark:text-red-400" />,
          alertText: 'CRITICAL',
          alertBg: 'bg-red-100 dark:bg-red-800/30'
        };
      case 'warning':
        return {
          border: 'border-yellow-500 dark:border-yellow-400',
          background: 'bg-yellow-50 dark:bg-yellow-900/20',
          icon: 'text-yellow-600 dark:text-yellow-400',
          value: 'text-yellow-700 dark:text-yellow-300',
          label: 'text-yellow-600 dark:text-yellow-400',
          alertIcon: <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />,
          alertText: 'WARNING',
          alertBg: 'bg-yellow-100 dark:bg-yellow-800/30'
        };
      default:
        return {
          border: 'border-gray-200 dark:border-gray-700',
          background: 'bg-white dark:bg-gray-800',
          icon: 'text-gray-500 dark:text-gray-300',
          value: 'text-gray-900 dark:text-gray-100',
          label: 'text-gray-700 dark:text-gray-200',
          alertIcon: null,
          alertText: '',
          alertBg: ''
        };
    }
  };

  const alertStyling = getAlertStyling();

  // Chart.js data and options
  const chartData = {
    labels: history.map((_, i) => i + 1),
    datasets: [
      {
        data: history,
        fill: true,
        borderColor: alertLevel === 'critical' ? '#ef4444' : alertLevel === 'warning' ? '#eab308' : '#3b82f6',
        backgroundColor: alertLevel === 'critical' ? 'rgba(239, 68, 68, 0.1)' : alertLevel === 'warning' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(59, 130, 246, 0.1)',
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
    <div className={`w-full h-full rounded-xl border-2 ${alertStyling.border} ${alertStyling.background} p-4 flex flex-col items-center transition-all duration-300 relative`}>
      {/* Alert indicator */}
      {alertLevel && (
        <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full ${alertStyling.alertBg} text-xs font-medium ${alertLevel === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-400'}`}>
          {alertStyling.alertIcon}
          <span className="hidden sm:inline">{alertStyling.alertText}</span>
        </div>
      )}
      
      <Icon className={`h-8 w-8 mb-1 ${alertStyling.icon}`} />
      <div className={`text-base font-semibold ${alertStyling.label} mb-1`}>{label}</div>
      <div className={`text-2xl font-bold ${alertStyling.value} transition-all duration-300`}>
        {displayValue !== null && displayValue !== undefined ? displayValue : '--'} <span className="text-sm font-normal">{unit}</span>
      </div>
      
      {/* Alert message */}
      {alertLevel && (
        <div className={`mt-2 text-xs text-center px-2 py-1 rounded ${alertStyling.alertBg} ${alertLevel === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-400'}`}>
          {alertLevel === 'critical' ? '⚠️ Critical levels detected!' : '⚠️ Values outside normal range'}
        </div>
      )}
      
      {showGraph && (
        <div className="w-full h-16 mt-2">
          <Line data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}

export default App;
