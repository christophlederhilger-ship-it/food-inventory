import { getDb } from './schema';

export function seedIfEmpty() {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as n FROM inventory_items').get() as { n: number }).n;
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO inventory_items (name, quantity, unit, category, expiry_date)
    VALUES (@name, @quantity, @unit, @category, @expiry_date)
  `);

  const items = [
    { name: 'Chicken breast', quantity: 400, unit: 'g', category: 'protein', expiry_date: tomorrowPlus(2) },
    { name: 'Eggs', quantity: 6, unit: 'pieces', category: 'protein', expiry_date: tomorrowPlus(14) },
    { name: 'Canned chickpeas', quantity: 400, unit: 'g', category: 'canned', expiry_date: null },
    { name: 'Pasta', quantity: 500, unit: 'g', category: 'grains', expiry_date: null },
    { name: 'Rice', quantity: 800, unit: 'g', category: 'grains', expiry_date: null },
    { name: 'Olive oil', quantity: 500, unit: 'ml', category: 'condiments', expiry_date: null },
    { name: 'Garlic', quantity: 5, unit: 'pieces', category: 'produce', expiry_date: tomorrowPlus(21) },
    { name: 'Onion', quantity: 3, unit: 'pieces', category: 'produce', expiry_date: tomorrowPlus(14) },
    { name: 'Tomatoes', quantity: 4, unit: 'pieces', category: 'produce', expiry_date: tomorrowPlus(4) },
    { name: 'Spinach', quantity: 150, unit: 'g', category: 'produce', expiry_date: tomorrowPlus(3) },
    { name: 'Lemon', quantity: 2, unit: 'pieces', category: 'produce', expiry_date: tomorrowPlus(7) },
    { name: 'Butter', quantity: 200, unit: 'g', category: 'dairy', expiry_date: tomorrowPlus(30) },
    { name: 'Parmesan', quantity: 100, unit: 'g', category: 'dairy', expiry_date: tomorrowPlus(10) },
    { name: 'Canned tomatoes', quantity: 400, unit: 'g', category: 'canned', expiry_date: null },
    { name: 'Black beans', quantity: 400, unit: 'g', category: 'canned', expiry_date: null },
    { name: 'Cumin', quantity: 50, unit: 'g', category: 'spices', expiry_date: null },
    { name: 'Paprika', quantity: 40, unit: 'g', category: 'spices', expiry_date: null },
    { name: 'Salt', quantity: 500, unit: 'g', category: 'spices', expiry_date: null },
    { name: 'Black pepper', quantity: 30, unit: 'g', category: 'spices', expiry_date: null },
    { name: 'Broccoli', quantity: 300, unit: 'g', category: 'produce', expiry_date: tomorrowPlus(5) },
  ];

  const insertMany = db.transaction((rows: typeof items) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(items);
  console.log(`Seeded ${items.length} inventory items.`);
}

function tomorrowPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
