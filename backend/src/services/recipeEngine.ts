import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db/schema';
import { matchIngredients, splitMatches, type RecipeIngredient } from './ingredientMatcher';

interface NutritionBreakdown {
  protein?: string;
  carbs?: string;
  fat?: string;
  calories?: string;
}

export interface Recipe {
  title: string;
  source_url: string | null;
  rating: string | null;
  total_time: number;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  nutrition_note: string | null;
  nutrition_breakdown?: NutritionBreakdown;
}

export interface RecipeResult {
  recipe: Recipe | null;
  matchResults: ReturnType<typeof matchIngredients>;
  have: string[];
  missing: string[];
  historyId?: number;
}

const NUTRITIONAL_RULE = `
NUTRITIONAL COMPLETENESS RULES (ALL must be met):
1. PROTEIN SOURCE: Must include one of — meat, poultry, fish, eggs, legumes (beans, lentils, chickpeas), tofu, tempeh, or dairy with significant protein
2. COMPLEX CARBOHYDRATE: Must include one of — whole grains, pasta, rice, potatoes, legumes, oats
3. VEGETABLE OR FRUIT: Must include at least one vegetable or fruit
4. HEALTHY FAT: Must include one of — olive oil, nuts, seeds, avocado, fatty fish, eggs, or dairy

A recipe is INVALID if it lacks any of these four components.
`;

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getRecentTitles(): string[] {
  const db = getDb();
  const today = getTodayString();
  // exclude recipes suggested in the last 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const rows = db
    .prepare('SELECT title FROM recipe_history WHERE date >= ? ORDER BY date DESC')
    .all(cutoffStr) as { title: string }[];

  return rows.map(r => r.title);
}

function saveToHistory(recipe: Recipe): number {
  const db = getDb();
  const result = db
    .prepare(`
      INSERT INTO recipe_history (date, title, source_url, rating, total_time, servings, ingredients, instructions, nutrition_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      getTodayString(),
      recipe.title,
      recipe.source_url,
      recipe.rating,
      recipe.total_time,
      recipe.servings,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.instructions),
      recipe.nutrition_note,
    );
  return result.lastInsertRowid as number;
}

function getInventory() {
  const db = getDb();
  return db
    .prepare('SELECT id, name, quantity, unit, category FROM inventory_items WHERE quantity > 0')
    .all() as { id: number; name: string; quantity: number; unit: string; category: string }[];
}

function buildPrompt(inventoryNames: string[], excludeTitles: string[]): string {
  const exclusion =
    excludeTitles.length > 0
      ? `\nDo NOT suggest these recently used recipes: ${excludeTitles.join(', ')}\n`
      : '';

  return `You are a cooking assistant helping find a real, well-rated recipe.

Available ingredients (presence-based — don't worry about exact amounts):
${inventoryNames.join(', ')}

${exclusion}

${NUTRITIONAL_RULE}

CONSTRAINTS:
- Total cooking time ≤ 30 minutes
- Must be a real recipe from a reputable cooking website (AllRecipes, Food Network, Serious Eats, NYT Cooking, BBC Good Food, etc.)
- Must have a real rating (4+ stars or equivalent)
- Must be nutritionally complete per the rules above

Use the web_search tool to find a real recipe that uses primarily the available ingredients and meets ALL constraints.

After finding a recipe, respond with ONLY a JSON object (no markdown, no code blocks) in this exact format:
{
  "title": "Recipe Name",
  "source_url": "https://actual-url.com/recipe",
  "rating": "4.8/5 stars",
  "total_time": 25,
  "servings": 4,
  "ingredients": [
    {"name": "chicken breast", "amount": "400", "unit": "g"},
    {"name": "garlic", "amount": "3", "unit": "cloves"}
  ],
  "instructions": [
    "Step 1: ...",
    "Step 2: ..."
  ],
  "nutrition_note": "Protein: chicken. Carbs: rice. Veg: broccoli. Fat: olive oil.",
  "nutrition_breakdown": {
    "protein": "35g per serving",
    "carbs": "42g per serving",
    "fat": "12g per serving",
    "calories": "410 kcal per serving"
  }
}

If no suitable recipe is found, respond with: {"error": "No suitable recipe found", "reason": "explanation"}`;
}

export async function suggestRecipe(forceRefresh = false): Promise<RecipeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const inventory = getInventory();
  if (inventory.length === 0) {
    return { recipe: null, matchResults: [], have: [], missing: [] };
  }

  // Check for today's cached recipe unless forcing refresh
  if (!forceRefresh) {
    const db = getDb();
    const today = getTodayString();
    const cached = db
      .prepare('SELECT * FROM recipe_history WHERE date = ? AND cooked = 0 ORDER BY id DESC LIMIT 1')
      .get(today) as any;

    if (cached) {
      const recipe: Recipe = {
        title: cached.title,
        source_url: cached.source_url,
        rating: cached.rating,
        total_time: cached.total_time,
        servings: cached.servings,
        ingredients: JSON.parse(cached.ingredients),
        instructions: JSON.parse(cached.instructions),
        nutrition_note: cached.nutrition_note,
      };
      const matchResults = matchIngredients(recipe.ingredients, inventory);
      const { have, missing } = splitMatches(matchResults);
      return {
        recipe,
        matchResults,
        have: have.map(r => r.ingredient.name),
        missing: missing.map(r => r.ingredient.name),
        historyId: cached.id,
      };
    }
  }

  const inventoryNames = inventory.map(i => i.name);
  const excludeTitles = getRecentTitles();
  const prompt = buildPrompt(inventoryNames, excludeTitles);

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];

  // Agentic loop for web_search tool use
  const callApi = (msgs: Anthropic.MessageParam[]): Promise<Anthropic.Message> =>
    client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
      messages: msgs,
    }) as Promise<Anthropic.Message>;

  let response = await callApi(messages);

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(tool => ({
      type: 'tool_result' as const,
      tool_use_id: tool.id,
      content: '',
    }));

    messages.push({ role: 'user', content: toolResults });

    response = await callApi(messages);
  }

  // Extract text response
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  if (!textBlock) {
    return { recipe: null, matchResults: [], have: [], missing: [] };
  }

  let parsed: any;
  try {
    // Strip any accidental markdown fences
    const raw = textBlock.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(raw);
  } catch {
    return { recipe: null, matchResults: [], have: [], missing: [] };
  }

  if (parsed.error) {
    return { recipe: null, matchResults: [], have: [], missing: [] };
  }

  // Validate required fields
  if (
    !parsed.title ||
    !Array.isArray(parsed.ingredients) ||
    !Array.isArray(parsed.instructions) ||
    typeof parsed.total_time !== 'number'
  ) {
    return { recipe: null, matchResults: [], have: [], missing: [] };
  }

  const recipe: Recipe = {
    title: parsed.title,
    source_url: parsed.source_url || null,
    rating: parsed.rating || null,
    total_time: Math.min(parsed.total_time, 30),
    servings: parsed.servings || 2,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    nutrition_note: parsed.nutrition_note || null,
    nutrition_breakdown: parsed.nutrition_breakdown,
  };

  const historyId = saveToHistory(recipe);
  const matchResults = matchIngredients(recipe.ingredients, inventory);
  const { have, missing } = splitMatches(matchResults);

  return {
    recipe,
    matchResults,
    have: have.map(r => r.ingredient.name),
    missing: missing.map(r => r.ingredient.name),
    historyId,
  };
}
