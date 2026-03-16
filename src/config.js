require('dotenv').config();

const config = {
  // ─── Telegram ───────────────────────────────
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,

  // ─── Gemini AI ───────────────────────────────
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: 'gemini-2.0-flash',

  // ─── Google Sheets ───────────────────────────
  sheetsId: process.env.GOOGLE_SHEETS_ID,
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || '')
    .replace(/^["']+|["',]+$/g, '')   // strip stray quotes/commas from dotenv
    .replace(/\\n/g, '\n'),

  // ─── Macro Goals ─────────────────────────────
  goals: {
    calories: parseInt(process.env.CALORIE_GOAL) || 2200,
    protein: parseInt(process.env.PROTEIN_GOAL) || 140,
    carbs: parseInt(process.env.CARBS_GOAL) || 250,
    fat: parseInt(process.env.FAT_GOAL) || 70,
  },

  // ─── Timezone ─────────────────────────────────
  timezone: 'Asia/Kolkata',
};

// Validate required keys
const required = ['telegramToken', 'chatId', 'geminiApiKey', 'sheetsId', 'googleServiceAccountEmail', 'googlePrivateKey'];
// DEBUG — remove after fixing
console.log('🔑 Key starts with:', config.googlePrivateKey.slice(0, 40));
console.log('🔑 Key ends with:', config.googlePrivateKey.slice(-40));
console.log('🔑 Key length:', config.googlePrivateKey.length);
console.log('🔑 Has newlines:', config.googlePrivateKey.includes('\n'));
for (const key of required) {
  if (!config[key]) {
    console.error(`❌ Missing required env variable for: ${key}`);
    console.error(`   Please check your .env file. See .env.example for reference.`);
    process.exit(1);
  }
}

module.exports = config;
