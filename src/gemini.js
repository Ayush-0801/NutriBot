const { GoogleGenerativeAI, Schema, Type } = require('@google/generative-ai');
const config = require('./config');
const { parseMealWithGroq } = require('./groq');
const foodDb = require('./food_db');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const SYSTEM_PROMPT = `You are a nutrition expert parsing meal descriptions. Output ONLY a raw JSON object with no markdown or text.

Return exactly this JSON structure and nothing else:
{ "meal_description": "string", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number }

You will receive Context Data from databases. If the meal is a complex dish, mathematically combine the component macros from the Context Data to estimate the total.
Do NOT show your work. Output ONLY the JSON object. Never return 0 macros for a valid food item.

Default References (if Context Data is missing):
1 roti = 80kcal, 3g pro, 15g carb, 1g fat | 1 katori dal = 150kcal, 9g pro, 25g carb, 2g fat | 100g paneer = 265kcal, 18g pro, 3g carb, 20g fat`;

const model = genAI.getGenerativeModel({
  model: config.geminiModel,
  systemInstruction: SYSTEM_PROMPT,
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 1024,
    responseMimeType: "application/json",
  },
});

/**
 * Try to parse meal via Gemini (2 attempts).
 * @returns {object} parsed macro data or throws
 */
async function parseMealWithGemini(userMessage) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(userMessage);
      const raw = result.response.text();

      // Strip any accidental markdown fencing
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate required fields
      const requiredFields = ['meal_description', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'];
      for (const field of requiredFields) {
        if (parsed[field] === undefined) {
          throw new Error(`Missing field: ${field}`);
        }
      }

      // Plausibility check — flag if > 5000 kcal (PRD §10.2)
      if (parsed.calories > 5000) {
        parsed._flagged = true;
        parsed._flagReason = `Unusually high calories (${parsed.calories} kcal). Please confirm this is correct.`;
      }

      return parsed;
    } catch (err) {
      if (attempt === 0) {
        console.log(`⚠️  Gemini parse attempt 1 failed, retrying: ${err.message}`);
        continue;
      }
      throw err; // bubble up to the fallback handler
    }
  }
}

/**
 * Extract core food names from text to query APIs
 */
async function extractFoodItems(text) {
  try {
    const minModel = genAI.getGenerativeModel({ model: config.geminiModel });
    const prompt = `Extract the individual base food ingredients or items from this meal description into a JSON array of simple string queries. If it is a complex, uncommon, or creative dish, break it down into its core components so they can be accurately searched in food databases.
Example: "2 roti and 1 cup dal" -> ["roti", "dal makhani"].
Example: "lemon curd cruffin" -> ["lemon curd", "croissant", "muffin"].
Return ONLY a JSON array of strings: ${text}`;
    const result = await minModel.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('⚠️ Failed to extract foods, proceeding without context:', err.message);
    return [];
  }
}

/**
 * Parse a meal description — tries Gemini first, falls back to Groq.
 * @param {string} userMessage — raw meal text from the user
 * @returns {object} parsed macro data (with optional _provider field) or throws
 */
async function parseMeal(userMessage) {
  
  // 1. Extract items
  const items = await extractFoodItems(userMessage);

  // 2. Gather context
  const dbContext = await foodDb.gatherConfidenceData(items);
  let promptText = userMessage;
  if (dbContext) {
    promptText = `${dbContext}\n\nUser Input: ${userMessage}`;
    console.log('✅ DB Context gathered:', dbContext);
  }

  // 3. Final inference
  try {
    const result = await parseMealWithGemini(promptText);
    result._provider = 'gemini';
    return result;
  } catch (geminiErr) {
    console.error(`❌ Gemini failed after retries: ${geminiErr.message}`);

    // ─── Groq Fallback ────────────────────────
    if (!config.groqApiKey) {
      throw new Error('Could not parse your meal — try rephrasing with specific quantities.');
    }

    console.log('🔄 Falling back to Groq...');
    try {
      const result = await parseMealWithGroq(promptText);
      result._provider = 'groq';
      return result;
    } catch (groqErr) {
      console.error(`❌ Groq fallback also failed: ${groqErr.message}`);
      throw new Error('Could not parse your meal — both AI providers failed. Try rephrasing with specific quantities.');
    }
  }
}

module.exports = { parseMeal };
