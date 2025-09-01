// Token configuration for Aeroband Token
// Update these values after deploying your token contract

export const TOKEN_CONFIG = {
  // These will be updated after deployment
  PACKAGE_ID: "0x...", // Your deployed package ID
  TREASURY_CAP_ID: "0x...", // Your treasury cap ID
  METADATA_ID: "0x...", // Your metadata ID
  
  // Token details
  SYMBOL: "AEROBAND",
  DECIMALS: 9,
  NAME: "Aeroband Token",
  DESCRIPTION: "Token earned by completing IoT project tasks",
  
  // Reward amounts for different task types
  REWARD_AMOUNTS: {
    LOW_PRIORITY_TASK: 10,      // 10 tokens
    MEDIUM_PRIORITY_TASK: 25,   // 25 tokens
    HIGH_PRIORITY_TASK: 50,     // 50 tokens
    DAILY_STREAK: 100,          // 100 tokens for 7-day streak
    WEEKLY_GOAL: 500,           // 500 tokens for completing weekly goals
    SENSOR_DATA_UPLOAD: 5,      // 5 tokens for uploading sensor data
    IOT_DEVICE_CONNECT: 15      // 15 tokens for connecting IoT device
  },
  
  // Network configuration
  NETWORK: "testnet", // or "mainnet"
  
  // Transaction settings
  GAS_BUDGET: 10000000,
  
  // UI settings
  DISPLAY_DECIMALS: 2, // Number of decimal places to show in UI
  MIN_DISPLAY_AMOUNT: 0.01 // Minimum amount to display
};

// Helper function to format token amounts for display
export const formatTokenAmount = (amount) => {
  const formatted = (amount / Math.pow(10, TOKEN_CONFIG.DECIMALS)).toFixed(TOKEN_CONFIG.DISPLAY_DECIMALS);
  return parseFloat(formatted).toLocaleString();
};

// Helper function to convert display amount to raw amount
export const parseTokenAmount = (displayAmount) => {
  return Math.floor(displayAmount * Math.pow(10, TOKEN_CONFIG.DECIMALS));
};

// Get reward amount for task priority
export const getTaskReward = (priority) => {
  const priorityKey = priority.toUpperCase() + '_PRIORITY_TASK';
  return TOKEN_CONFIG.REWARD_AMOUNTS[priorityKey] || TOKEN_CONFIG.REWARD_AMOUNTS.MEDIUM_PRIORITY_TASK;
};
