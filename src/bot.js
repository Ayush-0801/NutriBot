const TelegramBot = require('node-telegram-bot-api');
const config = require('./config');
const { parseMeal } = require('./groq');
const sheets = require('./sheets');
const fmt = require('./formatter');

const bot = new TelegramBot(config.telegramToken, { polling: true });

// ─── Auth Guard ─────────────────────────────
function isAuthorized(chatId) {
  return String(chatId) === String(config.chatId);
}

// ─── Command Handlers ───────────────────────

// /today or /report — full macro report
bot.onText(/\/(today|report)/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  try {
    const logs = await sheets.getTodayLogs();
    const totals = sheets.aggregateTotals(logs);
    const report = fmt.formatDailyReport(totals, config.goals);
    await bot.sendMessage(msg.chat.id, report, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ /today error:', err.message);
    await bot.sendMessage(msg.chat.id, '⚠️ Error fetching today\'s data. Please try again.');
  }
});

// /meals — list all today's meals
bot.onText(/\/meals/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  try {
    const logs = await sheets.getTodayLogs();
    const reply = fmt.formatMealsList(logs);
    await bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ /meals error:', err.message);
    await bot.sendMessage(msg.chat.id, '⚠️ Error fetching meals. Please try again.');
  }
});

// /week — 7 day summary
bot.onText(/\/week/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  try {
    const weekLogs = await sheets.getWeekLogs();
    const reply = fmt.formatWeekSummary(weekLogs, config.goals);
    await bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ /week error:', err.message);
    await bot.sendMessage(msg.chat.id, '⚠️ Error fetching weekly data. Please try again.');
  }
});

// /goals — display current goals
bot.onText(/\/goals/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  const reply = fmt.formatGoals(config.goals);
  await bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
});

// /setgoal <macro> <value> — update a goal
bot.onText(/\/setgoal\s+(\w+)\s+(\d+)/, async (msg, match) => {
  if (!isAuthorized(msg.chat.id)) return;
  const macro = match[1].toLowerCase();
  const value = parseInt(match[2]);

  const validKeys = ['calories', 'protein', 'carbs', 'fat'];
  if (!validKeys.includes(macro)) {
    return bot.sendMessage(
      msg.chat.id,
      `⚠️ Invalid macro name. Use one of: ${validKeys.join(', ')}\nExample: /setgoal protein 150`
    );
  }

  config.goals[macro] = value;
  await bot.sendMessage(
    msg.chat.id,
    `✅ *${macro}* goal updated to *${value}${macro === 'calories' ? ' kcal' : 'g'}*`,
    { parse_mode: 'Markdown' }
  );
});

// /undo — delete last logged meal
bot.onText(/\/undo/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  try {
    const deleted = await sheets.deleteLastLog();
    if (!deleted) {
      return bot.sendMessage(msg.chat.id, '📭 No meals to undo.');
    }
    await bot.sendMessage(
      msg.chat.id,
      `↩️ *Removed*: ${deleted.mealDesc}\n🔥 ${deleted.calories} kcal  |  💪 ${deleted.protein}g protein`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error('❌ /undo error:', err.message);
    await bot.sendMessage(msg.chat.id, '⚠️ Error undoing last meal. Please try again.');
  }
});

// /help — command reference
bot.onText(/\/(help|start)/, async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  const reply = fmt.formatHelp();
  await bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
});

// ─── Default Handler: Meal Logging ──────────
bot.on('message', async (msg) => {
  if (!isAuthorized(msg.chat.id)) return;
  if (!msg.text) return;

  // Skip any command (starts with /)
  if (msg.text.startsWith('/')) return;

  // Also handle "today" as an alias (PRD §8.2)
  if (msg.text.toLowerCase().trim() === 'today') {
    try {
      const logs = await sheets.getTodayLogs();
      const totals = sheets.aggregateTotals(logs);
      const report = fmt.formatDailyReport(totals, config.goals);
      return bot.sendMessage(msg.chat.id, report, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('❌ today alias error:', err.message);
      return bot.sendMessage(msg.chat.id, '⚠️ Error fetching today\'s data.');
    }
  }

  // ─── Parse & Log the meal ─────────────────
  try {
    // Send "typing" indicator
    await bot.sendChatAction(msg.chat.id, 'typing');

    // 1. Parse meal via Groq
    const parsed = await parseMeal(msg.text);

    // 2. Append to Google Sheets
    await sheets.appendMealLog(
      parsed.meal_description,
      msg.text,
      parsed
    );

    // 3. Get today's running totals
    const todayLogs = await sheets.getTodayLogs();
    const todayTotals = sheets.aggregateTotals(todayLogs);

    // 4. Reply with breakdown + totals
    let reply = fmt.formatMealReply(parsed, todayTotals);

    // 5. Flag if implausibly high
    if (parsed._flagged) {
      reply += '\n\n' + fmt.formatFlaggedReply(parsed);
    }

    await bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('❌ Meal logging error:', err.message);

    // If Groq API is unavailable, store raw message with TODO (PRD §10.2)
    try {
      await sheets.appendMealLog(
        'TODO — PARSE FAILED',
        msg.text,
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }
      );
      await bot.sendMessage(
        msg.chat.id,
        `⚠️ ${err.message}\n\nYour message has been saved and will need manual correction.`
      );
    } catch (sheetErr) {
      console.error('❌ Sheets fallback error:', sheetErr.message);
      await bot.sendMessage(msg.chat.id, `⚠️ ${err.message}`);
    }
  }
});

// ─── Error Handling ─────────────────────────
bot.on('polling_error', (err) => {
  console.error('❌ Telegram polling error:', err.message);
});

module.exports = bot;
