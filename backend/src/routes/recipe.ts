import { Router, Request, Response } from 'express';
import { suggestRecipe } from '../services/recipeEngine';
import { decrementInventory } from '../services/inventoryDecrement';
import { getDb } from '../db/schema';

const router = Router();

// Get today's recipe suggestion (cached) or generate a new one
router.get('/suggest', async (_req: Request, res: Response) => {
  try {
    const result = await suggestRecipe(false);
    res.json(result);
  } catch (err: any) {
    console.error('Recipe suggestion error:', err);
    res.status(500).json({ error: err.message || 'Failed to suggest recipe' });
  }
});

// Force a fresh recipe suggestion (ignores today's cache)
router.post('/suggest/refresh', async (_req: Request, res: Response) => {
  try {
    const result = await suggestRecipe(true);
    res.json(result);
  } catch (err: any) {
    console.error('Recipe refresh error:', err);
    res.status(500).json({ error: err.message || 'Failed to refresh recipe' });
  }
});

// Mark a recipe as cooked and decrement inventory
router.post('/:id/cook', (req: Request, res: Response) => {
  const historyId = parseInt(req.params.id, 10);
  const db = getDb();
  const entry = db
    .prepare('SELECT * FROM recipe_history WHERE id = ?')
    .get(historyId) as any;

  if (!entry) {
    res.status(404).json({ error: 'Recipe history entry not found' });
    return;
  }
  if (entry.cooked) {
    res.status(409).json({ error: 'Recipe already marked as cooked' });
    return;
  }

  const ingredients = JSON.parse(entry.ingredients);
  const result = decrementInventory(ingredients, historyId);
  res.json(result);
});

// Recipe history list
router.get('/history', (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM recipe_history ORDER BY date DESC, id DESC LIMIT 30')
    .all();
  res.json(rows);
});

export default router;
