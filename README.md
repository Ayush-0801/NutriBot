# 🤖 NutriBot — AI-Powered Indian Diet Calorie Tracker

A personal Telegram bot that tracks your daily calories and macros using natural language. Powered by **Groq Llama 3.1** for AI meal parsing and **Google Sheets** for persistent storage.

> Just type `2 roti + dal makhani 1 katori` and NutriBot handles the rest.

---

## ✨ Features

- **Natural language meal logging** — no dropdowns, no structured forms
- **Indian food optimized** — knows roti, dal, paneer, poha, dosa, chai, and more
- **Instant macro breakdown** — calories, protein, carbs, fat, fiber per meal
- **Running daily totals** — see progress after every meal
- **7 bot commands** — `/today`, `/meals`, `/week`, `/goals`, `/setgoal`, `/undo`, `/help`
- **Smart reminders** — breakfast, lunch, snack, dinner nudges (skipped if you already logged)
- **Automated 9 PM daily report** — progress bars + goal tracking
- **Google Sheets storage** — all data in your own spreadsheet
- **₹0 monthly cost** — entirely on free tiers

---

## 🚀 Quick Setup

### 1. Prerequisites

| Service | What to do |
|---------|-----------|
| **Telegram** | Message [@BotFather](https://t.me/BotFather) → `/newbot` → save the token |
| **Groq** | Create free account at [console.groq.com](https://console.groq.com) → copy API key |
| **Google Sheets** | Create a spreadsheet named `CalorieTracker` with two tabs: `Logs` and `Daily Summary` |
| **Google Cloud** | New project → enable Sheets API + Drive API → create Service Account → download JSON key → share the spreadsheet with the service account email |

### 2. Install

```bash
cd DietCalorieTracker
npm install
```

### 3. Configure

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_personal_chat_id
GROQ_API_KEY=your_groq_api_key
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Tip:** To find your `TELEGRAM_CHAT_ID`, message [@userinfobot](https://t.me/userinfobot) on Telegram.

### 4. Run

```bash
node index.js
```

---

## 📱 Commands

| Command | Description |
|---------|-------------|
| *(any text)* | Log a meal — AI parses it automatically |
| `/today` | Today's macro summary with progress bars |
| `/meals` | List all meals logged today |
| `/week` | 7-day summary with averages |
| `/goals` | View current macro goals |
| `/setgoal protein 150` | Update a specific goal |
| `/undo` | Delete the last logged meal |
| `/help` | Show all commands |

---

## ⏰ Automated Reminders

| Time (IST) | Reminder |
|-----------|----------|
| 8:00 AM | Breakfast nudge + yesterday's protein |
| 1:00 PM | Lunch check-in + morning total |
| 5:00 PM | Snack reminder + remaining macros |
| 8:30 PM | Dinner reminder + calories to goal |
| 9:00 PM | **Daily macro report** (always sent) |

Meal reminders are **skipped** if you logged something in the last 2 hours.

---

## 🚢 Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect repo on [Railway](https://railway.app)
3. Set environment variables in the dashboard
4. Deploy — the `Procfile` handles the rest

### PM2 (VPS / local)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 📊 Data Model (Google Sheets)

### Logs Sheet
| Column | Content |
|--------|---------|
| A | Date (DD/MM/YYYY) |
| B | Time (HH:MM) |
| C | Meal Description |
| D | Raw Input |
| E | Calories |
| F | Protein (g) |
| G | Carbs (g) |
| H | Fat (g) |
| I | Fiber (g) |

### Daily Summary Sheet
| Column | Content |
|--------|---------|
| A | Date |
| B–F | Total macros |
| G | Meals count |
| H–I | Goal met (boolean) |

---

## 🛠 Tech Stack

- **Node.js** — runtime
- **node-telegram-bot-api** — Telegram integration
- **groq-sdk** — Groq Llama 3.1 70B AI parsing
- **googleapis** — Google Sheets read/write
- **node-cron** — scheduled reminders
- **dotenv** — environment configuration

---

## 📁 Project Structure

```
DietCalorieTracker/
├── index.js              # Entry point
├── src/
│   ├── config.js         # Environment & goals
│   ├── groq.js           # AI meal parsing
│   ├── sheets.js         # Google Sheets CRUD
│   ├── bot.js            # Telegram bot + commands
│   ├── formatter.js      # Message formatting
│   └── reminders.js      # Cron-based reminders
├── .env.example          # Environment template
├── ecosystem.config.js   # PM2 config
├── Procfile              # Railway config
└── package.json
```

---
