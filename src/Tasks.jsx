import { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  CheckIcon, 
  ClockIcon,
  CalendarIcon,
  FlagIcon,
  StarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { SuiRewardManager, getTaskReward, formatSuiAmount, getTreasuryInfo } from './utils/suiRewards.js';

// Predefined pool of 20 simple, user-friendly tasks
const TASK_POOL = [
  { id: 1, title: "Check device battery level", description: "Look at your device and check if the battery indicator shows good charge", category: "monitoring", difficulty: "easy" },
  { id: 2, title: "Clean device surface", description: "Gently wipe your IoT device with a clean, dry cloth to remove dust", category: "maintenance", difficulty: "easy" },
  { id: 3, title: "Verify device is powered on", description: "Make sure your device has a green light or display showing it's working", category: "connectivity", difficulty: "easy" },
  { id: 4, title: "Check WiFi connection", description: "Ensure your device shows it's connected to your home WiFi network", category: "connectivity", difficulty: "easy" },
  { id: 5, title: "Read current temperature", description: "Look at your device display or app to see what temperature it's showing", category: "monitoring", difficulty: "easy" },
  { id: 6, title: "Check air quality reading", description: "View the current air quality measurement displayed on your device", category: "monitoring", difficulty: "easy" },
  { id: 7, title: "Restart your device", description: "Turn off your device, wait 10 seconds, then turn it back on", category: "maintenance", difficulty: "easy" },
  { id: 8, title: "Update mobile app", description: "Check your app store for any available updates to the IoT app", category: "maintenance", difficulty: "easy" },
  { id: 9, title: "Check device location", description: "Make sure your device is placed in an open area, not behind furniture", category: "placement", difficulty: "easy" },
  { id: 10, title: "Test mobile app connection", description: "Open your mobile app and verify it shows your device is online", category: "connectivity", difficulty: "easy" },
  { id: 11, title: "Check device for error lights", description: "Look for any red or orange warning lights on your device", category: "monitoring", difficulty: "easy" },
  { id: 12, title: "Verify sensor readings", description: "Check if temperature and air quality numbers seem reasonable for your room", category: "monitoring", difficulty: "easy" },
  { id: 13, title: "Check device manual", description: "Look through your device's instruction manual or quick start guide", category: "documentation", difficulty: "easy" },
  { id: 14, title: "Test device buttons", description: "Press any buttons on your device to make sure they respond properly", category: "testing", difficulty: "easy" },
  { id: 15, title: "Check device cables", description: "Ensure all power and connection cables are securely plugged in", category: "connectivity", difficulty: "easy" },
  { id: 16, title: "Monitor device for 5 minutes", description: "Watch your device for 5 minutes to see if readings change", category: "monitoring", difficulty: "easy" },
  { id: 17, title: "Check device settings", description: "Look through your mobile app settings to see available options", category: "configuration", difficulty: "easy" },
  { id: 18, title: "Test notifications", description: "Check if your app sends you alerts when you open it", category: "testing", difficulty: "easy" },
  { id: 19, title: "Verify device time", description: "Check if your device shows the correct current time", category: "monitoring", difficulty: "easy" },
  { id: 20, title: "Share device status", description: "Take a screenshot of your device readings and share with family", category: "social", difficulty: "easy" }
];

function Tasks({ suiClient, connectedWallet, wallets = [], connectToWallet, noWalletDetected, walletInstallHint }) {
  console.log('Tasks Component Props:', {
    suiClient: !!suiClient,
    suiClientType: typeof suiClient,
    connectedWallet: !!connectedWallet,
    connectedWalletName: connectedWallet?.name,
    connectedWalletAccounts: connectedWallet?.accounts?.length || 0,
    connectedWalletAccountsArray: connectedWallet?.accounts,
    firstAccountAddress: connectedWallet?.accounts?.[0]?.address
  });

  // Simple test to see if the wallet connection is working
  useEffect(() => {
    console.log('🧪 Simple wallet connection test:', {
      hasSuiClient: !!suiClient,
      hasConnectedWallet: !!connectedWallet,
      walletName: connectedWallet?.name,
      accountsLength: connectedWallet?.accounts?.length || 0,
      firstAccount: connectedWallet?.accounts?.[0]?.address,
      allConditionsMet: !!(suiClient && connectedWallet && connectedWallet.accounts && connectedWallet.accounts.length > 0)
    });
    
    // Force reward manager initialization if conditions are met
    if (suiClient && connectedWallet && connectedWallet.accounts && connectedWallet.accounts.length > 0) {
      console.log('🚀 Forcing reward manager initialization due to wallet connection...');
      
      // Clear existing reward manager first
      if (rewardManager) {
        setRewardManager(null);
        setTreasuryInfo(null);
        setTreasuryBalance(0);
      }
      
      // Initialize new reward manager
      try {
        const manager = new SuiRewardManager(suiClient, connectedWallet);
        setRewardManager(manager);
        console.log('✅ Reward manager created successfully (forced initialization)');
        
        // Get treasury info
        const info = getTreasuryInfo(manager);
        setTreasuryInfo(info);
        console.log('✅ Treasury info set (forced initialization):', info);
        
        // Load treasury balance
        if (info?.isAvailable) {
          manager.getTreasuryBalance().then(balance => {
            setTreasuryBalance(balance);
            console.log('✅ Treasury balance loaded (forced initialization):', balance);
          }).catch(error => {
            console.error('❌ Error loading treasury balance (forced initialization):', error);
          });
        }
      } catch (error) {
        console.error('❌ Error creating reward manager (forced initialization):', error);
      }
    }
  }, [suiClient, connectedWallet]);

  const [assignedTasks, setAssignedTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [filter, setFilter] = useState('assigned'); // assigned, completed, available
  const [showRewards, setShowRewards] = useState(false);
  const [totalRewards, setTotalRewards] = useState(0);
  const [rewardManager, setRewardManager] = useState(null);
  const [treasuryInfo, setTreasuryInfo] = useState(null);
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);
  const [rewardManagerRetries, setRewardManagerRetries] = useState(0);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Load user's tasks from localStorage on component mount
  useEffect(() => {
    const savedAssigned = localStorage.getItem('aeroband-assigned-tasks');
    const savedCompleted = localStorage.getItem('aeroband-completed-tasks');
    const savedRewards = localStorage.getItem('aeroband-total-rewards');
    
    if (savedAssigned) {
      setAssignedTasks(JSON.parse(savedAssigned));
    }
    if (savedCompleted) {
      setCompletedTasks(JSON.parse(savedCompleted));
    }
    if (savedRewards) {
      setTotalRewards(parseFloat(savedRewards));
    }
    
    // Generate available tasks (excluding already assigned/completed)
    generateAvailableTasks();
  }, []);

  // Initialize reward manager when wallet connection is established
  useEffect(() => {
    console.log('🔄 Reward Manager Initialization Check:', {
      suiClient: !!suiClient,
      suiClientType: typeof suiClient,
      connectedWallet: !!connectedWallet,
      connectedWalletName: connectedWallet?.name,
      connectedWalletAccounts: connectedWallet?.accounts?.length || 0,
      firstAccountAddress: connectedWallet?.accounts?.[0]?.address,
      hasAccounts: !!(connectedWallet?.accounts && connectedWallet.accounts.length > 0),
      accountsArray: connectedWallet?.accounts,
      timestamp: new Date().toISOString()
    });

    // Add a small delay to ensure wallet connection is fully established
    const initTimer = setTimeout(() => {
      // Only initialize if we have both suiClient and connectedWallet with accounts
      if (suiClient && connectedWallet && connectedWallet.accounts && connectedWallet.accounts.length > 0) {
        console.log('🔧 Initializing reward manager with:', {
          suiClient: !!suiClient,
          connectedWallet: connectedWallet,
          connectedWalletAccounts: connectedWallet?.accounts,
          firstAccountAddress: connectedWallet?.accounts?.[0]?.address
        });
        
        try {
          const manager = new SuiRewardManager(suiClient, connectedWallet);
          setRewardManager(manager);
          console.log('✅ Reward manager created successfully');
          
          // Get treasury info
          const info = getTreasuryInfo(manager);
          setTreasuryInfo(info);
          console.log('✅ Treasury info set:', info);
          
          // Load treasury balance
          if (info?.isAvailable) {
            manager.getTreasuryBalance().then(balance => {
              setTreasuryBalance(balance);
              console.log('✅ Treasury balance loaded:', balance);
            }).catch(error => {
              console.error('❌ Error loading treasury balance:', error);
            });
          }
        } catch (error) {
          console.error('❌ Error creating reward manager:', error);
        }
      } else {
        console.log('⚠️ Cannot initialize reward manager:', {
          suiClient: !!suiClient,
          suiClientType: typeof suiClient,
          connectedWallet: !!connectedWallet,
          connectedWalletName: connectedWallet?.name,
          connectedWalletAccounts: connectedWallet?.accounts?.length || 0,
          hasAccounts: !!(connectedWallet?.accounts && connectedWallet.accounts.length > 0),
          accountsArray: connectedWallet?.accounts,
          condition1: !!suiClient,
          condition2: !!connectedWallet,
          condition3: !!(connectedWallet?.accounts),
          condition4: !!(connectedWallet?.accounts?.length > 0)
        });
        
        // Clear reward manager if wallet is disconnected
        if (rewardManager) {
          console.log('🔄 Clearing reward manager due to wallet disconnection');
          setRewardManager(null);
          setTreasuryInfo(null);
          setTreasuryBalance(0);
        }
      }
    }, 500); // Wait 500ms for wallet connection to stabilize

    return () => clearTimeout(initTimer);
  }, [suiClient, connectedWallet]);

  // Retry reward manager initialization if it fails
  useEffect(() => {
    if (!rewardManager && suiClient && connectedWallet && rewardManagerRetries < 3) {
      const timer = setTimeout(() => {
        console.log(`🔄 Retrying reward manager initialization (attempt ${rewardManagerRetries + 1})`);
        setRewardManagerRetries(prev => prev + 1);
        
        // Force re-initialization by triggering the effect again
        if (suiClient && connectedWallet && connectedWallet.accounts && connectedWallet.accounts.length > 0) {
          try {
            const manager = new SuiRewardManager(suiClient, connectedWallet);
            setRewardManager(manager);
            console.log('✅ Reward manager created on retry');
            
            const info = getTreasuryInfo(manager);
            setTreasuryInfo(info);
            
            if (info?.isAvailable) {
              manager.getTreasuryBalance().then(balance => {
                setTreasuryBalance(balance);
              }).catch(error => {
                console.error('Error loading treasury balance on retry:', error);
              });
            }
          } catch (error) {
            console.error('Error creating reward manager on retry:', error);
          }
        }
      }, 2000); // Wait 2 seconds before retrying
      
      return () => clearTimeout(timer);
    }
  }, [rewardManager, suiClient, connectedWallet, rewardManagerRetries]);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('aeroband-assigned-tasks', JSON.stringify(assignedTasks));
  }, [assignedTasks]);

  useEffect(() => {
    localStorage.setItem('aeroband-completed-tasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  useEffect(() => {
    localStorage.setItem('aeroband-total-rewards', totalRewards.toString());
  }, [totalRewards]);

  // Regenerate available tasks when assigned or completed tasks change
  useEffect(() => {
    generateAvailableTasks();
  }, [assignedTasks, completedTasks]);

  // Generate available tasks (excluding already assigned/completed)
  const generateAvailableTasks = () => {
    const assignedIds = assignedTasks.map(t => t.id);
    const completedIds = completedTasks.map(t => t.id);
    const excludedIds = [...assignedIds, ...completedIds];
    
    const available = TASK_POOL.filter(task => !excludedIds.includes(task.id));
    setAvailableTasks(available);
  };

  // Assign a random task to user (max 5)
  const assignRandomTask = () => {
    if (assignedTasks.length >= 5) {
      alert('You can only have 5 active tasks at a time. Complete some tasks first!');
      return;
    }

    if (availableTasks.length === 0) {
      alert('No more tasks available! Complete some tasks to get new ones.');
      return;
    }

    // Select random task from available pool
    const randomIndex = Math.floor(Math.random() * availableTasks.length);
    const selectedTask = availableTasks[randomIndex];
    
    // Add assigned date and status
    const assignedTask = {
      ...selectedTask,
      assignedAt: new Date().toISOString(),
      status: 'in-progress'
    };

    setAssignedTasks([...assignedTasks, assignedTask]);
    generateAvailableTasks(); // Regenerate available tasks
  };

  // Complete a task and award SUI coins
  const completeTask = async (taskId) => {
    const task = assignedTasks.find(t => t.id === taskId);
    if (!task) return;

    setIsProcessingTransaction(true);

    try {
      const reward = getTaskReward(task.difficulty);
      
      // Check if treasury has enough balance
      if (rewardManager && treasuryInfo?.isAvailable) {
        const hasEnoughBalance = await rewardManager.hasEnoughTreasuryBalance(reward);
        if (!hasEnoughBalance) {
          alert(`⚠️ Treasury has insufficient SUI balance for reward. Need ${formatSuiAmount(reward)} but only ${formatSuiAmount(treasuryBalance)} available.`);
          return;
        }
      }
      
      // Award SUI coins from treasury - REAL TRANSACTIONS ONLY
      console.log('🔍 Wallet connection debug:', {
        rewardManager: !!rewardManager,
        connectedWallet: connectedWallet,
        connectedWalletAccounts: connectedWallet?.accounts,
        firstAccountAddress: connectedWallet?.accounts?.[0]?.address,
        suiClient: !!suiClient
      });

      if (!rewardManager) {
        alert('❌ Reward manager not initialized. Please ensure wallet is connected.');
        return;
      }

      if (!connectedWallet) {
        alert('❌ Wallet not connected. Please connect your wallet to receive rewards.');
        return;
      }

      if (!connectedWallet.accounts || connectedWallet.accounts.length === 0) {
        alert('❌ No accounts found in connected wallet. Please ensure wallet is properly connected.');
        return;
      }

      if (!connectedWallet.accounts[0]?.address) {
        alert('❌ No valid address found in connected wallet. Please reconnect your wallet.');
        return;
      }

      let rewardResult = null;
      try {
        rewardResult = await rewardManager.awardCoins(connectedWallet.accounts[0].address, reward);
        console.log('Reward result:', rewardResult);
        
        if (rewardResult.success) {
          // Update treasury balance after successful transaction
          if (treasuryInfo?.isAvailable) {
            const newBalance = await rewardManager.getTreasuryBalance();
            setTreasuryBalance(newBalance);
          }
          
          // Show transaction details
          const txMessage = rewardResult.transactionDigest 
            ? `Transaction: ${rewardResult.transactionDigest.slice(0, 8)}...${rewardResult.transactionDigest.slice(-8)}`
            : '';
          console.log('Transaction details:', txMessage);
        } else {
          // Handle failed transaction
          console.error('Transaction failed:', rewardResult.error);
          alert(`❌ Transaction failed: ${rewardResult.error}`);
          return; // Don't complete the task if transaction failed
        }
        
      } catch (rewardError) {
        console.error('Error in reward transaction:', rewardError);
        alert(`❌ Error processing reward: ${rewardError.message}`);
        return; // Don't complete the task if there's an error
      }
      
      // Move task from assigned to completed
      setAssignedTasks(assignedTasks.filter(t => t.id !== taskId));
      setCompletedTasks([...completedTasks, { ...task, completedAt: new Date().toISOString() }]);
      
      // Update total rewards
      setTotalRewards(prev => prev + reward);
      
      // Show success message
      const message = `🎉 Task completed! You earned ${formatSuiAmount(reward)} from treasury!\n\nTransaction: ${rewardResult?.transactionDigest ? `${rewardResult.transactionDigest.slice(0, 8)}...${rewardResult.transactionDigest.slice(-8)}` : 'Submitted'}`;
      alert(message);
      
      // Regenerate available tasks
      generateAvailableTasks();
      
    } catch (error) {
      console.error('Error completing task:', error);
      alert('Error completing task. Please try again.');
    } finally {
      setIsProcessingTransaction(false);
    }
  };

  // Abandon a task (return to available pool)
  const abandonTask = (taskId) => {
    const task = assignedTasks.find(t => t.id === taskId);
    if (!task) return;

    setAssignedTasks(assignedTasks.filter(t => t.id !== taskId));
    generateAvailableTasks(); // Regenerate available tasks
  };

  // Get difficulty color
  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'hard': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Get difficulty icon
  const getDifficultyIcon = (difficulty) => {
    switch (difficulty) {
      case 'easy': return <StarIcon className="w-4 h-4" />;
      case 'medium': return <FlagIcon className="w-4 h-4" />;
      case 'hard': return <ExclamationTriangleIcon className="w-4 h-4" />;
      default: return <StarIcon className="w-4 h-4" />;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Get task statistics
  const stats = {
    assigned: assignedTasks.length,
    completed: completedTasks.length,
    available: availableTasks.length,
    totalRewards: totalRewards.toFixed(6)
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Wallet connect fallback */}
        {!connectedWallet && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 sm:p-6 rounded-xl border border-blue-200 dark:border-blue-800 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-blue-800 dark:text-blue-200 mb-2">Connect a Sui Wallet to earn rewards</h3>
                {noWalletDetected ? (
                  <p className="text-sm text-blue-700 dark:text-blue-300">No Sui-compatible wallet detected. Install one to continue:</p>
                ) : (
                  <p className="text-sm text-blue-700 dark:text-blue-300">Choose a wallet to connect and receive SUI rewards for tasks.</p>
                )}
                {walletInstallHint && walletInstallHint.links && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {walletInstallHint.links.map(link => (
                      <a key={link.name} href={link.url} target="_blank" rel="noreferrer" className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-800 border border-blue-200 dark:border-gray-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors">
                        {link.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {!noWalletDetected && wallets?.length > 0 && connectToWallet && (
                <button
                  onClick={() => connectToWallet(wallets[0])}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                >
                  Connect {wallets[0]?.name}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-3">IoT Task Challenge</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto sm:mx-0">Complete tasks to earn SUI coins and improve your IoT project</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">{stats.assigned}/5</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Active Tasks</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">{stats.completed}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-2xl sm:text-3xl font-bold text-purple-600 mb-1">{stats.available}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Available</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="text-2xl sm:text-3xl font-bold text-yellow-600 mb-1">{stats.totalRewards}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">SUI Earned</div>
          </div>
        </div>

        {/* Treasury Information */}
        {treasuryInfo && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 sm:p-6 rounded-xl border border-blue-200 dark:border-blue-800 mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg sm:text-xl font-semibold text-blue-800 dark:text-blue-200 mb-3">🎯 Reward Treasury</h3>
                <p className="text-sm sm:text-base text-blue-600 dark:text-blue-300 mb-3">
                  Real SUI rewards are distributed from your connected wallet address
                </p>
                <div className="text-xs sm:text-sm text-blue-500 dark:text-blue-400 font-mono mb-3">
                  {treasuryInfo.address ? `${treasuryInfo.address.slice(0, 6)}...${treasuryInfo.address.slice(-4)}` : 'Not connected'}
                </div>
                {isProcessingTransaction && (
                  <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 text-sm">
                    <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                    Processing blockchain transaction...
                  </div>
                )}
                
                {/* Collapsible Debug Info */}
                <div className="mt-4">
                  <button
                    onClick={() => setShowDebugInfo(!showDebugInfo)}
                    className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {showDebugInfo ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                    Debug Info
                  </button>
                  {showDebugInfo && (
                    <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Reward Manager: {rewardManager ? '✅' : '❌'}</div>
                      <div>Connected Wallet: {connectedWallet ? '✅' : '❌'}</div>
                      <div>Wallet Accounts: {connectedWallet?.accounts?.length || 0}</div>
                      <div>First Address: {connectedWallet?.accounts?.[0]?.address ? '✅' : '❌'}</div>
                      <div>Retry Attempts: {rewardManagerRetries}/3</div>
                      {!rewardManager && connectedWallet && (
                        <button 
                          onClick={() => {
                            console.log('🔄 Manual reward manager refresh');
                            setRewardManagerRetries(0);
                            if (suiClient && connectedWallet && connectedWallet.accounts && connectedWallet.accounts.length > 0) {
                              try {
                                const manager = new SuiRewardManager(suiClient, connectedWallet);
                                setRewardManager(manager);
                                const info = getTreasuryInfo(manager);
                                setTreasuryInfo(info);
                                if (info?.isAvailable) {
                                  manager.getTreasuryBalance().then(balance => setTreasuryBalance(balance));
                                }
                              } catch (error) {
                                console.error('Manual refresh failed:', error);
                              }
                            }
                          }}
                          className="mt-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs hover:bg-blue-600 transition-colors"
                        >
                          🔄 Refresh
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-center lg:text-right">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-1">{treasuryBalance.toFixed(3)}</div>
                <div className="text-sm sm:text-base text-blue-600 dark:text-blue-300">SUI Available</div>
              </div>
            </div>
          </div>
        )}

        {/* Task Assignment */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Get New Tasks</h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                You can have up to 5 active tasks. Complete tasks to earn SUI coins and unlock new challenges!
                {treasuryInfo?.isAvailable && (
                  <span className="block text-green-600 dark:text-green-400 mt-2">
                    ✅ Treasury connected - real SUI rewards will be distributed from your wallet
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={assignRandomTask}
              disabled={assignedTasks.length >= 5 || availableTasks.length === 0}
              className={`px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 min-w-[140px] ${
                assignedTasks.length >= 5 || availableTasks.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
            >
              <SparklesIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Get Random Task</span>
              <span className="sm:hidden">Get Task</span>
            </button>
          </div>
        </div>

        {/* Mobile-First Filters */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mb-6">
          <button
            onClick={() => setFilter('assigned')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'assigned' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="hidden sm:inline">Active Tasks</span>
            <span className="sm:hidden">Active</span>
            <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full text-xs">
              {assignedTasks.length}
            </span>
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'completed' 
                ? 'bg-green-600 text-white shadow-sm' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="hidden sm:inline">Completed</span>
            <span className="sm:hidden">Done</span>
            <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-full text-xs">
              {completedTasks.length}
            </span>
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              filter === 'available' 
                ? 'bg-purple-600 text-white shadow-sm' 
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <span className="hidden sm:inline">Available</span>
            <span className="sm:hidden">Available</span>
            <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 rounded-full text-xs">
              {availableTasks.length}
            </span>
          </button>
        </div>

        {/* Task Lists */}
        {filter === 'assigned' && (
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Your Active Tasks</h3>
            {assignedTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <SparklesIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg font-medium mb-2">No active tasks</p>
                <p className="text-sm">Click "Get Random Task" to start earning SUI coins!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {assignedTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h4 className="text-lg sm:text-xl font-medium text-gray-800 dark:text-gray-100">{task.title}</h4>
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${getDifficultyColor(task.difficulty)}`}>
                            {getDifficultyIcon(task.difficulty)}
                            <span className="hidden sm:inline">{task.difficulty}</span>
                            <span className="sm:hidden">{task.difficulty.charAt(0).toUpperCase()}</span>
                          </span>
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 flex items-center gap-1.5">
                            <CurrencyDollarIcon className="w-3 h-3" />
                            {getTaskReward(task.difficulty)} SUI
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm sm:text-base">{task.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Assigned:</span>
                            {formatDate(task.assignedAt)}
                          </span>
                          <span className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 text-xs font-medium">
                            {task.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 min-w-[120px]">
                        <button
                          onClick={() => completeTask(task.id)}
                          disabled={isProcessingTransaction}
                          className={`px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium ${
                            isProcessingTransaction
                              ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                          }`}
                        >
                          {isProcessingTransaction ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span className="hidden sm:inline">Processing...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="w-4 h-4" />
                              <span className="hidden sm:inline">Complete</span>
                              <span className="sm:hidden">Done</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => abandonTask(task.id)}
                          className="px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium shadow-sm"
                        >
                          <span className="hidden sm:inline">Abandon</span>
                          <span className="sm:hidden">Drop</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {filter === 'completed' && (
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Completed Tasks</h3>
            {completedTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <CheckCircleIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg font-medium mb-2">No completed tasks yet</p>
                <p className="text-sm">Start working on your first task!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {completedTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-green-50 dark:bg-green-900/10 p-4 sm:p-6 rounded-xl border border-green-200 dark:border-green-800"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h4 className="text-lg sm:text-xl font-medium text-gray-800 dark:text-gray-100 line-through">{task.title}</h4>
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-600 flex items-center gap-1.5">
                            <CheckCircleIcon className="w-3 h-3" />
                            <span className="hidden sm:inline">Completed</span>
                            <span className="sm:hidden">Done</span>
                          </span>
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 flex items-center gap-1.5">
                            <CurrencyDollarIcon className="w-3 h-3" />
                            {getTaskReward(task.difficulty)} SUI earned
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm sm:text-base">{task.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1.5">
                            <CalendarIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Completed:</span>
                            {formatDate(task.completedAt)}
                          </span>
                          <span className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 text-xs font-medium">
                            {task.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {filter === 'available' && (
          <div className="space-y-4">
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-6">Available Tasks</h3>
            {availableTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                  <FlagIcon className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-lg font-medium mb-2">No more tasks available!</p>
                <p className="text-sm">Complete some active tasks to unlock new challenges.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {availableTasks.map(task => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h4 className="text-lg sm:text-xl font-medium text-gray-800 dark:text-gray-100">{task.title}</h4>
                          <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${getDifficultyColor(task.difficulty)}`}>
                            {getDifficultyIcon(task.difficulty)}
                            <span className="hidden sm:inline">{task.difficulty}</span>
                            <span className="sm:hidden">{task.difficulty.charAt(0).toUpperCase()}</span>
                          </span>
                          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 flex items-center gap-1.5">
                            <CurrencyDollarIcon className="w-3 h-3" />
                            {getTaskReward(task.difficulty)} SUI
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-3 text-sm sm:text-base">{task.description}</p>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-600 text-xs font-medium">
                            {task.category}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => assignRandomTask()}
                        disabled={assignedTasks.length >= 5}
                        className={`px-6 py-2.5 rounded-lg font-medium transition-colors min-w-[120px] ${
                          assignedTasks.length >= 5
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                      >
                        <span className="hidden sm:inline">Assign Task</span>
                        <span className="sm:hidden">Assign</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Tasks;
