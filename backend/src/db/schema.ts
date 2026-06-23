import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../data/inventory.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      quantity    REAL    NOT NULL DEFAULT 0,
      unit        TEXT    NOT NULL DEFAULT 'pieces',
      category    TEXT    NOT NULL DEFAULT 'other',
      expiry_date TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recipe_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT    NOT NULL,
      title        TEXT    NOT NULL,
      source_url   TEXT,
      rating       TEXT,
      total_time   INTEGER,
      servings     INTEGER,
      ingredients  TEXT    NOT NULL,
      instructions TEXT    NOT NULL,
      nutrition_note TEXT,
      cooked       INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS shopping_list (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id       INTEGER REFERENCES recipe_history(id) ON DELETE CASCADE,
      ingredient_name TEXT    NOT NULL,
      amount          TEXT,
      unit            TEXT,
      bought          INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_inventory_name     ON inventory_items(name);
    CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
    CREATE INDEX IF NOT EXISTS idx_recipe_date        ON recipe_history(date);
  `);
}
