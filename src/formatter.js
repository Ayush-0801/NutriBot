/**
 * Formatting utilities for NutriBot messages.
 * All output follows the PRD §8.4 daily report format.
 */

// ─── Progress Bar ───────────────────────────
/**
 * Build a progress bar: ▓▓▓▓▓░░░░░ 105/140g
 * @param {number} current
 * @param {number} goal
 * @param {number} segments — number of bar segments (default 10)
 * @returns {string}
 */
function makeProgressBar(current, goal, segments = 10) {
  const ratio = Math.min(current / goal, 1);
  const filled = Math.round(ratio * segments);
  const empty = segments - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Status icon based on percentage of goal.
 * ✅ >= 90%  |  🟡 60–89%  |  ❌ < 60%
 */
function statusIcon(current, goal) {
  const pct = (current / goal) * 100;
  if (pct >= 90) return '✅';
  if (pct >= 60) return '🟡';
  return '❌';
}

// ─── Meal Reply ─────────────────────────────
/**
 * Format the immediate reply after logging a meal.
 * Shows per-meal breakdown + today's running totals.
 */
function formatMealReply(parsed, todayTotals) {
  const lines = [
    `✅ *Logged*: ${parsed.meal_description}`,
    ``,
    `🔥 ${parsed.calories} kcal  |  💪 ${parsed.protein_g}g protein`,
    `🌾 ${parsed.carbs_g}g carbs  |  🥑 ${parsed.fat_g}g fat  |  🌿 ${parsed.fiber_g}g fiber`,
    ``,
    `─────────────────────`,
    `📊 *Today so far*: ${todayTotals.calories} kcal  |  ${todayTotals.protein}g protein`,
  ];
  return lines.join('\n');
}

/**
 * Format a flagged (high calorie) meal reply.
 */
function formatFlaggedReply(parsed) {
  return [
    `⚠️ *High calorie warning*`,
    ``,
    `Parsed: ${parsed.meal_description}`,
    `Calories: *${parsed.calories} kcal* — this seems unusually high.`,
    ``,
    `If this is correct, the meal has been logged.`,
    `Use /undo to remove it and rephrase if needed.`,
  ].join('\n');
}

// ─── Daily Report (9 PM) ────────────────────
/**
 * Format the full daily macro report as per PRD §8.4.
 */
function formatDailyReport(totals, goals) {
  const remaining = goals.calories - totals.calories;
  const remainMsg =
    remaining > 0
      ? `⚡ ${remaining} kcal remaining`
      : `🔥 ${Math.abs(remaining)} kcal over goal`;

  const lines = [
    `📊 *Daily Macro Report*`,
    `─────────────────────`,
    `🍽 Meals logged: ${totals.mealCount}`,
    ``,
    `🔥 *Calories*`,
    `${makeProgressBar(totals.calories, goals.calories)} ${totals.calories}/${goals.calories} kcal ${statusIcon(totals.calories, goals.calories)}`,
    ``,
    `💪 *Protein*`,
    `${makeProgressBar(totals.protein, goals.protein)} ${totals.protein}/${goals.protein}g ${statusIcon(totals.protein, goals.protein)}`,
    ``,
    `🌾 *Carbs*`,
    `${makeProgressBar(totals.carbs, goals.carbs)} ${totals.carbs}/${goals.carbs}g ${statusIcon(totals.carbs, goals.carbs)}`,
    ``,
    `🥑 *Fat*`,
    `${makeProgressBar(totals.fat, goals.fat)} ${totals.fat}/${goals.fat}g ${statusIcon(totals.fat, goals.fat)}`,
    ``,
    `🌿 Fiber: ${totals.fiber}g`,
    `─────────────────────`,
    remainMsg,
  ];

  return lines.join('\n');
}

// ─── Meals List ─────────────────────────────
/**
 * Format the list of today's meals for /meals command.
 */
function formatMealsList(meals) {
  if (meals.length === 0) {
    return `📭 No meals logged today yet. Send a message to log your first meal!`;
  }

  const header = `🍽 *Today's Meals* (${meals.length})\n─────────────────────\n`;
  const mealLines = meals.map((m, i) => {
    return [
      `*${i + 1}. ${m.mealDesc}*  (${m.time})`,
      `   🔥 ${m.calories} kcal  |  💪 ${m.protein}g  |  🌾 ${m.carbs}g  |  🥑 ${m.fat}g`,
    ].join('\n');
  });

  return header + mealLines.join('\n\n');
}

// ─── Week Summary ───────────────────────────
/**
 * Format the 7-day summary for /week command.
 */
function formatWeekSummary(weekData, goals) {
  if (weekData.length === 0) {
    return `📭 No data for the past 7 days.`;
  }

  // Group by date
  const byDate = {};
  for (const log of weekData) {
    if (!byDate[log.date]) byDate[log.date] = [];
    byDate[log.date].push(log);
  }

  const dates = Object.keys(byDate);
  let totalCal = 0;
  let totalProtein = 0;
  let goalDays = 0;

  const dayLines = dates.map((date) => {
    const logs = byDate[date];
    const dayCal = logs.reduce((s, l) => s + l.calories, 0);
    const dayPro = logs.reduce((s, l) => s + l.protein, 0);
    totalCal += dayCal;
    totalProtein += dayPro;
    if (dayCal >= goals.calories * 0.9) goalDays++;
    const icon = dayCal >= goals.calories * 0.9 ? '✅' : '🟡';
    return `${date}: ${dayCal} kcal | ${dayPro}g protein ${icon}`;
  });

  const avgCal = Math.round(totalCal / dates.length);
  const avgProtein = Math.round(totalProtein / dates.length);
  const hitRate = Math.round((goalDays / dates.length) * 100);

  const lines = [
    `📊 *7-Day Summary*`,
    `─────────────────────`,
    ...dayLines,
    `─────────────────────`,
    `📈 Avg: ${avgCal} kcal/day  |  ${avgProtein}g protein/day`,
    `🎯 Goal hit rate: ${hitRate}% (${goalDays}/${dates.length} days)`,
  ];

  return lines.join('\n');
}

// ─── Goals Display ──────────────────────────
/**
 * Format current goals for /goals command.
 */
function formatGoals(goals) {
  return [
    `🎯 *Current Macro Goals*`,
    `─────────────────────`,
    `🔥 Calories: ${goals.calories} kcal`,
    `💪 Protein: ${goals.protein}g`,
    `🌾 Carbs: ${goals.carbs}g`,
    `🥑 Fat: ${goals.fat}g`,
    ``,
    `Use /setgoal <macro> <value> to update.`,
    `Example: /setgoal protein 150`,
  ].join('\n');
}

// ─── Help ───────────────────────────────────
function formatHelp() {
  return [
    `🤖 *NutriBot — Commands*`,
    `─────────────────────`,
    `Just send a message to log a meal:`,
    `  \`2 roti + dal makhani 1 katori\``,
    `  \`poha ek plate, chai bina cheeni\``,
    ``,
    `📊 /today — Today's macro summary`,
    `🍽 /meals — List all meals logged today`,
    `📈 /week — 7-day summary`,
    `🎯 /goals — View current goals`,
    `⚙️ /setgoal — Update a goal`,
    `↩️ /undo — Delete last logged meal`,
    `❓ /help — Show this message`,
  ].join('\n');
}

module.exports = {
  makeProgressBar,
  statusIcon,
  formatMealReply,
  formatFlaggedReply,
  formatDailyReport,
  formatMealsList,
  formatWeekSummary,
  formatGoals,
  formatHelp,
};
