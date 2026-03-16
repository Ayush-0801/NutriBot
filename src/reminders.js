const cron = require('node-cron');
const config = require('./config');
const sheets = require('./sheets');
const fmt = require('./formatter');

/**
 * Initialize all scheduled reminders.
 * Runs in IST timezone as per PRD §11.
 * @param {TelegramBot} bot — the Telegram bot instance
 */
function initReminders(bot) {
  const chatId = config.chatId;
  const tz = config.timezone;

  console.log('⏰ Initializing scheduled reminders (IST)...');

  // ─── Breakfast Reminder — 8:00 AM IST ─────
  cron.schedule('0 8 * * *', async () => {
    try {
      const recent = await sheets.getRecentLogs(2);
      if (recent.length > 0) {
        console.log('⏭  Breakfast reminder skipped — recent log exists');
        return;
      }

      // Get yesterday's protein for the message
      const allLogs = await sheets.getAllLogs();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toLocaleDateString('en-GB', { timeZone: tz });
      const yLogs = allLogs.filter((l) => l.date === yDateStr);
      const yProtein = yLogs.reduce((s, l) => s + l.protein, 0);

      const msg = `☀️ Good morning! Time for breakfast.\nYesterday you hit *${Math.round(yProtein)}g protein*.\nLog your first meal when ready! 🍳`;
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      console.log('✅ Breakfast reminder sent');
    } catch (err) {
      console.error('❌ Breakfast reminder error:', err.message);
    }
  }, { timezone: tz });

  // ─── Lunch Reminder — 1:00 PM IST ─────────
  cron.schedule('0 13 * * *', async () => {
    try {
      const recent = await sheets.getRecentLogs(2);
      if (recent.length > 0) {
        console.log('⏭  Lunch reminder skipped — recent log exists');
        return;
      }

      const todayLogs = await sheets.getTodayLogs();
      const totals = sheets.aggregateTotals(todayLogs);

      const msg = `🍛 Lunch time!\nYou've logged *${totals.calories} kcal* so far today.\nKeep it going! 💪`;
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      console.log('✅ Lunch reminder sent');
    } catch (err) {
      console.error('❌ Lunch reminder error:', err.message);
    }
  }, { timezone: tz });

  // ─── Evening Snack Reminder — 5:00 PM IST ─
  cron.schedule('0 17 * * *', async () => {
    try {
      const recent = await sheets.getRecentLogs(2);
      if (recent.length > 0) {
        console.log('⏭  Snack reminder skipped — recent log exists');
        return;
      }

      const todayLogs = await sheets.getTodayLogs();
      const totals = sheets.aggregateTotals(todayLogs);
      const remainCal = config.goals.calories - totals.calories;
      const remainPro = config.goals.protein - totals.protein;

      const msg = `🍌 Post-run snack time?\nYou have *${Math.max(0, remainCal)} kcal* and *${Math.max(0, Math.round(remainPro))}g protein* remaining for the day.`;
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      console.log('✅ Snack reminder sent');
    } catch (err) {
      console.error('❌ Snack reminder error:', err.message);
    }
  }, { timezone: tz });

  // ─── Dinner Reminder — 8:30 PM IST ────────
  cron.schedule('30 20 * * *', async () => {
    try {
      const recent = await sheets.getRecentLogs(2);
      if (recent.length > 0) {
        console.log('⏭  Dinner reminder skipped — recent log exists');
        return;
      }

      const todayLogs = await sheets.getTodayLogs();
      const totals = sheets.aggregateTotals(todayLogs);
      const remainCal = config.goals.calories - totals.calories;
      const remainPro = config.goals.protein - totals.protein;

      const msg = `🍽 Dinner time!\nYou need *${Math.max(0, remainCal)} more kcal* and *${Math.max(0, Math.round(remainPro))}g protein* to hit today's goals.\nMake it count! 💪`;
      await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
      console.log('✅ Dinner reminder sent');
    } catch (err) {
      console.error('❌ Dinner reminder error:', err.message);
    }
  }, { timezone: tz });

  // ─── Daily Report — 9:00 PM IST (never skipped) ─
  cron.schedule('0 21 * * *', async () => {
    try {
      const todayLogs = await sheets.getTodayLogs();
      const totals = sheets.aggregateTotals(todayLogs);

      // Send the formatted daily report
      const report = fmt.formatDailyReport(totals, config.goals);
      await bot.sendMessage(chatId, report, { parse_mode: 'Markdown' });

      // Append to Daily Summary sheet
      await sheets.appendDailySummary({
        date: sheets.todayDateStr(),
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        fiber: totals.fiber,
        mealCount: totals.mealCount,
      });

      console.log('✅ Daily report sent + summary logged');
    } catch (err) {
      console.error('❌ Daily report error:', err.message);
    }
  }, { timezone: tz });

  console.log('✅ All reminders scheduled:');
  console.log('   🌅 Breakfast  — 8:00 AM IST');
  console.log('   🍛 Lunch      — 1:00 PM IST');
  console.log('   🍌 Snack      — 5:00 PM IST');
  console.log('   🍽  Dinner     — 8:30 PM IST');
  console.log('   📊 Report     — 9:00 PM IST');
}

module.exports = { initReminders };
