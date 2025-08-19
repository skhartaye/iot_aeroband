import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  WAQI_CONFIG, 
  AQI_LEVELS 
} from './config.js';




export default function Maps() {
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [heatmapData, setHeatmapData] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  


  // Get user's current location
  const getUserLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
                     try {
             // Get city and country names using reverse geocoding
             // Try OpenStreetMap Nominatim first (better street data)
             const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=en`);
             const geoData = await response.json();
            
                         const location = [latitude, longitude];
             
             // OpenStreetMap Nominatim data structure
             const address = geoData.address || {};
             
             // Build the full address string
             const addressParts = [];
             
             // Add street
             if (address.road || address.street || address.street_name) {
               addressParts.push(address.road || address.street || address.street_name);
             }
             
             // Add neighborhood/suburb
             if (address.suburb || address.neighbourhood) {
               addressParts.push(address.suburb || address.neighbourhood);
             }
             
             // Add city
             if (address.city || address.town || address.village) {
               addressParts.push(address.city || address.town || address.village);
             }
             
             // Add postal code
             if (address.postcode) {
               addressParts.push(address.postcode);
             }
             
             // Add state/province
             if (address.state || address.province || address.region) {
               addressParts.push(address.state || address.province || address.region);
             }
             
             // Add country
             if (address.country) {
               addressParts.push(address.country);
             }
             
             // Create the full address string
             location.fullAddress = addressParts.join(', ');
             
             // Keep individual fields for backward compatibility
             location.city = address.city || address.town || address.village || address.county || 'Unknown City';
             location.country = address.country_code?.toUpperCase() || 'Unknown';
             location.state = address.state || address.province || address.region || '';
             location.street = address.road || address.street || address.street_name || '';
             
             // Debug: log what we're getting
             console.log('🌍 OpenStreetMap Response:', geoData);
             console.log('📍 Address details:', address);
             console.log('📍 Full address:', location.fullAddress);
            
            setUserLocation(location);
            setLoading(false);
            // Fetch nearby AQI stations
            fetchNearbyStations(latitude, longitude);
          } catch (error) {
            console.error('Error getting location details:', error);
            // Fallback to just coordinates if reverse geocoding fails
            const location = [latitude, longitude];
            setUserLocation(location);
            setLoading(false);
            fetchNearbyStations(latitude, longitude);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Unable to get your location. Please enable location services.');
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
    }
  };

  // Generate heatmap data for a grid of locations
  const generateHeatmapData = async () => {
    try {
      setLoading(true);
      console.log('🔥 Generating heatmap data...');
      
      // Create a grid of locations around the current center
      const center = userLocation || [40.7128, -74.0060];
      const [centerLat, centerLng] = center;
      const gridSize = 5; // 5x5 grid
      const spacing = 0.5; // 0.5 degree spacing
      
      const heatmapPoints = [];
      
      for (let i = -gridSize; i <= gridSize; i++) {
        for (let j = -gridSize; j <= gridSize; j++) {
          const lat = centerLat + (i * spacing);
          const lng = centerLng + (j * spacing);
          
          try {
            const waqiUrl = `${WAQI_CONFIG.BASE_URL}${WAQI_CONFIG.ENDPOINTS.AIR_QUALITY}/geo:${lat};${lng}/?token=${WAQI_CONFIG.API_KEY}`;
            const response = await axios.get(waqiUrl);
            
            if (response.data && response.data.status === 'ok' && response.data.data) {
              const airData = response.data.data;
              const aqi = airData.aqi || 0;
              
              if (aqi > 0) {
                // Add point to heatmap with intensity based on AQI
                heatmapPoints.push({
                  lat: lat,
                  lng: lng,
                  value: aqi,
                  data: airData
                });
              }
            }
            
            // Add delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.warn(`Failed to fetch data for ${lat}, ${lng}:`, error.message);
          }
        }
      }
      
      setHeatmapData(heatmapPoints);
      console.log(`🔥 Generated ${heatmapPoints.length} heatmap points`);
      
    } catch (error) {
      console.error('Error generating heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Test WAQI Air Quality for multiple cities
  const testWAQI = async () => {
    try {
      setLoading(true);
      
      console.log('🧪 Testing WAQI Air Quality for multiple cities...');
      
      // Define major cities with their coordinates
      const cities = [
        { name: 'London', lat: 51.5074, lng: -0.1278, country: 'UK' },
        { name: 'New York', lat: 40.7128, lng: -74.0060, country: 'USA' },
        { name: 'Tokyo', lat: 35.6762, lng: 139.6503, country: 'Japan' },
        { name: 'Paris', lat: 48.8566, lng: 2.3522, country: 'France' },
        { name: 'Berlin', lat: 52.5200, lng: 13.4050, country: 'Germany' },
        { name: 'Madrid', lat: 40.4168, lng: -3.7038, country: 'Spain' },
        { name: 'Rome', lat: 41.9028, lng: 12.4964, country: 'Italy' },
        { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, country: 'Netherlands' }
      ];
      
      const allStations = [];
      
      // Test WAQI for each city
      for (const city of cities) {
        console.log(`\n🌍 Testing WAQI for ${city.name}...`);
        
        try {
          console.log('🔑 Using WAQI API');
          const waqiUrl = `${WAQI_CONFIG.BASE_URL}${WAQI_CONFIG.ENDPOINTS.AIR_QUALITY}/geo:${city.lat};${city.lng}/?token=${WAQI_CONFIG.API_KEY}`;
          console.log(`🌐 WAQI URL: ${waqiUrl}`);
          
          const response = await axios.get(waqiUrl);
          
          console.log(`📊 WAQI response for ${city.name}:`, response.data);
          
          if (response.data && response.data.status === 'ok' && response.data.data) {
            const airData = response.data.data;
            let aqi = airData.aqi || 0;
            
            if (aqi > 0) {
              const station = {
                id: `waqi-${city.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: `${city.name} Air Quality`,
                position: [airData.city?.geo?.[0] || city.lat, airData.city?.geo?.[1] || city.lng],
                data: {
                  aqi: Math.round(aqi),
                  pm2_5: airData.iaqi?.pm25?.v || 'N/A',
                  pm10: airData.iaqi?.pm10?.v || 'N/A',
                  temperature: airData.iaqi?.t?.v || 'N/A',
                  humidity: airData.iaqi?.h?.v || 'N/A',
                  pressure: airData.iaqi?.p?.v || 'N/A',
                  airQuality: getAirQualityLevel(aqi)
                },
                status: 'online',
                lastUpdate: airData.time?.s || 'Live',
                source: 'WAQI',
                city: city.name,
                country: city.country
              };
              
              allStations.push(station);
              console.log(`✅ WAQI: ${city.name} - AQI: ${aqi}`);
            } else {
              console.warn(`⚠️ WAQI returned no AQI data for ${city.name}`);
            }
          } else {
            console.warn(`⚠️ WAQI returned no data for ${city.name}`);
          }
        } catch (error) {
          console.warn(`⚠️ WAQI failed for ${city.name}:`, error.message);
          if (error.response) {
            console.warn(`📋 WAQI error response:`, error.response.data);
          }
        }
        
        // Add delay between cities to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      if (allStations.length > 0) {
        setNearbyStations(allStations);
        console.log('🎉 All WAQI stations:', allStations);
      } else {
        console.log('❌ No data could be fetched from WAQI');
      }
      
    } catch (error) {
      console.error('WAQI test error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Test WAQI for current location
  const testWAQICurrentLocation = async () => {
    try {
      setLoading(true);
      
      // Test with your current location or default to a major city
      const testLocation = userLocation || [40.7128, -74.0060]; // Default to New York
      const [lat, lng] = testLocation;
      
      console.log(`🧪 Testing WAQI for current location...`);
      console.log('🔑 Using WAQI API');
      
      // Use coordinates with WAQI geo endpoint
      const url = `${WAQI_CONFIG.BASE_URL}${WAQI_CONFIG.ENDPOINTS.AIR_QUALITY}/geo:${lat};${lng}/?token=${WAQI_CONFIG.API_KEY}`;
      console.log(`🌐 WAQI test URL: ${url}`);
      
      const response = await axios.get(url);
      
      console.log(`📊 WAQI test response:`, response.data);
      
      if (response.data && response.data.status === 'ok' && response.data.data) {
        const airData = response.data.data;
        let aqi = airData.aqi || 0;
        
        if (aqi > 0) {
          console.log(`✅ WAQI test successful - AQI: ${aqi}`);
          
          const station = {
            id: 'waqi-test',
            name: 'WAQI Test Station',
            position: [airData.city?.geo?.[0] || lat, airData.city?.geo?.[1] || lng],
            data: {
              aqi: Math.round(aqi),
              pm2_5: airData.iaqi?.pm25?.v || 'N/A',
              pm10: airData.iaqi?.pm10?.v || 'N/A',
              temperature: airData.iaqi?.t?.v || 'N/A',
              humidity: airData.iaqi?.h?.v || 'N/A',
              pressure: airData.iaqi?.p?.v || 'N/A',
              airQuality: getAirQualityLevel(aqi)
            },
            status: 'online',
            lastUpdate: airData.time?.s || 'Live',
            source: 'WAQI'
          };
          
          setNearbyStations([station]);
          console.log('WAQI station:', station);
        } else {
          console.warn(`⚠️ WAQI returned no AQI data`);
        }
      } else {
        console.warn(`⚠️ WAQI returned no data`);
      }
    } catch (error) {
      console.error('WAQI error:', error);
      if (error.response) {
        console.warn(`📋 WAQI error response:`, error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch nearby AQI stations from WAQI
  const fetchNearbyStations = async (lat, lng) => {
    try {
      setLoading(true);
      console.log('Fetching WAQI data for coordinates:', lat, lng);
      
      // Use coordinates with WAQI geo endpoint
      const waqiUrl = `${WAQI_CONFIG.BASE_URL}${WAQI_CONFIG.ENDPOINTS.AIR_QUALITY}/geo:${lat};${lng}/?token=${WAQI_CONFIG.API_KEY}`;
      console.log('WAQI URL:', waqiUrl);
      
      const response = await axios.get(waqiUrl);
      
      console.log('WAQI response:', response.data);

      if (response.data && response.data.status === 'ok' && response.data.data) {
        console.log('Full WAQI response:', response.data);
        
        const airData = response.data.data;
        let aqi = airData.aqi || 0;
        
        console.log('WAQI AQI:', aqi);
        
        if (aqi > 0) {
          const station = {
            id: 'waqi-station',
            name: 'Local Air Quality Station',
            position: [airData.city?.geo?.[0] || lat, airData.city?.geo?.[1] || lng],
            data: {
              aqi: Math.round(aqi),
              pm2_5: airData.iaqi?.pm25?.v || 'N/A',
              pm10: airData.iaqi?.pm10?.v || 'N/A',
              temperature: airData.iaqi?.t?.v || 'N/A',
              humidity: airData.iaqi?.h?.v || 'N/A',
              pressure: airData.iaqi?.p?.v || 'N/A',
              airQuality: getAirQualityLevel(aqi)
            },
            status: 'online',
            lastUpdate: airData.time?.s || 'Live',
            source: 'WAQI'
          };

          console.log('Created station object:', station);
          setNearbyStations([station]);
        } else {
          console.error('WAQI returned no AQI data');
        }
      } else {
        console.error('WAQI returned no data');
      }
    } catch (error) {
      console.error('Error fetching WAQI data:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get air quality level based on AQI value
  const getAirQualityLevel = (aqi) => {
    if (aqi <= AQI_LEVELS.GOOD.max) return AQI_LEVELS.GOOD.label;
    if (aqi <= AQI_LEVELS.MODERATE.max) return AQI_LEVELS.MODERATE.label;
    if (aqi <= AQI_LEVELS.UNHEALTHY_SENSITIVE.max) return AQI_LEVELS.UNHEALTHY_SENSITIVE.label;
    if (aqi <= AQI_LEVELS.UNHEALTHY.max) return AQI_LEVELS.UNHEALTHY.label;
    if (aqi <= AQI_LEVELS.VERY_UNHEALTHY.max) return AQI_LEVELS.VERY_UNHEALTHY.label;
    return AQI_LEVELS.HAZARDOUS.label;
  };

  // Get air quality color based on level
  const getAirQualityColor = (level) => {
    switch (level) {
      case AQI_LEVELS.GOOD.label: return AQI_LEVELS.GOOD.color;
      case AQI_LEVELS.MODERATE.label: return AQI_LEVELS.MODERATE.color;
      case AQI_LEVELS.UNHEALTHY_SENSITIVE.label: return AQI_LEVELS.UNHEALTHY_SENSITIVE.color;
      case AQI_LEVELS.UNHEALTHY.label: return AQI_LEVELS.UNHEALTHY.color;
      case AQI_LEVELS.VERY_UNHEALTHY.label: return AQI_LEVELS.VERY_UNHEALTHY.color;
      case AQI_LEVELS.HAZARDOUS.label: return AQI_LEVELS.HAZARDOUS.color;
      default: return '#cccccc';
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };



  // Get user location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
             <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
         <div className="flex justify-between items-start">
           <div>
             <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Air Quality Dashboard</h1>
             <p className="text-gray-600 dark:text-gray-400">Monitor air quality data across different locations</p>
           </div>
           
           
         </div>
        {error && (
          <div className="mt-3 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            <strong>Error:</strong> {error}
            <br />
            <small>Check the browser console for more details</small>
          </div>
        )}
      </div>

             {/* Main Content */}
       <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
         <div className="max-w-7xl mx-auto">
           {/* User Location Card */}
           {userLocation && (
             <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
               <h2 className="text-xl font-semibold text-blue-800 dark:text-blue-200 mb-4">📍 Your Location</h2>
               <div className="space-y-3">
                                   <div className="text-center space-y-2">
                    <div>
                      <span className="text-lg font-medium text-blue-800 dark:text-blue-200">
                        📍 {userLocation.fullAddress || 'Address not available'}
                      </span>
                    </div>
                  </div>
                 <div className="grid grid-cols-2 gap-4 text-sm">
                   <div>
                     <span className="text-blue-600 dark:text-blue-300 font-medium">Latitude:</span>
                     <span className="ml-2 text-blue-800 dark:text-blue-200">{userLocation[0].toFixed(4)}</span>
                   </div>
                   <div>
                     <span className="text-blue-600 dark:text-blue-300 font-medium">Longitude:</span>
                     <span className="ml-2 text-blue-800 dark:text-blue-200">{userLocation[1].toFixed(4)}</span>
                   </div>
                 </div>
               </div>
             </div>
           )}

          {/* Heatmap Data Grid */}
          {heatmapData.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">🔥 Grid Data ({heatmapData.length} points)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {heatmapData.map((point, index) => (
                  <div
                    key={`heatmap-${index}`}
                    className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-800 dark:text-gray-100">Point {index + 1}</h3>
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: getAirQualityColor(getAirQualityLevel(point.value)) }}
                      ></div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">AQI:</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{point.value}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">PM2.5:</span>
                        <span className="text-gray-800 dark:text-gray-100">{point.data.iaqi?.pm25?.v || 'N/A'} µg/m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">PM10:</span>
                        <span className="text-gray-800 dark:text-gray-100">{point.data.iaqi?.pm10?.v || 'N/A'} µg/m³</span>
                      </div>
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          getAirQualityLevel(point.value) === 'Good' ? 'bg-green-100 text-green-800' :
                          getAirQualityLevel(point.value) === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                          getAirQualityLevel(point.value) === 'Unhealthy for Sensitive Groups' ? 'bg-orange-100 text-orange-800' :
                          getAirQualityLevel(point.value) === 'Unhealthy' ? 'bg-red-100 text-red-800' :
                          getAirQualityLevel(point.value) === 'Very Unhealthy' ? 'bg-purple-100 text-purple-800' :
                          'bg-red-900 text-red-100'
                        }`}>
                          {getAirQualityLevel(point.value)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Air Quality Stations */}
          {nearbyStations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">🌬️ Air Quality Stations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nearbyStations.map((station) => (
                  <div
                    key={station.id}
                    className={`p-6 bg-white dark:bg-gray-800 rounded-lg border-2 transition-colors cursor-pointer ${
                      selectedLocation?.id === station.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    onClick={() => handleLocationSelect(station)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{station.name}</h3>
                      <div 
                        className="w-6 h-6 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: getAirQualityColor(station.data.airQuality) }}
                      ></div>
                    </div>
                    
                    {station.city && station.country && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        📍 {station.city}, {station.country}
                      </p>
                    )}
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">AQI:</span>
                        <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">{station.data.aqi}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">PM2.5:</span>
                          <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">{station.data.pm2_5} µg/m³</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">PM10:</span>
                          <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">{station.data.pm10} µg/m³</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Temperature:</span>
                          <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">{station.data.temperature}°C</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Humidity:</span>
                          <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">{station.data.humidity}%</span>
                        </div>
                      </div>
                      
                      <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          station.data.airQuality === 'Good' ? 'bg-green-100 text-green-800' :
                          station.data.airQuality === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                          station.data.airQuality === 'Unhealthy for Sensitive Groups' ? 'bg-orange-100 text-orange-800' :
                          station.data.airQuality === 'Unhealthy' ? 'bg-red-100 text-red-800' :
                          station.data.airQuality === 'Very Unhealthy' ? 'bg-purple-100 text-purple-800' :
                          'bg-red-900 text-red-100'
                        }`}>
                          {station.data.airQuality}
                        </span>
                      </div>
                      
                                             <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                         {station.source} • {station.lastUpdate}
                       </div>
                       
                       
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
         </div>
       </div>
     </div>
   );
 }
