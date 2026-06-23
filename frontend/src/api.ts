const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Inventory ──────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export const fetchInventory = () => request<InventoryItem[]>('/inventory');

export const createInventoryItem = (data: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at'>) =>
  request<InventoryItem>('/inventory', { method: 'POST', body: JSON.stringify(data) });

export const updateInventoryItem = (id: number, data: Partial<InventoryItem>) =>
  request<InventoryItem>(`/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteInventoryItem = (id: number) =>
  request<{ ok: boolean }>(`/inventory/${id}`, { method: 'DELETE' });

export const searchInventory = (q: string) =>
  request<Pick<InventoryItem, 'name' | 'unit' | 'category'>[]>(`/inventory/search?q=${encodeURIComponent(q)}`);

// ── Recipe ─────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  name: string;
  amount?: string;
  unit?: string;
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
  nutrition_breakdown?: {
    protein?: string;
    carbs?: string;
    fat?: string;
    calories?: string;
  };
}

export interface RecipeResult {
  recipe: Recipe | null;
  have: string[];
  missing: string[];
  historyId?: number;
}

export const fetchRecipeSuggestion = () => request<RecipeResult>('/recipe/suggest');
export const refreshRecipeSuggestion = () =>
  request<RecipeResult>('/recipe/suggest/refresh', { method: 'POST' });

export interface CookResult {
  decremented: { name: string; removed: number; remaining: number }[];
  skipped: string[];
}

export const cookRecipe = (historyId: number) =>
  request<CookResult>(`/recipe/${historyId}/cook`, { method: 'POST' });

export interface RecipeHistoryEntry {
  id: number;
  date: string;
  title: string;
  source_url: string | null;
  rating: string | null;
  total_time: number;
  servings: number;
  cooked: number;
}

export const fetchRecipeHistory = () => request<RecipeHistoryEntry[]>('/recipe/history');

// ── Shopping ───────────────────────────────────────────────────────────────

export interface ShoppingItem {
  id: number;
  recipe_id: number;
  ingredient_name: string;
  amount: string | null;
  unit: string | null;
  bought: number;
}

export const fetchShoppingList = (recipeId: number) =>
  request<ShoppingItem[]>(`/shopping/${recipeId}`);

export const generateShoppingList = (
  recipeId: number,
  missing: RecipeIngredient[],
) =>
  request<ShoppingItem[]>(`/shopping/${recipeId}/generate`, {
    method: 'POST',
    body: JSON.stringify({ missing }),
  });

export const markItemBought = (
  itemId: number,
  opts: { addToInventory?: boolean; quantity?: number; unit?: string; category?: string } = {},
) =>
  request<ShoppingItem>(`/shopping/item/${itemId}/bought`, {
    method: 'PUT',
    body: JSON.stringify(opts),
  });
