const { google } = require('googleapis');
const config = require('./config');

// ─── Auth ───────────────────────────────────
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: config.googleServiceAccountEmail,
    private_key: config.googlePrivateKey,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});


const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = config.sheetsId;

// ─── Helpers ────────────────────────────────

/** Get today's date in DD/MM/YYYY format (IST) */
function todayDateStr() {
  return new Date().toLocaleDateString('en-GB', { timeZone: config.timezone });
}

/** Get current time in HH:MM format (IST) */
function nowTimeStr() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: config.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Parse DD/MM/YYYY + HH:MM into a Date object (IST) */
function parseLogDate(dateStr, timeStr) {
  const [dd, mm, yyyy] = dateStr.split('/');
  return new Date(`${yyyy}-${mm}-${dd}T${timeStr}:00+05:30`);
}

// ─── Write Operations ───────────────────────

/**
 * Append a meal log row to the "Logs" sheet.
 * Columns: Date | Time | Meal Description | Raw Input | Calories | Protein | Carbs | Fat | Fiber
 */
async function appendMealLog(mealDesc, rawInput, macros) {
  const row = [
    todayDateStr(),
    nowTimeStr(),
    mealDesc,
    rawInput,
    macros.calories,
    macros.protein_g,
    macros.carbs_g,
    macros.fat_g,
    macros.fiber_g,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Logs!A:I',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  return row;
}

/**
 * Append a daily summary row to the "Daily Summary" sheet.
 * Columns: Date | Calories | Protein | Carbs | Fat | Fiber | Meals | CalGoalMet | ProteinGoalMet
 */
async function appendDailySummary(summary) {
  const row = [
    summary.date,
    summary.calories,
    summary.protein,
    summary.carbs,
    summary.fat,
    summary.fiber,
    summary.mealCount,
    summary.calories >= config.goals.calories * 0.9,
    summary.protein >= config.goals.protein * 0.9,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Daily Summary!A:I',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// ─── Read Operations ────────────────────────

/**
 * Get all log rows for today.
 * Returns array of { date, time, mealDesc, rawInput, calories, protein, carbs, fat, fiber }
 */
async function getTodayLogs() {
  const allRows = await getAllLogs();
  const today = todayDateStr();
  return allRows.filter((r) => r.date === today);
}

/**
 * Get all log rows from the Logs sheet.
 */
async function getAllLogs() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Logs!A:I',
  });

  const rows = res.data.values || [];
  return rows.map((r) => ({
    date: r[0] || '',
    time: r[1] || '',
    mealDesc: r[2] || '',
    rawInput: r[3] || '',
    calories: parseFloat(r[4]) || 0,
    protein: parseFloat(r[5]) || 0,
    carbs: parseFloat(r[6]) || 0,
    fat: parseFloat(r[7]) || 0,
    fiber: parseFloat(r[8]) || 0,
  }));
}

/**
 * Get logs for the last 7 days.
 */
async function getWeekLogs() {
  const allRows = await getAllLogs();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return allRows.filter((r) => {
    if (!r.date) return false;
    const logDate = parseLogDate(r.date, r.time || '00:00');
    return logDate >= sevenDaysAgo && logDate <= now;
  });
}

/**
 * Check if any meal was logged in the last N hours.
 * Used for reminder skip logic (PRD §11.2).
 */
async function getRecentLogs(hours) {
  const allRows = await getAllLogs();
  const now = new Date();
  const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

  return allRows.filter((r) => {
    if (!r.date || !r.time) return false;
    const logDate = parseLogDate(r.date, r.time);
    return logDate >= cutoff && logDate <= now;
  });
}

/**
 * Delete the last row from the Logs sheet (/undo).
 * Returns the deleted row data or null if no rows.
 */
async function deleteLastLog() {
  // Get spreadsheet metadata to find the Logs sheet ID
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const logsSheet = meta.data.sheets.find(
    (s) => s.properties.title === 'Logs'
  );
  if (!logsSheet) return null;

  const sheetId = logsSheet.properties.sheetId;

  // Get all values to find last row
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Logs!A:I',
  });

  const rows = res.data.values || [];
  if (rows.length === 0) return null;

  const lastRow = rows[rows.length - 1];
  const lastRowIndex = rows.length; // 1-indexed in sheets (row 1 = first data row if no header)

  // Delete the last row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: lastRowIndex - 1, // 0-indexed
              endIndex: lastRowIndex,
            },
          },
        },
      ],
    },
  });

  return {
    date: lastRow[0],
    time: lastRow[1],
    mealDesc: lastRow[2],
    rawInput: lastRow[3],
    calories: parseFloat(lastRow[4]) || 0,
    protein: parseFloat(lastRow[5]) || 0,
    carbs: parseFloat(lastRow[6]) || 0,
    fat: parseFloat(lastRow[7]) || 0,
    fiber: parseFloat(lastRow[8]) || 0,
  };
}

/**
 * Aggregate totals from an array of log rows.
 */
function aggregateTotals(logs) {
  return logs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
      fiber: acc.fiber + log.fiber,
      mealCount: acc.mealCount + 1,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, mealCount: 0 }
  );
}

module.exports = {
  appendMealLog,
  appendDailySummary,
  getTodayLogs,
  getAllLogs,
  getWeekLogs,
  getRecentLogs,
  deleteLastLog,
  aggregateTotals,
  todayDateStr,
};
