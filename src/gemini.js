const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

// System prompt from PRD §10.1 — Indian food reference table
const SYSTEM_PROMPT = `You are a nutrition expert specializing in Indian food. Parse the meal input and return ONLY a raw JSON object with no markdown or explanation.

Return exactly:
{ "meal_description": string, "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number }

Reference values:
1 roti = 80 kcal, 3g protein, 15g carbs, 1g fat
1 katori dal = 150 kcal, 9g protein, 25g carbs, 2g fat
1 katori rice cooked = 195 kcal, 4g protein, 43g carbs, 0.5g fat
100g paneer = 265 kcal, 18g protein, 3g carbs, 20g fat
1 plate poha = 250 kcal, 5g protein, 45g carbs, 6g fat
100g chicken breast = 165 kcal, 31g protein, 0g carbs, 3.6g fat
1 idli = 40 kcal | 1 dosa = 120 kcal | 1 cup chai = 60 kcal
1 katori sabzi = 100 kcal avg | 1 paratha = 200 kcal
100g curd = 60 kcal | 1 glass lassi = 180 kcal
1 boiled egg = 70 kcal, 6g protein, 0.5g carbs, 5g fat
1 samosa = 130 kcal | 1 banana = 90 kcal
1 scoop whey protein = 120 kcal, 24g protein, 3g carbs, 1.5g fat

Return ONLY the JSON object.`;

const model = genAI.getGenerativeModel({
  model: config.geminiModel,
  systemInstruction: SYSTEM_PROMPT,
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 300,
  },
});

/**
 * Parse a meal description using Gemini 2.0 Flash.
 * Retries once on malformed JSON as per PRD §10.2.
 * @param {string} userMessage — raw meal text from the user
 * @returns {object} parsed macro data or throws
 */
async function parseMeal(userMessage) {
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
      throw new Error('Could not parse your meal — try rephrasing with specific quantities.');
    }
  }
}

module.exports = { parseMeal };
