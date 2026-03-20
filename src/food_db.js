const config = require('./config');
const compositions = require('@ifct2017/compositions');

let ifctLoaded = false;

async function ensureIFCTLoaded() {
  if (!ifctLoaded) {
    try {
      await compositions.load();
      ifctLoaded = true;
      console.log('✅ IFCT 2017 Database loaded successfully.');
    } catch (err) {
      console.error('❌ Failed to load IFCT 2017 data:', err.message);
    }
  }
}

/**
 * Parses the response from IFCT search.
 */
async function searchIFCT(query) {
  try {
    await ensureIFCTLoaded();
    const results = compositions(query);
    if (!results || results.length === 0) return null;

    // Take the best match
    const bestMatch = results[0];
    // IFCT fields correspond to codes sometimes, let's grab protein, carbs, fat, energy
    // But since the results array contains full objects, we must format it.
    // E.g., energy = bestMatch.enerc? Or bestMatch.enerc_kcal? Let's carefully gather what we can.
    // The exact keys might be generic, but we can dump the whole object to the LLM or pick out main macros if possible.
    // Usually it has things like { enerc: { value }, procnt: {value}, chocdf: {value}, fatce: {value} } or flat keys.
    // We will just stringify the top result safely.
    
    // To be safe and concise for the LLM prompt, we'll extract name and serialize the object
    const name = bestMatch.name || bestMatch.scie || query;
    return `[IFCT 2017] ${name}: ` + JSON.stringify(bestMatch).substring(0, 300) + '...';
  } catch (err) {
    console.error('⚠️ IFCT search failed:', err.message);
    return null;
  }
}

/*
/**
 * Search Nutritionix Natural Language API
 *
async function searchNutritionix(query) {
  if (!config.nutritionixAppId || !config.nutritionixApiKey) return null;

  try {
    const res = await fetch('https://trackapi.nutritionix.com/v2/natural/nutrients', {
      method: 'POST',
      headers: {
        'x-app-id': config.nutritionixAppId,
        'x-app-key': config.nutritionixApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: query })
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.foods || data.foods.length === 0) return null;

    const food = data.foods[0];
    return \`[Nutritionix] \${food.food_name}: \${food.nf_calories} kcal, \${food.nf_protein}g protein, \${food.nf_total_carbohydrate}g carbs, \${food.nf_total_fat}g fat\`;
  } catch (err) {
    console.error('⚠️ Nutritionix search failed:', err.message);
    return null;
  }
}
*/

/**
 * Search USDA FoodData Central
 */
async function searchUSDA(query) {
  if (!config.usdaApiKey) return null;

  try {
    const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${config.usdaApiKey}&pageSize=1`);
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data.foods || data.foods.length === 0) return null;

    const food = data.foods[0];
    const macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    
    for (const nutrient of food.foodNutrients) {
      const name = nutrient.nutrientName.toLowerCase();
      if (name.includes('energy')) macros.calories = nutrient.value;
      if (name.includes('protein')) macros.protein = nutrient.value;
      if (name.includes('carbohydrate')) macros.carbs = nutrient.value;
      if (name.includes('total lipid') || name.includes('fat')) macros.fat = nutrient.value;
    }

    return `[USDA] ${food.description}: ${macros.calories} kcal, ${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat`;
  } catch (err) {
    console.error('⚠️ USDA search failed:', err.message);
    return null;
  }
}

/**
 * Search Open Food Facts
 */
async function searchOpenFoodFacts(query) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=1`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.products || data.products.length === 0) return null;

    const product = data.products[0];
    if (!product.nutriments) return null;

    const n = product.nutriments;
    return `[OpenFoodFacts] ${product.product_name || query}: ${n['energy-kcal_100g'] || n.energy_100g || 0} kcal, ${n.proteins_100g || 0}g protein, ${n.carbohydrates_100g || 0}g carbs, ${n.fat_100g || 0}g fat (per 100g)`;
  } catch (err) {
    console.error('⚠️ OpenFoodFacts search failed:', err.message);
    return null;
  }
}

/**
 * Orchestrator: Search databases sequentially or in parallel for a food item and return the best results.
 * @param {string[]} foodItems Array of food queries
 * @returns {Promise<string>} A summarized block of reference data
 */
async function gatherConfidenceData(foodItems) {
  if (!foodItems || foodItems.length === 0) return '';
  
  const results = [];
  
  for (const item of foodItems) {
    // Try Nutritionix (natural language excels at standard items)
    // let found = await searchNutritionix(item);
    let found = null;
    
    if (!found) {
      // Try IFCT for Indian specificity
      found = await searchIFCT(item);
    }
    if (!found) {
      // Try Open Food Facts for packaged goods
      found = await searchOpenFoodFacts(item);
    }
    if (!found) {
      // Lastly, USDA for raw ingredients fallback
      found = await searchUSDA(item);
    }

    if (found) {
      results.push(found);
    }
  }

  if (results.length === 0) return '';
  
  return 'Reference Data Found:\n' + results.map(r => '- ' + r).join('\n');
}

module.exports = {
  // searchNutritionix,
  searchIFCT,
  searchUSDA,
  searchOpenFoodFacts,
  gatherConfidenceData
};
