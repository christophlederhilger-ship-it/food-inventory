import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema';

const router = Router();

// Get shopping list for a recipe
router.get('/:recipeId', (req: Request, res: Response) => {
  const db = getDb();
  const items = db
    .prepare('SELECT * FROM shopping_list WHERE recipe_id = ? ORDER BY bought, ingredient_name')
    .all(req.params.recipeId);
  res.json(items);
});

// Create shopping list for a recipe from its missing ingredients
router.post('/:recipeId/generate', (req: Request, res: Response) => {
  const recipeId = parseInt(req.params.recipeId, 10);
  const db = getDb();

  const entry = db.prepare('SELECT * FROM recipe_history WHERE id = ?').get(recipeId) as any;
  if (!entry) {
    res.status(404).json({ error: 'Recipe not found' });
    return;
  }

  const { missing } = req.body as { missing: { name: string; amount?: string; unit?: string }[] };
  if (!Array.isArray(missing)) {
    res.status(400).json({ error: 'missing array required' });
    return;
  }

  // Clear existing list for this recipe
  db.prepare('DELETE FROM shopping_list WHERE recipe_id = ?').run(recipeId);

  const insert = db.prepare(
    'INSERT INTO shopping_list (recipe_id, ingredient_name, amount, unit) VALUES (?, ?, ?, ?)',
  );
  const insertMany = db.transaction((items: typeof missing) => {
    for (const item of items) {
      insert.run(recipeId, item.name, item.amount ?? null, item.unit ?? null);
    }
  });
  insertMany(missing);

  const items = db
    .prepare('SELECT * FROM shopping_list WHERE recipe_id = ? ORDER BY ingredient_name')
    .all(recipeId);
  res.status(201).json(items);
});

// Toggle bought status and optionally add to inventory
router.put('/item/:itemId/bought', (req: Request, res: Response) => {
  const itemId = parseInt(req.params.itemId, 10);
  const db = getDb();

  const shopItem = db.prepare('SELECT * FROM shopping_list WHERE id = ?').get(itemId) as any;
  if (!shopItem) {
    res.status(404).json({ error: 'Shopping list item not found' });
    return;
  }

  const newBought = shopItem.bought ? 0 : 1;
  db.prepare('UPDATE shopping_list SET bought = ? WHERE id = ?').run(newBought, itemId);

  // If marking as bought, add to inventory
  if (newBought === 1) {
    const { addToInventory, quantity, unit, category } = req.body;
    if (addToInventory !== false) {
      const qty = parseFloat(quantity) || 1;
      const u = unit || 'pieces';
      const cat = category || 'other';

      const existing = db
        .prepare('SELECT id FROM inventory_items WHERE LOWER(name) = LOWER(?)')
        .get(shopItem.ingredient_name) as { id: number } | undefined;

      if (existing) {
        db.prepare(
          "UPDATE inventory_items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?",
        ).run(qty, existing.id);
      } else {
        db.prepare(
          'INSERT INTO inventory_items (name, quantity, unit, category) VALUES (?, ?, ?, ?)',
        ).run(shopItem.ingredient_name, qty, u, cat);
      }
    }
  }

  const updated = db.prepare('SELECT * FROM shopping_list WHERE id = ?').get(itemId);
  res.json(updated);
});

export default router;
