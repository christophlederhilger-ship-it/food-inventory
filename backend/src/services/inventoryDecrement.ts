import { getDb } from '../db/schema';
import { matchIngredients } from './ingredientMatcher';

import type { RecipeIngredient } from './ingredientMatcher';

export interface DecrementResult {
  decremented: { name: string; removed: number; remaining: number }[];
  skipped: string[];
}

export function decrementInventory(
  recipeIngredients: RecipeIngredient[],
  historyId: number,
): DecrementResult {
  const db = getDb();
  const inventory = db
    .prepare('SELECT id, name, quantity, unit, category FROM inventory_items WHERE quantity > 0')
    .all() as { id: number; name: string; quantity: number; unit: string; category: string }[];

  const matches = matchIngredients(recipeIngredients, inventory);

  const decremented: DecrementResult['decremented'] = [];
  const skipped: string[] = [];

  const doDecrement = db.transaction(() => {
    for (const result of matches) {
      if (!result.available || !result.inventoryItem) {
        skipped.push(result.ingredient.name);
        continue;
      }

      const item = result.inventoryItem;
      const rawAmt = result.ingredient.amount;
      const removeAmt = rawAmt ? parseFloat(String(rawAmt)) || 1 : 1;

      const remaining = Math.max(0, item.quantity - removeAmt);
      db.prepare(
        'UPDATE inventory_items SET quantity = ?, updated_at = datetime(\'now\') WHERE id = ?',
      ).run(remaining, item.id);

      decremented.push({ name: item.name, removed: removeAmt, remaining });
    }

    // Mark recipe as cooked
    db.prepare('UPDATE recipe_history SET cooked = 1 WHERE id = ?').run(historyId);
  });

  doDecrement();
  return { decremented, skipped };
}
