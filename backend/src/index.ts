import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedIfEmpty } from './db/seed';
import inventoryRouter from './routes/inventory';
import recipeRouter from './routes/recipe';
import shoppingRouter from './routes/shopping';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Initialize DB and seed
seedIfEmpty();

app.use('/api/inventory', inventoryRouter);
app.use('/api/recipe', recipeRouter);
app.use('/api/shopping', shoppingRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
