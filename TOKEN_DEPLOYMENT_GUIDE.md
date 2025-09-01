# Aeroband Token Deployment Guide

## Overview
This guide will teach you how to create and deploy the Aeroband token on Sui testnet, and then integrate it into your IoT project for task completion rewards.

## Prerequisites

1. **Install Sui CLI**
   ```bash
   # Install Sui CLI
   curl -fsSL https://raw.githubusercontent.com/MystenLabs/sui/main/docs/scripts/install-sui.sh | sh
   
   # Verify installation
   sui --version
   ```

2. **Get Testnet SUI Tokens**
   - Go to [Sui Testnet Faucet](https://discord.gg/sui)
   - Request testnet SUI tokens for your wallet address

## Step 1: Deploy the Token Contract

1. **Navigate to the contracts directory**
   ```bash
   cd contracts
   ```

2. **Build the contract**
   ```bash
   sui move build
   ```

3. **Deploy to testnet**
   ```bash
   sui client publish --gas-budget 10000000 --network testnet
   ```

4. **Save the deployment information**
   After deployment, you'll get output like:
   ```
   Transaction Digest: 0x...
   Package ID: 0x...
   Treasury Cap ID: 0x...
   Metadata ID: 0x...
   ```

   **Save these IDs!** You'll need them for the frontend integration.

## Step 2: Update Your Project Configuration

After deployment, update your project configuration with the deployed token information:

1. **Create a token configuration file**
   ```javascript
   // src/config/token.js
   export const TOKEN_CONFIG = {
     PACKAGE_ID: "0x...", // Your deployed package ID
     TREASURY_CAP_ID: "0x...", // Your treasury cap ID
     METADATA_ID: "0x...", // Your metadata ID
     SYMBOL: "AEROBAND",
     DECIMALS: 9,
     REWARD_AMOUNTS: {
       LOW_PRIORITY_TASK: 10,      // 10 tokens
       MEDIUM_PRIORITY_TASK: 25,   // 25 tokens
       HIGH_PRIORITY_TASK: 50,     // 50 tokens
       DAILY_STREAK: 100,          // 100 tokens for 7-day streak
       WEEKLY_GOAL: 500            // 500 tokens for completing weekly goals
     }
   };
   ```

## Step 3: Create Token Management Functions

Create a utility file for token operations:

```javascript
// src/utils/tokenOperations.js
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { TOKEN_CONFIG } from '../config/token.js';

export class TokenManager {
  constructor(suiClient, wallet) {
    this.suiClient = suiClient;
    this.wallet = wallet;
  }

  // Mint tokens to a user for completing tasks
  async mintTokens(recipientAddress, amount) {
    const tx = new TransactionBlock();
    
    tx.moveCall({
      target: `${TOKEN_CONFIG.PACKAGE_ID}::aeroband_token::mint`,
      arguments: [
        tx.object(TOKEN_CONFIG.TREASURY_CAP_ID),
        tx.pure(recipientAddress),
        tx.pure(amount)
      ]
    });

    try {
      const result = await this.wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: { showEffects: true }
      });
      
      console.log('Tokens minted successfully:', result);
      return result;
    } catch (error) {
      console.error('Error minting tokens:', error);
      throw error;
    }
  }

  // Get user's token balance
  async getTokenBalance(userAddress) {
    try {
      const coins = await this.suiClient.getCoins({
        owner: userAddress,
        coinType: `${TOKEN_CONFIG.PACKAGE_ID}::aeroband_token::AEROBAND_TOKEN`
      });

      const totalBalance = coins.data.reduce((sum, coin) => {
        return sum + BigInt(coin.balance);
      }, BigInt(0));

      return Number(totalBalance);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  // Transfer tokens between users
  async transferTokens(recipientAddress, amount) {
    const tx = new TransactionBlock();
    
    // Get user's coins
    const coins = await this.suiClient.getCoins({
      owner: this.wallet.account.address,
      coinType: `${TOKEN_CONFIG.PACKAGE_ID}::aeroband_token::AEROBAND_TOKEN`
    });

    if (coins.data.length === 0) {
      throw new Error('No tokens available to transfer');
    }

    // Use the first coin for transfer
    const coinToTransfer = coins.data[0];
    
    tx.moveCall({
      target: `${TOKEN_CONFIG.PACKAGE_ID}::aeroband_token::transfer`,
      arguments: [
        tx.object(coinToTransfer.objectId),
        tx.pure(recipientAddress)
      ]
    });

    try {
      const result = await this.wallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: { showEffects: true }
      });
      
      console.log('Tokens transferred successfully:', result);
      return result;
    } catch (error) {
      console.error('Error transferring tokens:', error);
      throw error;
    }
  }
}
```

## Step 4: Integrate with Tasks Component

Update your Tasks component to include token rewards:

```javascript
// In src/Tasks.jsx - Add these imports and state
import { TokenManager } from '../utils/tokenOperations.js';
import { TOKEN_CONFIG } from '../config/token.js';

// Add to your component state
const [tokenBalance, setTokenBalance] = useState(0);
const [tokenManager, setTokenManager] = useState(null);

// Initialize token manager when wallet connects
useEffect(() => {
  if (suiClient && connectedWallet) {
    const manager = new TokenManager(suiClient, connectedWallet);
    setTokenManager(manager);
    loadTokenBalance();
  }
}, [suiClient, connectedWallet]);

// Load token balance
const loadTokenBalance = async () => {
  if (tokenManager && connectedWallet?.accounts?.[0]?.address) {
    const balance = await tokenManager.getTokenBalance(connectedWallet.accounts[0].address);
    setTokenBalance(balance);
  }
};

// Update the toggleTask function to include rewards
const toggleTask = async (taskId) => {
  const task = tasks.find(t => t.id === taskId);
  const wasCompleted = task.completed;
  
  setTasks(tasks.map(task => 
    task.id === taskId 
      ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null }
      : task
  ));

  // Reward tokens when task is completed (not when uncompleting)
  if (!wasCompleted && tokenManager && connectedWallet?.accounts?.[0]?.address) {
    try {
      const rewardAmount = TOKEN_CONFIG.REWARD_AMOUNTS[task.priority.toUpperCase() + '_PRIORITY_TASK'] || 
                          TOKEN_CONFIG.REWARD_AMOUNTS.MEDIUM_PRIORITY_TASK;
      
      await tokenManager.mintTokens(connectedWallet.accounts[0].address, rewardAmount);
      
      // Reload balance
      await loadTokenBalance();
      
      // Show success message
      alert(`🎉 Task completed! You earned ${rewardAmount} AEROBAND tokens!`);
    } catch (error) {
      console.error('Error rewarding tokens:', error);
      alert('Task completed, but there was an issue with token rewards.');
    }
  }
};
```

## Step 5: Add Token Balance Display

Add a token balance component to your navigation:

```javascript
// src/components/TokenBalance.jsx
import { useState, useEffect } from 'react';
import { TokenManager } from '../utils/tokenOperations.js';

function TokenBalance({ suiClient, connectedWallet }) {
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (suiClient && connectedWallet) {
      loadBalance();
    }
  }, [suiClient, connectedWallet]);

  const loadBalance = async () => {
    if (!connectedWallet?.accounts?.[0]?.address) return;
    
    setLoading(true);
    try {
      const manager = new TokenManager(suiClient, connectedWallet);
      const tokenBalance = await manager.getTokenBalance(connectedWallet.accounts[0].address);
      setBalance(tokenBalance);
    } catch (error) {
      console.error('Error loading token balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!connectedWallet) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
      <span className="text-yellow-600 dark:text-yellow-400 font-medium">
        🪙 {loading ? '...' : balance.toLocaleString()} AEROBAND
      </span>
    </div>
  );
}

export default TokenBalance;
```

## Step 6: Test Your Token System

1. **Deploy the contract** using the steps above
2. **Update your configuration** with the deployed IDs
3. **Test token minting** by completing tasks
4. **Verify token balance** updates correctly
5. **Test token transfers** between users

## Important Notes

- **Treasury Cap Security**: The treasury cap controls minting. Keep it secure!
- **Gas Fees**: All transactions require SUI for gas fees
- **Testnet vs Mainnet**: This guide is for testnet. For mainnet, change network settings
- **Error Handling**: Always implement proper error handling for blockchain transactions
- **User Experience**: Consider showing transaction status and confirmation messages

## Next Steps

1. Deploy your token contract
2. Update the configuration with your deployed IDs
3. Integrate the token system into your Tasks component
4. Test the complete flow
5. Add additional features like token staking, governance, or marketplace

Would you like me to help you with any specific part of this implementation?
