# TON Smart Contract & Wallet Checker

This project combines a smart contract written in Tact for the TON blockchain with a TypeScript client application that interacts with the TON API. The solution enables wallet verification, fund distribution, token withdrawal, and task management while integrating with third‐party services such as Telegram for notifications and MongoDB for persistent storage. This is additional part of the main project called **AutoBlumFarm** ([backend](https://github.com/ButterDevelop/BlumBotFarm) and [frontend](https://github.com/ButterDevelop/AutoBlumFarmBot) repos).

---

## Overview

The project consists of two main components:

1. **Smart Contract (Tact) – DistributorContract**  
   A smart contract that distributes funds to a list of recipient wallets. It manages:
   - Unique contract identification.
   - A mapping of recipient addresses.
   - Dynamic recalculation and distribution of funds.
   - Controlled withdrawal of remaining balances with storage rent considerations.
2. **Client Application (TypeScript)**  
   A client script that:
   - Reads wallet data from files.
   - Uses the TON API to check wallet balances and transaction history.
   - Processes withdrawals and wallet activations.
   - Interacts with external APIs (e.g., OKX for withdrawals, Telegram for notifications).
   - Updates and maintains wallet tokens and statuses in a MongoDB database.
   - Supports proxy connections (HTTPS/SOCKS) and implements randomized delays for robust multi-threaded processing.
---

## Features

### Smart Contract (Tact)
- **DistributorContract**  
  - **Initialization:** Sets a unique ID, assigns an owner, and initializes a recipient mapping.
  - **Fund Distribution:** Recalculates the available sum for distribution and sends funds to recipients.
  - **Withdrawal Modes:** Offers functions to withdraw the entire balance or to leave a minimal amount for storage rent.
  - **State Management:** Updates its state after each distribution to ensure funds are allocated correctly.

### Client Application (TypeScript)
- **Wallet Checking & Activation:**  
  - Reads wallet information from files.
  - Validates wallet addresses and monitors transactions using the TON API.
- **Withdrawal Processing:**  
  - Integrates with the OKX API to execute withdrawals.
  - Implements random delays and retry mechanisms to simulate natural processing intervals.
- **Token Management:**  
  - Automatically refreshes access tokens when needed.
  - Updates tokens in a MongoDB database.
- **Proxy & Network Support:**  
  - Supports both HTTPS and SOCKS proxies.
- **Telegram Notifications:**  
  - Sends status updates (e.g., withdrawal and activation results) via Telegram.
- **Logging & Error Handling:**  
  - Provides detailed timestamped logs for operations and errors.

---

## Prerequisites

- **Node.js** (v14 or later)
- **npm** or **yarn** for dependency management
- Access to the TON network (mainnet endpoint)
- MongoDB instance (or connection string) for storing wallet data
- Environment variables (configured via a `.env` file) for:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
  - `API_KEY`, `API_SECRET`, `API_PASS` (for the OKX API)
  - Other credentials as required

For the smart contract component, you will need a Tact compiler and tools to deploy to the TON blockchain.

---

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/ButterDevelop/AutoBlumSmartContract.git
   cd AutoBlumSmartContract
   ```
2. **Install Dependencies:**

   ```bash
   npm install
   ```
3. **Configure Environment Variables:**

Create a `.env` file in the root directory with your credentials. For example:
   ```env
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   API_KEY=your_okx_api_key
   API_SECRET=your_okx_api_secret
   API_PASS=your_okx_api_pass
   ```
## Usage

### Running the Client Application

To start the wallet checking and processing script:

```bash
npm start
```

The client will:
- Read wallet data from `botWallets.txt` and process them.
- Check each wallet's balance and transaction history.
- Perform withdrawals and activate wallets as needed.
- Log the results and send notifications via Telegram.
- Update wallet tokens and statuses in MongoDB.

### Deploying the Smart Contract

1. **Compile the Smart Contract:**
Use your Tact compiler to compile the smart contract source (e.g., `DistributorContract.tact`):

# Project Structure

```bash
ton-smart-wallet-checker/
├── contract/
│   └── DistributorContract.tact  # Tact source code for the smart contract
├── src/
│   └── client.ts                    # Main TypeScript client application
├── tests/                             # Tests for both the smart contract and client
├── botWallets.txt                # File containing wallet information
├── activatedWallets.json    # JSON file for storing activated wallets data
├── randomWallets.txt        # File containing random wallet addresses
├── .env                               # Environment variables (not included; see .env.example)
├── package.json                 # Node.js project configuration
└── README.md                  # This file
```

# Smart Contract Details

The **DistributorContract** is implemented in Tact and uses a simple fund distribution mechanism:

- **Initialization:**
  Sets the contract ID, owner, recipient mapping, and initializes parameters for fund distribution.
- **Receive Handlers:**
    - The default `receive()` updates the total amount available for distribution.
	- Custom messages (e.g., `"g"`, `"wa"`, `"ws"`) trigger specific actions such as distribution or withdrawal.
- **Distribution Logic:**
    The `distribute()` function:
	- Checks if there are sufficient funds.
	- Sends a portion of the funds to a recipient.
	- Updates the mapping and internal counters accordingly.

# Client Application Details

The TypeScript client script performs the following tasks:
- **Wallet Data Handling:**
  Reads wallet information from files and parses the necessary parameters (wallet number, version, address, mnemonic).
- **TON API Interaction:**
Uses libraries such as `@orbs-network/ton-access`, `ton-crypto`, and `@ton/ton` to:
  - Generate keys from mnemonics.
  - Retrieve wallet balances and transaction histories.
  - Send transfers based on generated parameters.
- **External API Calls:**
  Interacts with the OKX API for withdrawals and uses `axios/node-fetch` for HTTP requests.
- **Proxy & Token Refresh:**
  Implements proxy support and handles token refresh operations with retries when authorization fails.
- **Database & Notifications:**
  Uses MongoDB to persist wallet status and sends Telegram notifications on key events.

# Testing

The repository includes unit tests for both the smart contract and the client application. Run the tests with:
```bash
npm test
```

# Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and include tests as necessary.
4. Submit a pull request for review.

# License

This project is licensed under the **MIT License.**

# Contact

For questions, support, or feedback, please reach out to me via GitHub.

---

**Happy Coding on TON!**