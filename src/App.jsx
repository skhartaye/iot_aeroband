import { useState, useEffect, useRef } from 'react';
import { CloudIcon, SunIcon, ArrowTrendingUpIcon, SparklesIcon, FireIcon, MoonIcon, HomeIcon, ChartBarIcon, BeakerIcon, EyeIcon, MapIcon, WalletIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/solid';
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
  const [viewMode, setViewMode] = useState('home'); // 'home', 'graphs', 'maps', or 'tasks'
  const [lastUpdate, setLastUpdate] = useState(null);

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
        
        // Show success message to user
        alert(`🎉 Data tokenized successfully!\nToken ID: ${result.tokenId}\nValue: ${result.value} AQT`);
        
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
    { key: 'nh3', label: 'NH3', value: data.nh3, unit: 'ppm', icon: EyeIcon, color: 'from-indigo-200 to-indigo-100' },
    { key: 'no2', label: 'NO2', value: data.no2, unit: 'ppm', icon: SparklesIcon, color: 'from-pink-200 to-pink-100' },
    { key: 'pm2_5', label: 'PM2.5', value: data.pm2_5, unit: 'µg/m³', icon: SparklesIcon, color: 'from-amber-200 to-amber-100' },
    { key: 'pm10', label: 'PM10', value: data.pm10, unit: 'µg/m³', icon: SparklesIcon, color: 'from-orange-200 to-orange-100' },
  ];

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
