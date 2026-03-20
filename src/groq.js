const Groq = require('groq-sdk');
const config = require('./config');

let groqClient = null;

function getClient() {
  if (!groqClient && config.groqApiKey) {
    groqClient = new Groq({ apiKey: config.groqApiKey });
  }
  return groqClient;
}

// Re-use the same system prompt from gemini.js for consistency
const SYSTEM_PROMPT = `You are a nutrition expert parsing meal descriptions. Output ONLY a raw JSON object with no markdown or text.

Return exactly this JSON structure and nothing else:
{ "meal_description": "string", "calories": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number }

You will receive Context Data from databases. If the meal is a complex dish, mathematically combine the component macros from the Context Data to estimate the total.
Do NOT show your work. Output ONLY the JSON object. Never return 0 macros for a valid food item.

Default References (if Context Data is missing):
1 roti = 80kcal, 3g pro, 15g carb, 1g fat | 1 katori dal = 150kcal, 9g pro, 25g carb, 2g fat | 100g paneer = 265kcal, 18g pro, 3g carb, 20g fat`;

/**
 * Parse a meal description using Groq (fallback provider).
 * Uses the same retry + validation logic as the Gemini module.
 * @param {string} userMessage — raw meal text from the user
 * @returns {object} parsed macro data or throws
 */
async function parseMealWithGroq(userMessage) {
  const client = getClient();
  if (!client) {
    throw new Error('Groq API key not configured — cannot use fallback.');
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const chatCompletion = await client.chat.completions.create({
        model: config.groqModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });

      const raw = chatCompletion.choices[0].message.content;

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

      // Plausibility check — flag if > 5000 kcal
      if (parsed.calories > 5000) {
        parsed._flagged = true;
        parsed._flagReason = `Unusually high calories (${parsed.calories} kcal). Please confirm this is correct.`;
      }

      return parsed;
    } catch (err) {
      if (attempt === 0) {
        console.log(`⚠️  Groq parse attempt 1 failed, retrying: ${err.message}`);
        continue;
      }
      throw new Error('Groq fallback also failed — could not parse your meal.');
    }
  }
}

module.exports = { parseMealWithGroq };
