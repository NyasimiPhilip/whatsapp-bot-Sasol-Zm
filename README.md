<!--
/*
 * Thanks for downloading this project! If you have any ideas, tweaks, etc...
 * fork the repository and create a Pull Request.
 */
-->

<p align="center">
  <img 
    width="100" 
    height="80%" 
    src=".github/assets/logo.png" 
    alt="WhatsApp BOT"
    title="WhatsApp BOT"
  /></a>
</p>

<h1 align="center">WhatsApp Bot</h1>

<p align="center">
  <strong>A powerful, extensible WhatsApp bot built with TypeScript and modern architecture</strong>
</p>

---

## 📋 Overview

This application is a WhatsApp client that connects to WhatsApp Web using **Puppeteer**, enabling real-time automation and command execution. Built with TypeScript and following modern software architecture principles, it provides a robust and scalable foundation for WhatsApp automation.

### ✨ Key Features

- 🤖 **AI-Powered Conversations** - Intelligent responses using Google Gemini API
- 🔐 **Authentication System** - Secure admin commands with phone number authorization
- 💬 **Natural Language Processing** - Conversational booking workflow for pest control services
- 📝 **Conversation Memory** - Remembers context for 30 minutes (last 10 messages)
- ⏸️ **Pause & Resume** - Stop/start bot responses without killing the process
- 🔄 **Live Session Relink** - Switch to a different WhatsApp number from chat
- 👥 **Runtime Admin Management** - Add, remove, or replace authorized numbers without restarting
- 🛡️ **Error Handling** - Robust error handling with comprehensive logging
- 📊 **Status Monitoring** - Real-time system stats and uptime tracking
- 🎯 **Easy Configuration** - Environment-based setup

---

## 🚀 Available Commands

All commands require **authentication**. Only authorized phone numbers can use these commands.

| Command | Aliases | Description |
|---------|---------|-------------|
| `!check` | `!status`, `!info` | Check bot status and system information |
| `!start` | `!restart`, `!init` | Resume bot after a `!stop`, or confirm running state |
| `!stop` | `!shutdown`, `!halt` | Pause the bot (process stays alive; use `!start` to resume) |
| `!relink` | `!reconnect`, `!newqr` | Log out current session, generate a new QR code to link a different number |
| `!setauth +number` | `!addauth`, `!auth` | Replace, add, or remove authorized admin numbers at runtime |

> **⚠️ Important:** All commands require authentication. Configure `AUTHORIZED_NUMBERS` in your `.env` file.

---

## 📦 Installation

### Prerequisites

- Node.js 16+
- npm or yarn
- A WhatsApp account

### Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd whatsapp-bot

# Install dependencies
npm install --legacy-peer-deps

# Configure environment variables
cp .env.example .env
# Edit .env and fill in your credentials

# Start the bot
npm run dev
```

### First Run

1. When you start the bot for the first time, a QR code will appear in your terminal
2. Open WhatsApp on your phone
3. Go to **Settings** → **Linked Devices** → **Link a Device**
4. Scan the QR code displayed in your terminal
5. Wait for the authentication to complete

✅ Your bot is now connected and ready to receive commands!

---

## 🏗️ Architecture

This project follows a **clean, interface-based architecture** that makes it easy to maintain and extend.

### Project Structure

```
src/
├── app/
│   ├── commands/                  # Command implementations
│   │   ├── CheckCommand.ts        # Bot status and info
│   │   ├── StartCommand.ts        # Resume bot / confirm running state
│   │   ├── StopCommand.ts         # Pause bot (keeps process alive)
│   │   ├── RelinkCommand.ts       # Unlink session, generate new QR code
│   │   ├── SetAuthCommand.ts      # Manage authorized numbers at runtime
│   │   └── index.ts               # Command registration & message handler
│   ├── interfaces/                # TypeScript interfaces
│   │   └── ICommand.ts            # Base command interface
│   └── utils/                     # Utility classes
│       ├── AuthService.ts         # Authentication & number management
│       ├── BaseCommand.ts         # Abstract base class for commands
│       ├── BotState.ts            # Shared pause/resume state
│       └── CommandDispatcher.ts   # Command routing
├── config/
│   └── faq.json                   # Company info, pricing, FAQ data
├── data/                          # WhatsApp session data (auto-generated)
├── services/
│   ├── ai.ts                      # Google Gemini AI integration
│   └── whatsapp.ts                # WhatsApp client setup
└── index.ts                       # Application entry point
```

### Command System

The bot uses a **secure, authenticated command pattern** with the following features:

- 🔐 **Authentication System** - Phone number-based access control, normalized for `@c.us` and `@lid` (multi-device) formats
- ⏸️ **Pause/Resume** - `!stop` pauses message handling while keeping the WhatsApp connection alive so `!start` can resume from chat
- 🔄 **Session Relink** - `!relink` logs out the current number, triggers a new QR code saved as `qr.png`, and reinitializes the client
- 👥 **Live Auth Management** - `!setauth` updates `.env` on disk and reloads in memory with no restart
- 🤖 **AI-Powered Responses** - Google Gemini for natural conversations
- 💭 **Conversation Memory** - 30-minute context window (last 10 messages per chat)
- ✅ **Interface-based design** - All commands implement `ICommand`
- ✅ **Base class with helpers** - `BaseCommand` provides `sendTyping()` and common structure
- ✅ **Automatic registration** - Commands registered at startup
- ✅ **Alias support** - Multiple trigger names per command
- 📝 **Type safety** - Full TypeScript support

**📚 [View Technical Documentation](./docs/ARCHITECTURE.md)** for detailed architecture information.

---

## 🔧 Adding New Authenticated Commands

All commands in this bot require authentication for security. Here's how to create a new admin command:

### 1. Create Command File

```typescript
// src/app/commands/MyCommand.ts
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';
import type { Message } from 'whatsapp-web.js';

export class MyCommand extends BaseCommand {
  name = 'mycommand';
  description = 'Description of your command (Admin only)';
  aliases = ['mycmd', 'mc'];
  
  async execute(message: Message, args: string[]): Promise<Message | void> {
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) return authService.sendUnauthorizedMessage(message);
    
    await this.sendTyping(message);
    
    // Your command logic here
    return message.reply('✅ Command executed successfully!');
  }
}
```

### 2. Register Command

```typescript
// src/app/commands/index.ts
import { MyCommand } from './MyCommand';

export const initializeCommands = (): void => {
  commandDispatcher.register(new StartCommand());
  commandDispatcher.register(new StopCommand());
  commandDispatcher.register(new CheckCommand());
  commandDispatcher.register(new RelinkCommand());
  commandDispatcher.register(new SetAuthCommand());
  commandDispatcher.register(new MyCommand()); // Add your command
};
```

**That's it!** Your command is now available to authorized users: `!mycommand`, `!mycmd`, `!mc`

---

## 🛠️ Configuration

### Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```env
# Google Gemini API Key
# Get yours free at: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Authorized Phone Numbers (comma-separated, international format)
# Any country code is supported — always include + prefix
# Only these numbers can use admin commands
AUTHORIZED_NUMBERS=+12345678901,+447911123456
```

### 🔐 Authentication Setup

1. **Get your WhatsApp phone number** (including country code with `+` prefix)

2. **Add to `.env` file**
   ```env
   AUTHORIZED_NUMBERS=+12345678901
   ```

3. **Multiple admins** (separate with commas, any country codes)
   ```env
   AUTHORIZED_NUMBERS=+12345678901,+447911123456,+61412345678
   ```

> **⚠️ Security Note:** Keep your `.env` file private and never commit it to version control!

---

## 📖 Usage Examples

### Check Bot Status
```
Admin: !check
Bot: 🤖 Bot Status Report

━━━━━━━━━━━━━━━━━━━━

📱 WhatsApp Connection
   Status: ✅ Connected
   Phone: 12345678901
   Platform: android

⏱️ System Information
   Uptime: 2h 15m 33s
   Memory: 145.23MB / 256.00MB
   Node: v18.17.0

🔐 Security
   Auth Mode: Enabled
   Authorized Users: 2

━━━━━━━━━━━━━━━━━━━━
Last checked: 2026-03-08 14:30:00
```

### Pause the Bot
```
Admin: !stop
Bot: ⏸️ Bot Paused

━━━━━━━━━━━━━━━━━━━━

🛑 The bot will stop responding to messages

📊 Final Status:
   Uptime: 7823s
   Time: 2026-03-08 14:35:00

━━━━━━━━━━━━━━━━━━━━
💡 Send !start to resume the bot at any time.
```

> The process and WhatsApp connection remain alive. Admin commands still work while paused.

### Resume the Bot
```
Admin: !start
Bot: 🚀 Bot Start Command

━━━━━━━━━━━━━━━━━━━━

✅ Bot has been resumed

📊 Current Status:
   Connection: Active
   Services: Operational

💡 Use !check for detailed status
━━━━━━━━━━━━━━━━━━━━
Bot is now responding to messages
```

### Switch to a Different WhatsApp Number
```
Admin: !relink
Bot: 🔄 Relink Initiated

━━━━━━━━━━━━━━━━━━━━

⏳ Logging out the current session...

📸 A QR code will be saved to qr.png in the bot folder
   and printed in the terminal.

━━━━━━━━━━━━━━━━━━━━
Scan with your new WhatsApp number, then use !setauth +number
```
Then open `qr.png` (or check the terminal) and scan with the new phone.

### Update Authorized Numbers at Runtime
```
# Replace all admins with one number
Admin: !setauth +12345678901

# Add an extra admin (keep existing)
Admin: !setauth add +447911123456

# Remove an admin
Admin: !setauth remove +447911123456
```
Changes take effect immediately — writes to `.env` and reloads in memory, no restart needed.

### Unauthorized Access
```
Unknown User: !check
Bot: 🚫 Unauthorized Access

You do not have permission to use this command.
```

### Natural Conversation (No Command Prefix)
```
Customer: Hello
Bot: Thank you for contacting Sanok Nationalwide Fumigators. How may we assist you today?

Customer: How much for cockroach?
Bot: How many bedrooms does your house have?

Customer: 2 bedrooms
Bot: Cockroach fumigation for a 2-bedroom house is R1,000. Would you like to book our services?

Customer: Yes
Bot: Great! Please share your location (address or location pin) and your preferred day and time.
```

---

## 🧪 Testing

```bash
# Run linter
npm run lint

# Run in development mode with auto-reload
npm run dev
```

### Manual Testing Checklist

**Admin Commands (Requires Authorization):**
- [ ] `!check` / `!status` / `!info` — Returns bot status and system information
- [ ] `!stop` / `!shutdown` / `!halt` — Pauses bot; process stays alive
- [ ] `!start` / `!restart` / `!init` — Resumes paused bot, or confirms already running
- [ ] `!relink` / `!reconnect` / `!newqr` — Logs out, saves `qr.png`, reinitializes
- [ ] `!setauth +number` — Replaces all authorized numbers
- [ ] `!setauth add +number` — Adds an authorized number
- [ ] `!setauth remove +number` — Removes an authorized number
- [ ] Unauthorized user tries any command — Returns access denied message

**AI Conversations (No Authorization Required):**
- [ ] Greeting (Hello/Hi/Hey) — Returns Sanok Nationalwide Fumigators welcome message
- [ ] Pricing inquiry — AI asks follow-up questions (pest type, house size)
- [ ] Booking flow — AI guides through booking process
- [ ] Conversation memory — AI remembers context from previous messages (30 min window)
- [ ] Bot paused (`!stop`) — Customer messages are silently ignored
- [ ] Bot resumed (`!start`) — Customer messages are handled again

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Extend `BaseCommand` for new commands
- Add proper error handling
- Test your changes thoroughly

---

## 📝 License

This project is licensed under the [GNU AGPL License](./LICENSE).

---


---

## 📋 Overview

This application is a WhatsApp client that connects to WhatsApp Web using **Puppeteer**, enabling real-time automation and command execution. Built with TypeScript and following modern software architecture principles, it provides a robust and scalable foundation for WhatsApp automation.

### ✨ Key Features

- 🤖 **AI-Powered Conversations** - Intelligent responses using Google Gemini API
- 🔐 **Authentication System** - Secure admin commands with phone number authorization
- 💬 **Natural Language Processing** - Conversational booking workflow for pest control services
- 📝 **Conversation Memory** - Remembers context for 30 minutes (last 10 messages)
- 🔄 **Admin Controls** - Start, stop, and monitor bot remotely
- 🛡️ **Error Handling** - Robust error handling with comprehensive logging
- 📊 **Status Monitoring** - Real-time system stats and uptime tracking
- 🎯 **Easy Configuration** - Environment-based setup

---

## 🚀 Available Commands

All commands require **authentication**. Only authorized phone numbers can use these commands.

| Command | Aliases | Description |
|---------|---------|-------------|
| `!check` | `!status`, `!info` | Check bot status and system information (Admin only) |
| `!start` | `!restart`, `!init` | Start or restart bot services (Admin only) |
| `!stop` | `!shutdown`, `!halt` | Gracefully stop the bot (Admin only) |

> **⚠️ Important:** All commands require authentication. Configure `AUTHORIZED_NUMBERS` in `.env` file.

---

## 📦 Installation

### Prerequisites

- Node.js 16+ 
- npm or yarn
- WhatsApp account

### Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd whatsapp-bot

# Install dependencies
npm install --legacy-peer-deps
# or
yarn install

# Configure environment variables
cp .env.example .env
# Edit .env and add your API credentials

# Start the bot
npm run dev
# or
yarn dev
```

### First Run

1. When you start the bot for the first time, a QR code will appear in your terminal
2. Open WhatsApp on your phone
3. Go to **Settings** → **Linked Devices** → **Link a Device**
4. Scan the QR code displayed in your terminal
5. Wait for the authentication to complete

✅ Your bot is now connected and ready to receive commands!

---

## 🏗️ Architecture

This project follows a **clean, interface-based architecture** that makes it easy to maintain and extend.

### Project Structure

```
src/
├── app/
│   ├── commands/              # Command implementations
│   │   ├── CheckCommand.ts    # Bot status and info (auth required)
│   │   ├── StartCommand.ts    # Start/restart bot (auth required)
│   │   ├── StopCommand.ts     # Shutdown bot (auth required)
│   │   └── index.ts           # Command registration & message handler
│   ├── interfaces/            # TypeScript interfaces
│   │   └── ICommand.ts        # Base command interface
│   └── utils/                 # Utility classes
│       ├── AuthService.ts     # Authentication system
│       ├── BaseCommand.ts     # Abstract base class for commands
│       └── CommandDispatcher.ts
├── config/                    # Configuration files
│   └── faq.json              # FAQ data and pricing structure
├── data/                      # WhatsApp session data
├── services/                  # External services
│   ├── ai.ts                 # Google Gemini AI integration
│   └── whatsapp.ts           # WhatsApp client setup
└── index.ts                  # Application entry point
```

### Command System

The bot uses a **secure, authenticated command pattern** with the following features:

- 🔐 **Authentication System** - Phone number-based access control
- 🤖 **AI-Powered Responses** - Google Gemini for natural conversations
- 💭 **Conversation Memory** - 30-minute context window (last 10 messages)
- ✅ **Interface-based design** - All commands implement `ICommand`
- ✅ **Base class with helpers** - `BaseCommand` provides common functionality
- ✅ **Automatic registration** - Commands registered at startup
- ✅ **Alias support** - Multiple names for the same command
- 🛡️ **Centralized auth** - `AuthService` handles all authorization
- 📝 **Type safety** - Full TypeScript support

**📚 [View Technical Documentation](./docs/ARCHITECTURE.md)** for detailed architecture information.

---

## 🔧 Adding New Authenticated Commands

All commands in this bot require authentication for security. Here's how to create a new admin command:

### 1. Create Command File

```typescript
// src/app/commands/MyCommand.ts
import { BaseCommand } from '../utils/BaseCommand';
import { authService } from '../utils/AuthService';
import type { Message } from 'whatsapp-web.js';

export class MyCommand extends BaseCommand {
  name = 'mycommand';
  description = 'Description of your command (Admin only)';
  aliases = ['mycmd', 'mc'];
  
  async execute(message: Message, args: string[]): Promise<Message | void> {
    // Check authorization first
    const isAuthorized = await authService.isAuthorized(message);
    if (!isAuthorized) {
      return authService.sendUnauthorizedMessage(message);
    }
    
    await this.sendTyping(message);
    
    // Your command logic here
    return message.reply('✅ Command executed successfully!');
  }
}
```

### 2. Register Command

```typescript
// src/app/commands/index.ts
import { MyCommand } from './MyCommand';

export const initializeCommands = (): void => {
  commandDispatcher.register(new StartCommand());
  commandDispatcher.register(new StopCommand());
  commandDispatcher.register(new CheckCommand());
  commandDispatcher.register(new MyCommand()); // Add your command
};
```

**That's it!** Your command is now available to authorized users: `!mycommand`, `!mycmd`, `!mc`

---

## 🛠️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Google Gemini API Key (FREE!)
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Authorized Phone Numbers (comma-separated, with country code)
# Format: +27123456789,+27987654321
# Only these numbers can use admin commands: !start, !stop, !check
AUTHORIZED_NUMBERS=+27123456789,+27987654321
```

### 🔐 Authentication Setup

1. **Get your WhatsApp phone number** (including country code)
   - Example: `+27123456789` for South African number
   - Example: `+1234567890` for US number

2. **Add to `.env` file**
   ```env
   AUTHORIZED_NUMBERS=+27123456789
   ```

3. **Multiple admins** (separate with commas)
   ```env
   AUTHORIZED_NUMBERS=+27123456789,+27987654321,+27111222333
   ```

> **⚠️ Security Note:** Keep your `.env` file private and never commit it to version control!

---

## 📖 Usage Examples

### Check Bot Status
```
Admin: !check
Bot: 🤖 Bot Status Report

━━━━━━━━━━━━━━━━━━━━

📱 WhatsApp Connection
   Status: ✅ Connected
   Phone: 27123456789
   Platform: android

⏱️ System Information
   Uptime: 2h 15m 33s
   Memory: 145.23MB / 256.00MB
   Node: v18.17.0

🔐 Security
   Auth Mode: Enabled
   Authorized Users: 2

━━━━━━━━━━━━━━━━━━━━
Last checked: 2026-03-06 14:30:00
```

### Start/Restart Bot
```
Admin: !start
Bot: 🚀 Bot Start Command

━━━━━━━━━━━━━━━━━━━━

✅ Bot is already running

📊 Current Status:
   Connection: Active
   State: CONNECTED
   Services: Operational

💡 Use `!check` for detailed status
━━━━━━━━━━━━━━━━━━━━
No action needed - already running
```

### Stop Bot
```
Admin: !stop
Bot: ⚠️ Bot Shutdown Initiated

━━━━━━━━━━━━━━━━━━━━

🛑 The bot will shut down in 5 seconds

📊 Final Status:
   Uptime: 7823s
   Time: 2026-03-06 14:35:00

━━━━━━━━━━━━━━━━━━━━
👋 Goodbye!
```

### Unauthorized Access
```
Unauthorized User: !check
Bot: 🚫 Unauthorized Access

You do not have permission to use this command.
```

### Natural Conversation (No Command Prefix)
```
Customer: Hello
Bot: Thank you for contacting Sanok Nationalwide Fumigators. How may we assist you today?

Customer: How much for cockroach?
Bot: How many bedrooms does your house have?

Customer: 2 bedrooms
Bot: Cockroach fumigation for a 2-bedroom house is R1,000. Would you like to book our services?

Customer: Yes
Bot: Great! Please share your location (address or location pin) and your preferred day and time.
```

---

## 🧪 Testing

```bash
# Run linter
npm run lint

# Run in development mode with auto-reload
npm run dev
```

### Manual Testing Checklist

**Admin Commands (Requires Authorization):**
- [ ] `!check` / `!status` / `!info` - Returns bot status and system information
- [ ] `!start` / `!restart` / `!init` - Confirms bot is running or attempts reconnection
- [ ] `!stop` / `!shutdown` / `!halt` - Gracefully shuts down the bot
- [ ] Unauthorized user tries `!check` - Returns access denied message

**AI Conversations (No Authorization Required):**
- [ ] Greeting (Hello/Hi/Hey) - Returns Sanok Nationalwide Fumigators welcome message
- [ ] Pricing inquiry - AI asks follow-up questions (pest type, house size)
- [ ] Booking flow - AI guides through 6-step booking process
- [ ] Conversation memory - AI remembers context from previous messages (30 min window)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Extend `BaseCommand` for new commands
- Add proper error handling
- Include JSDoc comments
- Test your changes thoroughly

---

## 📝 License

This project is licensed under the [GNU AGPL License](./LICENSE).

---
