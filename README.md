# Pantry & Recipe

A home food inventory manager with daily AI-powered recipe suggestions.

## Features

- **Pantry Management** — Add, edit, and delete items with quantity, unit, category, and expiry date. Expiring-soon items are highlighted.
- **Recipe of the Day** — Uses Claude (via Anthropic API) with web search to find a real, highly-rated recipe (≤30 min, nutritionally complete) based on what's in your pantry.
- **Shopping List** — See which ingredients you have vs. need; mark items bought to automatically add them to your pantry.
- **Cook It** — Confirmation modal shows what will be subtracted from your pantry. One click decrements quantities and logs the recipe.
- **Recipe History** — Keeps track of suggested and cooked recipes to avoid repeats.

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY
npm install
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies API calls to the backend at `http://localhost:3001`.

## Project Structure

```
food-inventory/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.ts       # SQLite schema + singleton
│   │   │   └── seed.ts         # Seed data (20 items)
│   │   ├── services/
│   │   │   ├── recipeEngine.ts     # Anthropic API + web_search
│   │   │   ├── ingredientMatcher.ts # Fuzzy presence-based matching
│   │   │   └── inventoryDecrement.ts
│   │   ├── routes/
│   │   │   ├── inventory.ts
│   │   │   ├── recipe.ts
│   │   │   └── shopping.ts
│   │   └── index.ts            # Express server
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── RecipeCard.tsx
    │   │   ├── InventoryList.tsx
    │   │   ├── CookConfirmModal.tsx
    │   │   └── RecipeHistory.tsx
    │   ├── api.ts              # Typed fetch client
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

## Environment Variables

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |
| `PORT` | Backend port (default: 3001) |

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Backend**: Node.js, Express, TypeScript, tsx
- **Database**: SQLite via better-sqlite3
- **AI**: Anthropic SDK (`claude-opus-4-8`) with `web_search` tool
