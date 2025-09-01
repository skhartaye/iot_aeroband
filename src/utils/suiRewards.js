// SUI Coin Rewards Utility
// This file handles SUI coin rewards for task completion

import { TransactionBlock } from '@mysten/sui/transactions';

export class SuiRewardManager {
  constructor(suiClient, connectedWallet) {
    this.suiClient = suiClient;
    this.connectedWallet = connectedWallet;
  }

  // Award SUI coins to user for completing a task
  async awardCoins(recipientAddress, amount) {
    if (!this.suiClient || !this.connectedWallet) {
      throw new Error('Sui client or wallet not available');
    }

    try {
      // Create a transaction to transfer SUI coins
      const tx = new TransactionBlock();
      
      // Split coins from the connected wallet to send to recipient
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)]);
      
      // Transfer the split coin to the recipient
      tx.transferObjects([coin], tx.pure(recipientAddress));

      // Execute the transaction
      const result = await this.connectedWallet.signAndExecuteTransactionBlock({
        transactionBlock: tx,
        options: { showEffects: true }
      });

      console.log('SUI coins awarded successfully:', result);
      return result;
    } catch (error) {
      console.error('Error awarding SUI coins:', error);
      throw error;
    }
  }

  // Get user's SUI coin balance
  async getBalance(userAddress) {
    if (!this.suiClient) {
      throw new Error('Sui client not available');
    }

    try {
      const coins = await this.suiClient.getCoins({
        owner: userAddress,
        coinType: '0x2::sui::SUI'
      });

      const totalBalance = coins.data.reduce((sum, coin) => {
        return sum + BigInt(coin.balance);
      }, BigInt(0));

      return Number(totalBalance);
    } catch (error) {
      console.error('Error getting SUI balance:', error);
      return 0;
    }
  }

  // Check if user has enough SUI for rewards
  async hasEnoughBalance(requiredAmount) {
    if (!this.connectedWallet?.accounts?.[0]?.address) {
      return false;
    }

    const balance = await this.getBalance(this.connectedWallet.accounts[0].address);
    return balance >= requiredAmount;
  }

  // Simulate reward (for demo purposes when wallet is not connected)
  simulateReward(amount) {
    console.log(`🎉 Simulated reward: ${amount} SUI coins`);
    return {
      success: true,
      amount: amount,
      message: `You earned ${amount} SUI coins! (Simulated)`
    };
  }
}

// Task reward configuration
export const TASK_REWARDS = {
  easy: 0.001,      // 0.001 SUI for easy tasks
  medium: 0.002,    // 0.002 SUI for medium tasks
  hard: 0.005       // 0.005 SUI for hard tasks
};

// Get reward amount for task difficulty
export const getTaskReward = (difficulty) => {
  return TASK_REWARDS[difficulty] || TASK_REWARDS.medium;
};

// Format SUI amount for display
export const formatSuiAmount = (amount) => {
  return `${amount} SUI`;
};
