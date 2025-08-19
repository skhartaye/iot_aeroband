# Sui Wallet Connection Guide

## Overview

This guide explains how to use the enhanced Sui wallet connection features in the Aeroband IoT app. The wallet connection is now fully functional and provides a robust, user-friendly experience for connecting to Sui blockchain wallets.

## Features

### 🔗 Real Wallet Connection
- **Authentic Sui Wallet Integration**: Uses official `@mysten/dapp-kit` for secure wallet connections
- **Multiple Wallet Support**: Compatible with Sui Wallet, Sui Wallet Extension, and other wallet-standard compliant wallets
- **Network Flexibility**: Support for Testnet, Mainnet, and Devnet networks

### 🛡️ Enhanced Security
- **Error Boundaries**: Comprehensive error handling with user-friendly error messages
- **Transaction Validation**: Secure transaction signing with proper validation
- **Network Verification**: Automatic network detection and validation

### 📱 User Experience
- **Real-time Balance Updates**: Automatic balance refresh every 30 seconds
- **Transaction History**: View recent blockchain transactions
- **Persistent Data**: User preferences and data saved locally
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

### 1. Install Required Dependencies

The following packages are already included in your project:

```json
{
  "@mysten/dapp-kit": "^0.17.3",
  "@mysten/sui": "^1.37.2",
  "@mysten/wallet-standard": "^0.16.10"
}
```

### 2. Wallet Setup

#### For Users:
1. **Install a Sui Wallet**: 
   - [Sui Wallet Extension](https://chrome.google.com/webstore/detail/sui-wallet/ppcgmplpbalhbgcgmldaaaafpelfmlej) (Chrome/Brave)
   - [Sui Wallet Mobile](https://suiwallet.com/) (iOS/Android)

2. **Create or Import Wallet**:
   - Create a new wallet or import existing one
   - Ensure you have some SUI tokens (use testnet faucet for testing)

3. **Switch to Testnet** (for testing):
   - Open your wallet
   - Switch network to "Testnet"
   - Get test SUI from the faucet

#### For Developers:
1. **Testnet Faucet**: Visit [Sui Testnet Faucet](https://discord.gg/sui) to get test SUI
2. **Network Configuration**: The app defaults to testnet for safe testing

### 3. Connecting Your Wallet

1. **Navigate to Wallet Page**: Click the "Wallet" button in the navigation
2. **Click Connect**: Use the "Connect Wallet" button
3. **Select Wallet**: Choose your preferred wallet from the list
4. **Approve Connection**: Approve the connection in your wallet
5. **Verify Connection**: Check that your address and balance are displayed

## Available Features

### 🔄 Network Switching
- **Testnet**: Safe environment for testing transactions
- **Mainnet**: Production environment (use real SUI)
- **Devnet**: Development environment for developers

### 🧪 Test Transactions
- **Testnet Only**: Test transactions are only available on testnet
- **Safe Testing**: Uses `mint_for_testing` function (no real value)
- **Transaction History**: View all signed transactions

### 💰 Balance Management
- **Real-time Updates**: Balance refreshes automatically
- **Multiple Units**: Displayed in both SUI and MIST
- **Transaction Tracking**: Monitor balance changes

### 👤 User Profile
- **Persistent Data**: Save preferences and settings
- **Cross-device Sync**: Data stored locally for privacy
- **Customizable**: Set favorite locations and notification preferences

## Technical Implementation

### Custom Hook: `useSuiWallet`

The app uses a custom React hook that provides:

```javascript
const {
  // State
  userData,           // User information and preferences
  loading,            // Connection status
  error,              // Error messages
  network,            // Current network
  isSigning,          // Transaction signing status
  transactionHistory, // Recent transactions
  balance,            // Current balance
  isConnected,        // Connection status
  
  // Actions
  connectWallet,      // Connect to wallet
  disconnectWallet,   // Disconnect wallet
  switchNetwork,      // Change network
  signTestTransaction, // Sign test transaction
  refreshBalance,     // Update balance
  saveUserData,       // Save user preferences
  
  // Utilities
  fetchUserData       // Fetch user data
} = useSuiWallet()
```

### Error Handling

The app includes comprehensive error handling:

- **Connection Errors**: Network issues, wallet not found
- **Transaction Errors**: Insufficient balance, network problems
- **User Feedback**: Clear error messages with resolution steps
- **Error Boundaries**: Graceful fallbacks for critical errors

### Data Persistence

- **Local Storage**: User preferences saved locally
- **Secure Storage**: No sensitive data stored in plain text
- **Data Recovery**: Automatic data restoration on reconnection

## Troubleshooting

### Common Issues

#### 1. Wallet Not Detected
**Problem**: No wallets appear in the connection list
**Solution**: 
- Ensure wallet extension is installed and enabled
- Refresh the page
- Check if wallet supports wallet-standard protocol

#### 2. Connection Fails
**Problem**: Wallet connects but shows error
**Solution**:
- Check network connection
- Verify wallet has sufficient balance
- Try switching networks

#### 3. Transaction Fails
**Problem**: Test transaction doesn't complete
**Solution**:
- Ensure you're on testnet
- Check wallet has test SUI
- Verify transaction approval in wallet

#### 4. Balance Not Updating
**Problem**: Balance shows old values
**Solution**:
- Wait for automatic refresh (30 seconds)
- Manually refresh the page
- Check network status

### Debug Information

Enable debug mode in browser console:

```javascript
// View wallet connection status
console.log('Wallet Status:', window.suiWallet)

// Check network configuration
console.log('Network Config:', networkConfig)

// View transaction history
console.log('Transactions:', transactionHistory)
```

## Security Considerations

### Best Practices

1. **Never Share Private Keys**: Private keys should never be shared or stored in the app
2. **Use Testnet for Testing**: Always test on testnet before mainnet
3. **Verify Transactions**: Always review transaction details before signing
4. **Keep Wallet Updated**: Use the latest version of your wallet
5. **Secure Environment**: Only connect wallets on trusted devices

### Privacy Features

- **Local Storage**: Data stored locally, not sent to external servers
- **Minimal Data Collection**: Only essential wallet information is accessed
- **User Control**: Users can disconnect and clear data at any time

## Network Information

### Testnet
- **RPC Endpoint**: `https://fullnode.testnet.sui.io:443`
- **Faucet**: Available via Discord
- **Purpose**: Testing and development

### Mainnet
- **RPC Endpoint**: `https://fullnode.mainnet.sui.io:443`
- **Faucet**: Not available (use real SUI)
- **Purpose**: Production use

### Devnet
- **RPC Endpoint**: `https://fullnode.devnet.sui.io:443`
- **Faucet**: Available for developers
- **Purpose**: Development and testing

## Future Enhancements

### Planned Features

1. **Multi-wallet Support**: Connect multiple wallets simultaneously
2. **Advanced Transactions**: Support for complex Move calls
3. **NFT Integration**: Display and manage Sui NFTs
4. **DeFi Features**: Integration with Sui DeFi protocols
5. **Mobile Optimization**: Enhanced mobile wallet experience

### API Integration

The wallet connection is designed to integrate with:

- **Air Quality Data**: Store sensor data on blockchain
- **User Preferences**: Save settings and favorites
- **Location Data**: Store favorite monitoring stations
- **Notification System**: Blockchain-based alerts

## Support

### Getting Help

1. **Documentation**: Check this guide and code comments
2. **Console Logs**: Enable browser console for debug information
3. **Network Status**: Verify Sui network status
4. **Community**: Join Sui Discord for wallet support

### Reporting Issues

When reporting issues, include:

- **Wallet Type**: Which wallet you're using
- **Network**: Testnet/Mainnet/Devnet
- **Error Message**: Exact error text
- **Steps to Reproduce**: How to trigger the issue
- **Browser/OS**: Your system information

## Conclusion

The enhanced wallet connection provides a robust, secure, and user-friendly way to integrate Sui blockchain functionality into the Aeroband IoT app. With comprehensive error handling, real-time updates, and extensive customization options, users can confidently connect their wallets and explore blockchain features.

For developers, the modular architecture and custom hooks make it easy to extend functionality and integrate additional blockchain features as needed.
