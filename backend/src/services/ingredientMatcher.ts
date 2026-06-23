// Fuzzy ingredient matching: presence-based, not quantity-based.
// An ingredient counts as "available" if a name match exists with quantity > 0.

const STRIP_WORDS = [
  'canned', 'fresh', 'frozen', 'dried', 'cooked', 'raw', 'sliced', 'chopped',
  'diced', 'minced', 'ground', 'whole', 'large', 'small', 'medium',
];

function normalize(name: string): string {
  let n = name.toLowerCase().trim();
  for (const w of STRIP_WORDS) {
    n = n.replace(new RegExp(`\\b${w}\\b`, 'g'), '');
  }
  // Singularize naively: strip trailing 's' unless very short
  n = n.replace(/\s+/g, ' ').trim();
  if (n.length > 3 && n.endsWith('s') && !n.endsWith('ss')) {
    n = n.slice(0, -1);
  }
  return n;
}

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface RecipeIngredient {
  name: string;
  amount?: string | number;
  unit?: string;
}

export interface MatchResult {
  ingredient: RecipeIngredient;
  available: boolean;
  inventoryItem?: InventoryItem;
}

export function matchIngredients(
  recipeIngredients: RecipeIngredient[],
  inventory: InventoryItem[]
): MatchResult[] {
  const normInventory = inventory.map(item => ({
    item,
    norm: normalize(item.name),
  }));

  return recipeIngredients.map(ingredient => {
    const normTarget = normalize(ingredient.name);

    // Find best match: exact normalized, then substring
    let match = normInventory.find(
      inv => inv.item.quantity > 0 && inv.norm === normTarget
    );
    if (!match) {
      match = normInventory.find(
        inv =>
          inv.item.quantity > 0 &&
          (inv.norm.includes(normTarget) || normTarget.includes(inv.norm))
      );
    }

    return {
      ingredient,
      available: !!match,
      inventoryItem: match?.item,
    };
  });
}

export function splitMatches(results: MatchResult[]) {
  return {
    have: results.filter(r => r.available),
    missing: results.filter(r => !r.available),
  };
}
