import React from 'react'
import { ConnectButton } from '@mysten/dapp-kit'
import { useSuiWallet } from '../hooks/useSuiWallet.js'

const SuiWalletConnect = ({ onUserConnected }) => {
  const {
    userData,
    loading,
    error,
    network,
    isSigning,
    isConnected,
    signTestTransaction,
    setError
  } = useSuiWallet()

  // Notify parent component when user connects/disconnects
  React.useEffect(() => {
    if (onUserConnected) {
      onUserConnected(userData)
    }
  }, [userData, onUserConnected])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Connecting wallet...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
          ⚠️ {error}
        </div>
        <button
          onClick={() => setError(null)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
    )
  }

  if (isConnected && userData) {
    return (
      <div className="flex items-center gap-4">
        {/* Network Display */}
        <div className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
          <span className="text-gray-600 dark:text-gray-400">{network}</span>
        </div>

        {/* User Info */}
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {userData.address.slice(0, 6)}...{userData.address.slice(-4)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {userData.balance.sui.toFixed(4)} SUI
          </p>
        </div>
        
        {/* Test Transaction Button */}
        <button
          onClick={signTestTransaction}
          disabled={isSigning}
          className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-xs"
        >
          {isSigning ? '⏳' : '🧪'} Test
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <ConnectButton className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2" />
    </div>
  )
}

export default SuiWalletConnect
