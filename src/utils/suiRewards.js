// SUI Coin Rewards Utility
// This file handles SUI coin rewards for task completion on testnet
// Uses a single treasury address to distribute rewards - NO SIMULATION
import { Transaction } from '@mysten/sui/transactions'

export class SuiRewardManager {
  constructor(suiClient, connectedWallet, options = {}) {
    console.log('🔧 SuiRewardManager Constructor Debug:', {
      suiClient: !!suiClient,
      suiClientType: typeof suiClient,
      connectedWallet: !!connectedWallet,
      connectedWalletName: connectedWallet?.name,
      connectedWalletAccounts: connectedWallet?.accounts?.length || 0,
      firstAccountAddress: connectedWallet?.accounts?.[0]?.address
    });
    
    this.suiClient = suiClient;
    this.connectedWallet = connectedWallet;
    this.signAndExecuteTx = options.signAndExecuteTx;
    this.dappKitAccountAddress = options.dappKitAccountAddress;
    // Treasury address - prefer override if provided
    this.treasuryAddress = options.treasuryAddress || connectedWallet?.accounts?.[0]?.address || null;
    
    console.log('✅ SuiRewardManager created with treasury address:', this.treasuryAddress);
  }

  // Award SUI coins from treasury to user for completing a task
  async awardCoins(recipientAddress, amount) {
    if (!this.treasuryAddress) {
      throw new Error('No treasury address available. Please connect your wallet.');
    }

    if (!this.suiClient || !this.connectedWallet) {
      throw new Error('Sui client or wallet not available. Please ensure wallet is connected.');
    }

    try {
      // Ensure the signing account matches the treasury address
      const signerAddress = (this.connectedWallet?.accounts?.[0]?.address) || this.dappKitAccountAddress
      if (!signerAddress || signerAddress.toLowerCase() !== String(this.treasuryAddress).toLowerCase()) {
        throw new Error('Connected wallet must be the treasury to sign transfers. Please connect the treasury wallet.');
      }
      console.log(`🎉 Attempting to award ${amount} SUI coins from treasury ${this.treasuryAddress} to ${recipientAddress}`);
      
      // Get treasury coins to find available SUI
      const treasuryCoins = await this.suiClient.getCoins({
        owner: this.treasuryAddress,
        coinType: '0x2::sui::SUI'
      });

      if (treasuryCoins.data.length === 0) {
        throw new Error('No SUI coins found in treasury');
      }

      // Find a coin with sufficient balance
      const coinWithBalance = treasuryCoins.data.find(coin => 
        BigInt(coin.balance) >= BigInt(Math.floor(amount * 1000000000)) // Convert to MIST (SUI's smallest unit)
      );

      if (!coinWithBalance) {
        throw new Error('Insufficient SUI balance in treasury');
      }

      // Create transaction to transfer SUI using Transaction (new builder)
      const tx = new Transaction();
      
      // Split coins from treasury and transfer to recipient
      const amountInMist = Math.floor(amount * 1000000000)
      const [coin] = tx.splitCoins(
        tx.object(coinWithBalance.coinObjectId),
        [tx.pure.u64(amountInMist)]
      )
      
      // Transfer the split coin to the recipient
      tx.transferObjects([coin], tx.pure.address(recipientAddress));

      // Execute the transaction via wallet-standard feature
      const account = this.connectedWallet.accounts[0] || { address: this.dappKitAccountAddress }
      if (!account?.address) {
        throw new Error('No wallet account available for signing')
      }
      tx.setSender(account.address)

      const features = this.connectedWallet.features || {}
      const signExecV2 = features['sui:signAndExecuteTransactionBlock']?.signAndExecuteTransactionBlock
      const signExecV1 = features['sui:signAndExecuteTransaction']?.signAndExecuteTransaction
      const signOnly = features['sui:signTransactionBlock']?.signTransactionBlock

      let result
      // Prefer sign-only + execute to avoid missing chain context
      const chain = 'sui:testnet'
      if (typeof signOnly === 'function') {
        const { signature } = await signOnly({
          transactionBlock: tx,
          account,
          chain
        })
        // Execute with client using provided signature
        const bytes = await tx.build({ client: this.suiClient })
        result = await this.suiClient.executeTransactionBlock({
          transactionBlock: bytes,
          signature,
          options: { showEffects: true, showEvents: true }
        })
      } else if (typeof signExecV2 === 'function') {
        const bytes = await tx.build({ client: this.suiClient })
        result = await signExecV2({
          transactionBlock: bytes,
          account,
          chain,
          options: { showEffects: true, showEvents: true }
        })
      } else if (typeof signExecV1 === 'function') {
        const bytes = await tx.build({ client: this.suiClient })
        result = await signExecV1({
          transactionBlock: bytes,
          account,
          chain,
          options: { showEffects: true, showEvents: true }
        })
      } else {
        throw new Error('Wallet does not support Sui sign/execute features')
      }

      console.log('SUI transfer transaction result:', result);

      const reward = {
        success: true,
        amount: amount,
        from: this.treasuryAddress,
        to: recipientAddress,
        message: `Successfully awarded ${amount} SUI coins from treasury!`,
        transactionType: 'treasury_reward',
        transactionDigest: result.digest,
        effects: result.effects
      };

      console.log('Reward details:', reward);
      return reward;
      
    } catch (error) {
      console.error('Error awarding coins from treasury:', error);
      
      // Return error details for better debugging
      return {
        success: false,
        amount: amount,
        from: this.treasuryAddress,
        to: recipientAddress,
        message: `Failed to award SUI coins: ${error.message}`,
        transactionType: 'treasury_reward_failed',
        error: error.message
      };
    }
  }

  // Get treasury SUI balance (your active address balance)
  async getTreasuryBalance() {
    if (!this.treasuryAddress || !this.suiClient) {
      throw new Error('Cannot get treasury balance. Please connect your wallet.');
    }

    try {
      const coins = await this.suiClient.getCoins({
        owner: this.treasuryAddress,
        coinType: '0x2::sui::SUI'
      });

      const totalBalance = coins.data.reduce((sum, coin) => {
        return sum + BigInt(coin.balance);
      }, BigInt(0));

      const balanceInSui = Number(totalBalance) / 1000000000; // Convert from MIST to SUI
      console.log(`Treasury balance: ${balanceInSui} SUI`);
      return balanceInSui;
    } catch (error) {
      console.error('Error getting treasury balance:', error);
      throw new Error(`Failed to get treasury balance: ${error.message}`);
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

      const balanceInSui = Number(totalBalance) / 1000000000; // Convert from MIST to SUI
      return balanceInSui;
    } catch (error) {
      console.error('Error getting user balance:', error);
      throw new Error(`Failed to get user balance: ${error.message}`);
    }
  }

  // Check if treasury has enough SUI for rewards
  async hasEnoughTreasuryBalance(requiredAmount) {
    const treasuryBalance = await this.getTreasuryBalance();
    const hasEnough = treasuryBalance >= requiredAmount;
    
    if (!hasEnough) {
      console.warn(`Treasury has insufficient balance: ${treasuryBalance} SUI, need: ${requiredAmount} SUI`);
    }
    
    return hasEnough;
  }

  // Get treasury address for display
  getTreasuryAddress() {
    return this.treasuryAddress;
  }

  // Check if treasury is available
  isTreasuryAvailable() {
    return !!this.treasuryAddress;
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

// Get treasury info for display
export const getTreasuryInfo = (rewardManager) => {
  if (!rewardManager) return null;
  
  return {
    address: rewardManager.getTreasuryAddress(),
    isAvailable: rewardManager.isTreasuryAvailable(),
    balance: null // Will be populated when getTreasuryBalance is called
  };
};
