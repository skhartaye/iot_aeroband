# Sui Wallet Integration for Aeroband IoT App

This document explains how to set up and use the Sui wallet integration in your Air Quality Dashboard.

## 🚀 Features

✅ **Sui Wallet Connection** - Connect your Sui wallet (testnet/mainnet)
✅ **User-Specific Data** - Each wallet gets personalized air quality data
✅ **Local Storage** - Data persists across sessions
✅ **Location Preferences** - Save your default location
✅ **Favorite Stations** - Bookmark air quality monitoring stations
✅ **Data Export** - Export your personal data as JSON

## 🔧 Setup

### 1. Install Dependencies
```bash
npm install @mysten/sui @mysten/dapp-kit
```

### 2. Configure Your Sui Wallet
Make sure you have a Sui wallet installed (e.g., Sui Wallet, Ethos Wallet, or SuiFrens).

For development, you can use the Sui CLI:
```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch devnet sui

# Create a new wallet
sui client new-address

# Switch to testnet
sui client switch --env testnet

# Get testnet SUI tokens
sui client faucet
```

### 3. Environment Configuration
The app is configured to use Sui testnet by default. You can modify `src/config/sui.js` to change networks.

## 💡 How to Use

### Connecting Your Wallet
1. Click the **"Connect Wallet"** button in the top-right corner
2. Select your preferred Sui wallet
3. Approve the connection
4. Your wallet address and SUI balance will be displayed

### Managing Your Data
1. **Show Profile**: Click the green "Show Profile" button after connecting
2. **Save Location**: Your current location is automatically saved when you connect
3. **Save Stations**: Click "💾 Save to Favorites" on any air quality station
4. **Export Data**: Use the "📤 Export Data" button to download your data

### User Preferences
- **Notifications**: Toggle notification settings
- **Theme**: Switch between light and dark themes
- **Default Location**: Automatically saved from your current location

## 🔐 Data Privacy

- **Local Storage**: All user data is stored locally in your browser
- **No Server Storage**: Your personal data never leaves your device
- **Wallet-Based**: Data is tied to your Sui wallet address
- **Exportable**: You can export and backup your data anytime

## 🌐 Supported Networks

- **Testnet**: `https://fullnode.testnet.sui.io:443` (Default)
- **Mainnet**: `https://fullnode.mainnet.sui.io:443`
- **Devnet**: `https://fullnode.devnet.sui.io:443`

## 🛠️ Technical Details

### Components
- `SuiWalletConnect.jsx` - Handles wallet connection and user data
- `UserDataManager.jsx` - Manages user preferences and saved data
- `Maps.jsx` - Main dashboard with wallet integration

### Data Structure
```json
{
  "address": "0x...",
  "balance": {
    "sui": 1.2345,
    "mist": "1234500000"
  },
  "preferences": {
    "defaultLocation": {...},
    "notifications": true,
    "theme": "light"
  },
  "airQualityData": [...],
  "lastSync": "2025-01-16T..."
}
```

### Local Storage Keys
- `user_{wallet_address}` - Complete user data for each wallet

## 🚨 Troubleshooting

### Wallet Not Connecting
- Ensure you have a Sui wallet installed
- Check if you're on the correct network (testnet/mainnet)
- Try refreshing the page and reconnecting

### Build Errors
- Make sure all dependencies are installed: `npm install`
- Check import paths in components
- Verify Sui package versions are compatible

### Data Not Saving
- Check browser console for errors
- Ensure localStorage is enabled
- Verify wallet connection is active

## 🔮 Future Enhancements

- **On-Chain Storage**: Store user data on Sui blockchain
- **NFT Integration**: Mint air quality data as NFTs
- **DeFi Features**: Stake SUI for premium features
- **Cross-Chain**: Support for other blockchain networks

## 📚 Resources

- [Sui Documentation](https://docs.sui.io/)
- [Sui Wallet](https://chrome.google.com/webstore/detail/sui-wallet/ppcgigncehehbfbmdlhgipmeflojlflm)
- [Sui CLI](https://docs.sui.io/build/install)
- [Sui Testnet Faucet](https://discord.gg/sui)

## 🤝 Contributing

Feel free to contribute to improve the Sui wallet integration:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

---

**Happy Building! 🚀**
