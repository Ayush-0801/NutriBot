/**
 * NutriBot — AI-Powered Indian Diet Calorie Tracker
 * Entry point: loads config, starts Telegram bot, initializes reminders.
 */

// Load environment variables first
require('dotenv').config();

console.log('🤖 NutriBot starting...');
console.log(`📅 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);

// Import modules (config validates env vars on load)
const bot = require('./src/bot');
const { initReminders } = require('./src/reminders');

// Start scheduled reminders
initReminders(bot);

console.log('─────────────────────');
console.log('✅ NutriBot is live! Send a meal to start tracking.');
console.log('─────────────────────');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 NutriBot shutting down...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 NutriBot shutting down...');
  bot.stopPolling();
  process.exit(0);
});
