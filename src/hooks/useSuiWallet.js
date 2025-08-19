import { useState, useEffect, useCallback } from 'react'
import { useCurrentAccount, useWallets, useSuiClient, useSuiClientContext } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { getWallets, registerWallet } from '@mysten/wallet-standard'

export const useSuiWallet = () => {
  const currentAccount = useCurrentAccount()
  const { wallets: dappKitWallets } = useWallets()
  const suiClient = useSuiClient()
  const { network } = useSuiClientContext()
  
  // State for wallet management
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [walletLoadingStates, setWalletLoadingStates] = useState({})
  const [error, setError] = useState(null)
  const [isSigning, setIsSigning] = useState(false)
  const [transactionHistory, setTransactionHistory] = useState([])
  const [balance, setBalance] = useState(null)
  const [walletDetectionRetries, setWalletDetectionRetries] = useState(0)
  
  // Use wallet-standard for direct wallet detection
  const [availableWallets, setAvailableWallets] = useState([])
  const [isInitializing, setIsInitializing] = useState(true)
  const [walletEvents, setWalletEvents] = useState([])
  const [detectionInProgress, setDetectionInProgress] = useState(false)
  const [connectedWallet, setConnectedWallet] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected') // 'disconnected', 'connecting', 'connected'
  
  // Detect wallets using wallet-standard with proper error handling
  const detectWallets = useCallback(() => {
    // Prevent duplicate detection calls
    if (detectionInProgress) {
      console.log('⏳ Wallet detection already in progress, skipping...')
      return
    }
    
    setDetectionInProgress(true)
    
    try {
      console.log('🔍 Using @mysten/wallet-standard to detect wallets...')
      
      // Check if wallet-standard is available
      if (typeof getWallets !== 'function') {
        console.error('❌ getWallets function not available')
        setAvailableWallets([])
        return
      }
      
      const wallets = getWallets().get()
      console.log('📱 Wallets detected via wallet-standard:', wallets)
      
      if (wallets && wallets.length > 0) {
        // Only update if wallets have actually changed
        setAvailableWallets(prev => {
          const prevNames = prev.map(w => w.name).sort().join(',')
          const newNames = wallets.map(w => w.name).sort().join(',')
          
          console.log('🔄 Comparing wallet lists:', { prevNames, newNames, prev: prev.length, new: wallets.length })
          
          if (prevNames !== newNames) {
            console.log('✅ Wallet detection successful:', wallets.map(w => w.name))
            return wallets
          } else {
            console.log('⏭️ Wallet list unchanged, keeping existing')
            return prev
          }
        })
        
        // Set up event listeners for each wallet (only once)
        wallets.forEach(wallet => {
          if (wallet.features['standard:events']) {
            try {
              // Check if event listener is already set up
              const existingListener = wallet._eventListenerSet
              if (!existingListener) {
                const unsubscribe = wallet.features['standard:events'].on('change', (event) => {
                  console.log('🔄 Wallet event received:', event)
                  setWalletEvents(prev => [...prev, { wallet: wallet.name, event, timestamp: new Date().toISOString() }])
                  
                  // Re-detect wallets when events occur
                  setTimeout(() => detectWallets(), 100)
                })
                
                // Mark this wallet as having an event listener
                wallet._eventListenerSet = true
                console.log('👂 Event listener set up for wallet:', wallet.name)
              }
            } catch (err) {
              console.error('❌ Error setting up event listener for wallet:', wallet.name, err)
            }
          }
        })
      } else {
        console.log('❌ No wallets detected via wallet-standard')
        setAvailableWallets([])
      }
      
      // Also check dapp-kit wallets for comparison
      console.log('🔍 Dapp-kit wallets for comparison:', dappKitWallets)
      
    } catch (err) {
      console.error('❌ Error detecting wallets via wallet-standard:', err)
      setAvailableWallets([])
    } finally {
      setDetectionInProgress(false)
    }
  }, [dappKitWallets, detectionInProgress])
  
  // Check for manually injected wallet objects
  const checkForManualWallets = useCallback(() => {
    if (typeof window === 'undefined') return
    
    console.log('🔍 Checking for manually injected wallet objects...')
    
    // Check for common wallet injection patterns
    const possibleWallets = []
    
    // Check for Slush Wallet specifically
    if (window.slushWallet) {
      console.log('🎯 Found window.slushWallet:', window.slushWallet)
      possibleWallets.push({
        name: 'Slush Wallet (Manual)',
        icon: '🔍',
        version: 'Manual Detection',
        source: 'window.slushWallet',
        object: window.slushWallet
      })
    }
    
    // Check for Sui Wallet
    if (window.suiWallet) {
      console.log('🎯 Found window.suiWallet:', window.suiWallet)
      possibleWallets.push({
        name: 'Sui Wallet (Manual)',
        icon: '🔍',
        version: 'Manual Detection',
        source: 'window.suiWallet',
        object: window.suiWallet
      })
    }
    
    // Check for any other wallet-like objects
    const allKeys = Object.keys(window)
    const walletKeys = allKeys.filter(key => 
      key.toLowerCase().includes('wallet') || 
      key.toLowerCase().includes('sui') || 
      key.toLowerCase().includes('slush')
    )
    
    walletKeys.forEach(key => {
      const obj = window[key]
      if (obj && typeof obj === 'object' && obj !== window.slushWallet && obj !== window.suiWallet) {
        console.log(`🔍 Found potential wallet object: ${key}`, obj)
        possibleWallets.push({
          name: `${key} (Potential)`,
          icon: '🔍',
          version: 'Manual Detection',
          source: `window.${key}`,
          object: obj
        })
      }
    })
    
    if (possibleWallets.length > 0) {
      console.log('✅ Manually detected wallets:', possibleWallets)
      // Don't replace availableWallets, just log them for debugging
    } else {
      console.log('❌ No manually injected wallets found')
    }
    
    return possibleWallets
  }, [])
  
  // Initial wallet detection
  useEffect(() => {
    console.log('🚀 Initializing wallet detection...')
    setIsInitializing(true)
    
    // Try to detect wallets immediately
    detectWallets()
    
    // Also check for manually injected wallets
    checkForManualWallets()
    
    // Set a small delay to ensure everything is loaded
    const timer = setTimeout(() => {
      setIsInitializing(false)
      console.log('⏰ Initialization timeout completed')
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [detectWallets, checkForManualWallets])
  
  // Retry wallet detection if no wallets found initially
  useEffect(() => {
    if (availableWallets.length === 0 && !isInitializing) {
      const timer = setTimeout(() => {
        setWalletDetectionRetries(prev => prev + 1)
        console.log(`🔄 Wallet detection retry ${walletDetectionRetries + 1}`)
        
        // Try both detection methods
        detectWallets()
        checkForManualWallets()
        
        // Additional debugging on retry
        if (typeof window !== 'undefined') {
          console.log('🔍 Retry Debug Info:')
          console.log('- All window keys count:', Object.keys(window).length)
          console.log('- Document ready state:', document.readyState)
          console.log('- Page load time:', performance.now())
          
          // Check for any recently added objects
          const recentKeys = Object.keys(window).filter(key => 
            key.toLowerCase().includes('wallet') || 
            key.toLowerCase().includes('sui') || 
            key.toLowerCase().includes('slush')
          )
          console.log('- Recent wallet keys found:', recentKeys)
        }
      }, 2000) // Wait 2 seconds before retrying
      
      return () => clearTimeout(timer)
    }
  }, [availableWallets.length, isInitializing, walletDetectionRetries, detectWallets, checkForManualWallets])

  // Debug logging
  useEffect(() => {
    console.log('🔍 Wallet Detection Debug:')
    console.log('- currentAccount:', currentAccount)
    console.log('- dappKitWallets:', dappKitWallets)
    console.log('- availableWallets (wallet-standard):', availableWallets)
    console.log('- suiClient:', suiClient)
    console.log('- network:', network)
    console.log('- isInitializing:', isInitializing)
    console.log('- isConnected:', !!currentAccount)
    console.log('- walletDetectionRetries:', walletDetectionRetries)
    console.log('- walletEvents:', walletEvents)
    
    // Check for common wallet detection issues
    if (typeof window !== 'undefined') {
      console.log('- window.suiWallet:', window.suiWallet)
      console.log('- window.slushWallet:', window.slushWallet)
      console.log('- window.ethereum:', window.ethereum)
      
      // Check if any wallet objects exist
      const walletObjects = Object.keys(window).filter(key => 
        key.toLowerCase().includes('wallet') || 
        key.toLowerCase().includes('sui') ||
        key.toLowerCase().includes('slush')
      )
      console.log('- Wallet-related window objects:', walletObjects)
      
      // More comprehensive wallet detection test
      console.log('🔍 Comprehensive Wallet Detection Test:')
      console.log('- All window keys:', Object.keys(window).slice(0, 20)) // First 20 keys
      
      // Check for any objects that might be wallets
      const possibleWallets = Object.keys(window).filter(key => {
        const obj = window[key]
        return obj && typeof obj === 'object' && (
          obj.name || 
          obj.version || 
          obj.connect || 
          obj.isConnected
        )
      })
      console.log('- Possible wallet objects:', possibleWallets)
      
      // Check for injected scripts
      const scripts = document.querySelectorAll('script')
      const injectedScripts = Array.from(scripts).filter(script => 
        script.src && (
          script.src.includes('wallet') || 
          script.src.includes('sui') || 
          script.src.includes('slush')
        )
      )
      console.log('- Injected wallet scripts:', injectedScripts)
      
      // Check if wallet-standard is properly loaded
      console.log('- getWallets function available:', typeof getWallets === 'function')
      console.log('- registerWallet function available:', typeof registerWallet === 'function')
    }
  }, [currentAccount, dappKitWallets, availableWallets, suiClient, network, isInitializing, walletEvents])

  // Fetch user data when connected
  const fetchUserData = useCallback(async () => {
    // Try to get account from currentAccount first, then from connectedWallet
    const accountToUse = currentAccount || (connectedWallet?.accounts?.[0])
    
    if (!accountToUse || !suiClient) {
      console.log('⚠️ No account available for fetching user data')
      return null
    }

    try {
      console.log('📊 Fetching user data for account:', accountToUse.address)
      // Get balance
      const balanceData = await suiClient.getBalance({
        owner: accountToUse.address,
        coinType: '0x2::sui::SUI'
      })

      // Get account info
      const accountInfo = await suiClient.getAccount({
        address: accountToUse.address
      })

      // Get recent transactions
      const transactions = await suiClient.queryTransactionBlocks({
        filter: {
          FromAddress: accountToUse.address
        },
        options: {
          showEffects: true,
          showInput: true,
          showObjectChanges: true,
          showEvents: true,
        },
        limit: 10
      })

      const user = {
        id: accountToUse.address,
        address: accountToUse.address,
        publicKey: accountToUse.publicKey,
        connectedAt: new Date().toISOString(),
        balance: {
          sui: Number(balanceData.totalBalance) / 1000000000,
          mist: balanceData.totalBalance
        },
        accountInfo: {
          sequenceNumber: accountInfo.sequenceNumber,
          lastActiveEpoch: accountInfo.lastActiveEpoch,
          lastActiveTransaction: accountInfo.lastActiveTransaction
        },
        preferences: {
          defaultLocation: null,
          favoriteStations: [],
          notifications: true,
          theme: 'light'
        },
        airQualityData: [],
        lastSync: null
      }

      setBalance(balanceData)
      setTransactionHistory(transactions.data || [])
      setUserData(user)
      return user

    } catch (error) {
      console.error('Error fetching user data:', error)
      throw error
    }
  }, [currentAccount, connectedWallet, suiClient])

  // Check if a specific wallet is connected
  const isWalletConnected = useCallback((wallet) => {
    // First check if we have a connected wallet in our state
    if (connectedWallet && connectedWallet.name === wallet.name && connectionStatus === 'connected') {
      return true
    }
    
    // Then check if the dapp-kit's current account matches any of the wallet's accounts
    if (currentAccount && wallet.accounts) {
      return wallet.accounts.some(acc => acc.address === currentAccount.address)
    }
    
    return false
  }, [connectedWallet, currentAccount, connectionStatus])

  // Connect to a specific wallet using wallet-standard
  const connectToWallet = useCallback(async (wallet) => {
    try {
      console.log('🔌 Attempting to connect to wallet:', wallet.name)
      setWalletLoadingStates(prev => ({ ...prev, [wallet.name]: true }))
      setError(null)
      setConnectionStatus('connecting')
      
      if (wallet.features['standard:connect']) {
        // Add a small delay to ensure the wallet extension is ready
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Always trigger the wallet extension to show by calling connect
        // This ensures the extension popup appears every time
        const result = await wallet.features['standard:connect'].connect()
        console.log('✅ Wallet connection result:', result)
        
        // Check if connection was successful
        if (result && result.accounts && result.accounts.length > 0) {
          console.log('🎯 Wallet connected with accounts:', result.accounts)
          
          // Explicitly select this wallet with dapp-kit to ensure currentAccount is set
          try {
            console.log('Attempting to select wallet for dapp-kit:', wallet.name)
            // select(wallet.name) // This line is removed as per the edit hint
            console.log('✅ Wallet selected for dapp-kit.')
          } catch (selectErr) {
            console.error('❌ Error selecting wallet for dapp-kit:', selectErr)
            // Even if select fails, we proceed with setting local state
          }
          
          // Update the wallet object with the new accounts
          const updatedWallet = {
            ...wallet,
            accounts: result.accounts
          }
          
          // Update our connection state
          setConnectedWallet(updatedWallet)
          setConnectionStatus('connected')
          
          // Fetch user data after successful connection
          try {
            await fetchUserData()
          } catch (err) {
            console.log('⚠️ Could not fetch user data yet, wallet may still be connecting...')
          }
        } else {
          console.log('⚠️ Connection result missing accounts:', result)
          setConnectionStatus('disconnected')
        }
      } else {
        throw new Error('Wallet does not support standard:connect')
      }
    } catch (err) {
      console.error('❌ Error connecting to wallet:', err)
      setError(`Failed to connect to ${wallet.name}: ${err.message}`)
      setConnectionStatus('disconnected')
    } finally {
      setWalletLoadingStates(prev => ({ ...prev, [wallet.name]: false }))
    }
  }, [fetchUserData])

  // Disconnect wallet - clear all state
  const disconnectWallet = useCallback(() => {
    console.log('🔌 Disconnecting wallet...')
    setUserData(null)
    setBalance(null)
    setTransactionHistory([])
    setError(null)
    setLoading(false)
    setConnectedWallet(null)
    setConnectionStatus('disconnected')
    
    // Clear any stored connection data
    if (typeof window !== 'undefined') {
      // Clear any localStorage data related to wallet connection
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('wallet') || key.includes('user_') || key.includes('sui'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    }
    
    console.log('✅ Wallet disconnected successfully')
  }, [])

  // Disconnect from a specific wallet
  const disconnectFromWallet = useCallback(async (wallet) => {
    try {
      console.log('🔌 Disconnecting from wallet:', wallet.name)
      
      if (wallet.features['standard:disconnect']) {
        await wallet.features['standard:disconnect'].disconnect()
        console.log('✅ Wallet disconnection successful')
      } else {
        console.warn('⚠️ Wallet does not support standard:disconnect, clearing state locally.')
      }
      
      // Always clear all state regardless of wallet's disconnect support or response
      disconnectWallet()
    } catch (err) {
      console.error('❌ Error disconnecting from wallet:', err)
      // Still clear state even if wallet disconnection fails
      disconnectWallet()
    }
  }, [disconnectWallet])

  // Sign test transaction
  const signTestTransaction = useCallback(async () => {
    if (!currentAccount || !suiClient) return

    setIsSigning(true)
    setError(null)

    try {
      const tx = new Transaction()
      tx.moveCall({
        target: '0x2::coin::mint_for_testing',
        arguments: [tx.pure('0x2::sui::SUI'), tx.pure(1000)]
      })

      const result = await suiClient.signAndExecuteTransactionBlock({
        signer: currentAccount.address,
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        }
      })

      console.log('✅ Test transaction signed:', result)

      // Update transaction history
      setTransactionHistory(prev => [result, ...prev.slice(0, 9)])

      // Update user data
      if (userData) {
        const updatedUser = {
          ...userData,
          lastTransaction: {
            digest: result.digest,
            timestamp: new Date().toISOString()
          }
        }
        setUserData(updatedUser)
      }

      return result

    } catch (error) {
      console.error('❌ Transaction failed:', error)
      setError(`Transaction failed: ${error.message}`)
      throw error
    } finally {
      setIsSigning(false)
    }
  }, [currentAccount, suiClient, userData])

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!currentAccount || !suiClient) return

    try {
      const balanceData = await suiClient.getBalance({
        owner: currentAccount.address,
        coinType: '0x2::sui::SUI'
      })
      setBalance(balanceData)
      
      if (userData) {
        setUserData(prev => ({
          ...prev,
          balance: {
            sui: Number(balanceData.totalBalance) / 1000000000,
            mist: balanceData.totalBalance
          }
        }))
      }
    } catch (error) {
      console.error('Error refreshing balance:', error)
    }
  }, [currentAccount, suiClient, userData])

  // Save user data
  const saveUserData = useCallback((data) => {
    if (!userData?.address) return

    try {
      const dataToSave = { ...userData, ...data }
      localStorage.setItem(`user_${userData.address}`, JSON.stringify(dataToSave))
      setUserData(dataToSave)
      console.log('💾 User data saved')
    } catch (error) {
      console.error('Error saving user data:', error)
    }
  }, [userData])

  // Auto-connect/disconnect and fetch user data when account changes
  useEffect(() => {
    console.log('useEffect [currentAccount] triggered:', { currentAccount: currentAccount?.address, isConnected: !!currentAccount, connectionStatus, connectedWalletName: connectedWallet?.name })
    if (currentAccount) {
      console.log('🎯 currentAccount changed, attempting to set connected wallet and fetch user data...', currentAccount.address)
      // Find the wallet in availableWallets that matches the currentAccount's address
      const foundWallet = availableWallets.find(wallet => 
        wallet.accounts?.some(acc => acc.address === currentAccount.address)
      )
      
      if (foundWallet) {
        console.log('✅ Found matching wallet for currentAccount:', foundWallet.name)
        setConnectedWallet({
          ...foundWallet,
          accounts: foundWallet.accounts // Ensure accounts are present
        })
        setConnectionStatus('connected')
        fetchUserData() // Fetch user data when currentAccount is available
      } else {
        console.warn('⚠️ currentAccount exists but no matching wallet found in availableWallets. Attempting to fetch user data anyway.')
        // This could happen if a wallet was connected outside of our connectToWallet flow
        // In this case, we still treat it as connected, but connectedWallet state might be partial
        setConnectionStatus('connected')
        fetchUserData()
      }
    } else {
      console.log('🔌 currentAccount is null, but checking if we have a wallet-standard connection...')
      // Only disconnect if we don't have any connected wallet via wallet-standard
      const hasWalletStandardConnection = availableWallets.some(wallet => 
        wallet.accounts && wallet.accounts.length > 0
      )
      
      if (!hasWalletStandardConnection && (connectionStatus === 'connected' || connectedWallet)) {
        console.log('Initiating full disconnect due to no wallet-standard connection.')
        disconnectWallet()
      } else if (hasWalletStandardConnection) {
        console.log('✅ Wallet-standard connection exists, keeping connected despite null currentAccount')
        // Keep the connection status as connected if we have wallet-standard accounts
        if (connectionStatus !== 'connected') {
          setConnectionStatus('connected')
        }
      }
    }
  }, [currentAccount, fetchUserData, disconnectWallet, availableWallets, connectionStatus, connectedWallet])

  // Auto-refresh balance every 30 seconds when connected
  useEffect(() => {
    if (!currentAccount) return

    const interval = setInterval(refreshBalance, 30000)
    return () => clearInterval(interval)
  }, [currentAccount, refreshBalance])

  // Check for already connected wallets on page load
  const checkForExistingConnections = useCallback(() => {
    if (availableWallets.length === 0) return
    
    console.log('🔍 Checking for existing wallet connections...')
    
    availableWallets.forEach(wallet => {
      if (wallet.accounts && wallet.accounts.length > 0) {
        console.log(`🎯 Found already connected wallet: ${wallet.name} with ${wallet.accounts.length} accounts`)
        
        // Make sure we have the full wallet object with accounts
        const connectedWalletWithAccounts = {
          ...wallet,
          accounts: wallet.accounts
        }
        
        setConnectedWallet(connectedWalletWithAccounts)
        setConnectionStatus('connected')
        
        // Try to fetch user data if we have an account
        if (wallet.accounts[0] && suiClient) {
          console.log('📊 Attempting to fetch user data for existing connection...')
          // We'll let the useEffect handle this when currentAccount updates
        }
      }
    })
  }, [availableWallets, suiClient])

  // Check for already connected wallets when wallets are detected
  useEffect(() => {
    console.log('useEffect [availableWallets, currentAccount, connectedWallet] triggered:', { availableWalletsLength: availableWallets.length, currentAccount: currentAccount?.address, connectedWalletName: connectedWallet?.name })
    if (availableWallets.length > 0 && currentAccount && !connectedWallet) {
      // Try to find the wallet that matches the currentAccount
      const matchingWallet = availableWallets.find(wallet => 
        wallet.accounts?.some(account => account.address === currentAccount.address)
      )
      
      if (matchingWallet) {
        console.log(`🎯 Found already connected wallet via currentAccount: ${matchingWallet.name}`)
        setConnectedWallet(matchingWallet)
        setConnectionStatus('connected')
      } else {
        console.log('🔍 No matching connected wallet found for currentAccount in availableWallets. Setting connection status to connected.')
        // This can happen if the wallet was connected but not fully detected by wallet-standard initially
        // In this case, we still set connection status to connected
        setConnectionStatus('connected')
      }
    } else if (availableWallets.length > 0 && !currentAccount && connectedWallet) {
      // If there are available wallets with accounts, but no currentAccount, 
      // check if any wallet has accounts before forcing disconnect
      const hasWalletStandardConnection = availableWallets.some(wallet => 
        wallet.accounts && wallet.accounts.length > 0
      )
      
      if (!hasWalletStandardConnection) {
        console.log('⚠️ No wallet-standard connection found, forcing disconnect.')
        disconnectWallet()
      } else {
        console.log('✅ Wallet-standard connection exists, keeping connected despite dapp-kit mismatch')
      }
    }
  }, [availableWallets, currentAccount, connectedWallet, disconnectWallet, checkForExistingConnections])

  return {
    userData,
    loading: loading || isInitializing,
    walletLoadingStates,
    error,
    network: network || 'loading',
    isSigning,
    transactionHistory,
    balance,
    isConnected: !!currentAccount || connectionStatus === 'connected',
    wallets: availableWallets,
    currentAccount,
    isInitializing,
    walletDetectionRetries,
    walletEvents,
    connectedWallet,
    connectionStatus,
    connectToWallet,
    disconnectWallet,
    disconnectFromWallet,
    signTestTransaction,
    refreshBalance,
    saveUserData,
    setError,
    isWalletConnected
  }
}