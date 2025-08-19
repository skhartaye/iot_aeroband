import React, { useState, useEffect } from 'react'

const UserDataManager = ({ user, onDataUpdate }) => {
  const [userPreferences, setUserPreferences] = useState({})
  const [savedStations, setSavedStations] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadUserData()
    }
  }, [user])

  const loadUserData = async () => {
    if (!user?.address) return
    
    setLoading(true)
    try {
      // Load from localStorage
      const savedData = localStorage.getItem(`user_${user.address}`)
      if (savedData) {
        const parsed = JSON.parse(savedData)
        setUserPreferences(parsed.preferences || {})
        setSavedStations(parsed.airQualityData || [])
        console.log('📱 Loaded user data for:', user.address.slice(0, 6) + '...')
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveUserData = async (data) => {
    if (!user?.address) return
    
    try {
      const currentData = JSON.parse(localStorage.getItem(`user_${user.address}`) || '{}')
      const updatedData = { ...currentData, ...data, lastSync: new Date().toISOString() }
      
      localStorage.setItem(`user_${user.address}`, JSON.stringify(updatedData))
      
      // Update local state
      if (data.preferences) setUserPreferences(data.preferences)
      if (data.airQualityData) setSavedStations(data.airQualityData)
      
      console.log('💾 User data saved successfully')
      
      // Notify parent component
      if (onDataUpdate) {
        onDataUpdate(updatedData)
      }
      
    } catch (error) {
      console.error('Error saving user data:', error)
    }
  }

  const saveLocation = async (location) => {
    if (!user?.address) return
    
    const updatedPreferences = {
      ...userPreferences,
      defaultLocation: location,
      lastUpdated: new Date().toISOString()
    }
    
    await saveUserData({ preferences: updatedPreferences })
  }

  const saveStation = async (station) => {
    if (!user?.address) return
    
    const updatedStations = [...savedStations]
    const existingIndex = updatedStations.findIndex(s => s.id === station.id)
    
    if (existingIndex >= 0) {
      updatedStations[existingIndex] = { ...station, lastUpdated: new Date().toISOString() }
    } else {
      updatedStations.push({ ...station, savedAt: new Date().toISOString() })
    }
    
    await saveUserData({ airQualityData: updatedStations })
  }

  const removeStation = async (stationId) => {
    if (!user?.address) return
    
    const updatedStations = savedStations.filter(s => s.id !== stationId)
    await saveUserData({ airQualityData: updatedStations })
  }

  const updatePreferences = async (newPreferences) => {
    if (!user?.address) return
    
    const updatedPreferences = {
      ...userPreferences,
      ...newPreferences,
      lastUpdated: new Date().toISOString()
    }
    
    await saveUserData({ preferences: updatedPreferences })
  }

  const exportUserData = () => {
    if (!user?.address) return
    
    try {
      const userData = {
        address: user.address,
        preferences: userPreferences,
        airQualityData: savedStations,
        exportDate: new Date().toISOString()
      }
      
      const dataStr = JSON.stringify(userData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      
      const link = document.createElement('a')
      link.href = URL.createObjectURL(dataBlob)
      link.download = `aeroband_user_data_${user.address.slice(0, 8)}.json`
      link.click()
      
      console.log('📤 User data exported')
    } catch (error) {
      console.error('Error exporting user data:', error)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
        👤 User Data Management
      </h3>
      
      {loading ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* User Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Address:</strong> {user.address.slice(0, 10)}...{user.address.slice(-8)}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Balance:</strong> {user.balance?.sui?.toFixed(4) || '0'} SUI
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Connected:</strong> {new Date(user.connectedAt).toLocaleDateString()}
            </p>
          </div>

          {/* Preferences */}
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">Preferences</h4>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={userPreferences.notifications || false}
                  onChange={(e) => updatePreferences({ notifications: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enable notifications</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={userPreferences.theme === 'dark'}
                  onChange={(e) => updatePreferences({ theme: e.target.checked ? 'dark' : 'light' })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Dark theme</span>
              </label>
            </div>
          </div>

          {/* Saved Stations */}
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">
              Saved Stations ({savedStations.length})
            </h4>
            {savedStations.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {savedStations.map((station) => (
                  <div key={station.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded p-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {station.name || 'Unknown Station'}
                    </span>
                    <button
                      onClick={() => removeStation(station.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No saved stations yet</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={exportUserData}
              className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
            >
              📤 Export Data
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserDataManager
