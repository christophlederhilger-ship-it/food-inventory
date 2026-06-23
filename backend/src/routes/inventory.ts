import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const items = db
    .prepare('SELECT * FROM inventory_items ORDER BY category, name')
    .all();
  res.json(items);
});

router.post('/', (req: Request, res: Response) => {
  const { name, quantity, unit, category, expiry_date } = req.body;
  if (!name || quantity == null || !unit || !category) {
    res.status(400).json({ error: 'name, quantity, unit, category are required' });
    return;
  }
  const db = getDb();

  // Check if item with same name already exists (case-insensitive)
  const existing = db
    .prepare('SELECT id FROM inventory_items WHERE LOWER(name) = LOWER(?)')
    .get(name) as { id: number } | undefined;

  if (existing) {
    // Merge: add to existing quantity
    db.prepare(
      "UPDATE inventory_items SET quantity = quantity + ?, updated_at = datetime('now') WHERE id = ?",
    ).run(quantity, existing.id);
    const updated = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(existing.id);
    res.json(updated);
    return;
  }

  const result = db
    .prepare(
      'INSERT INTO inventory_items (name, quantity, unit, category, expiry_date) VALUES (?, ?, ?, ?, ?)',
    )
    .run(name, quantity, unit, category, expiry_date ?? null);
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, quantity, unit, category, expiry_date } = req.body;
  const db = getDb();
  db.prepare(
    `UPDATE inventory_items
     SET name = ?, quantity = ?, unit = ?, category = ?, expiry_date = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(name, quantity, unit, category, expiry_date ?? null, id);
  const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(id);
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(item);
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const db = getDb();
  const result = db.prepare('DELETE FROM inventory_items WHERE id = ?').run(id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ ok: true });
});

// Autocomplete suggestions for quick-add
router.get('/search', (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const db = getDb();
  const items = db
    .prepare("SELECT name, unit, category FROM inventory_items WHERE name LIKE ? ORDER BY name LIMIT 10")
    .all(`%${q}%`);
  res.json(items);
});

export default router;
