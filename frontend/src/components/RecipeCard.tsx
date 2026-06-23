import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchRecipeSuggestion,
  refreshRecipeSuggestion,
  generateShoppingList,
  fetchShoppingList,
  markItemBought,
} from '../api';
import CookConfirmModal from './CookConfirmModal';

export default function RecipeCard() {
  const qc = useQueryClient();
  const [showShopping, setShowShopping] = useState(false);
  const [showCookModal, setShowCookModal] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['recipe-suggest'],
    queryFn: fetchRecipeSuggestion,
    staleTime: 1000 * 60 * 60, // 1 hour — rely on today's cache
  });

  const refreshMut = useMutation({
    mutationFn: refreshRecipeSuggestion,
    onSuccess: result => {
      qc.setQueryData(['recipe-suggest'], result);
      setShowShopping(false);
    },
  });

  const genShoppingMut = useMutation({
    mutationFn: () =>
      generateShoppingList(
        data!.historyId!,
        (data!.missing || []).map(name => ({ name })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping', data?.historyId] });
      setShowShopping(true);
    },
  });

  const { data: shoppingItems } = useQuery({
    queryKey: ['shopping', data?.historyId],
    queryFn: () => fetchShoppingList(data!.historyId!),
    enabled: showShopping && !!data?.historyId,
  });

  const buyMut = useMutation({
    mutationFn: (itemId: number) => markItemBought(itemId, { addToInventory: true, quantity: 1 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping', data?.historyId] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Finding today's recipe...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">Could not load recipe</p>
        <p className="text-red-500 text-sm mt-1">{(error as Error).message}</p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['recipe-suggest'] })}
          className="mt-3 text-sm text-red-600 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const { recipe, have = [], missing = [], historyId } = data || {};

  if (!recipe) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-3">🤷</p>
        <p className="font-medium">No recipe suggestion available</p>
        <p className="text-sm mt-1">Add items to your pantry to get started.</p>
        <button
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Try anyway
        </button>
      </div>
    );
  }

  const matchPct = have.length + missing.length > 0
    ? Math.round((have.length / (have.length + missing.length)) * 100)
    : 100;

  return (
    <div className="space-y-4">
      {/* Recipe card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-4">
          <p className="text-green-100 text-xs font-medium uppercase tracking-wide mb-1">Recipe of the Day</p>
          <h2 className="text-white text-xl font-bold leading-snug">{recipe.title}</h2>
          <div className="flex flex-wrap gap-3 mt-2">
            {recipe.rating && (
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                ⭐ {recipe.rating}
              </span>
            )}
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              ⏱ {recipe.total_time} min
            </span>
            <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
              🍽 {recipe.servings} servings
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Ingredient match bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Pantry match</span>
              <span className="font-medium text-gray-700">{have.length}/{have.length + missing.length} ingredients</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${matchPct}%` }}
              />
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingredients</h3>
            <div className="flex flex-wrap gap-1.5">
              {recipe.ingredients.map((ing, i) => {
                const inPantry = have.includes(ing.name);
                return (
                  <span
                    key={i}
                    className={`text-xs px-2 py-1 rounded-full border ${
                      inPantry
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {inPantry ? '✓' : '✕'} {ing.name}
                    {ing.amount ? ` (${ing.amount}${ing.unit ? ' ' + ing.unit : ''})` : ''}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h3>
            <ol className="space-y-2">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="flex-shrink-0 w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span>{step.replace(/^Step \d+:\s*/i, '')}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Nutrition */}
          {recipe.nutrition_note && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
              <span className="font-medium">Nutrition: </span>{recipe.nutrition_note}
            </div>
          )}

          {recipe.nutrition_breakdown && (
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(recipe.nutrition_breakdown).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400 capitalize">{k}</p>
                  <p className="text-xs font-semibold text-gray-700">{v}</p>
                </div>
              ))}
            </div>
          )}

          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 hover:underline"
            >
              View original recipe →
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setShowCookModal(true)}
            className="flex-1 min-w-[120px] bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-colors"
          >
            Cook It! 🍳
          </button>
          {missing.length > 0 && (
            <button
              onClick={() => genShoppingMut.mutate()}
              disabled={genShoppingMut.isPending}
              className="flex-1 min-w-[120px] bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2.5 px-4 rounded-xl text-sm border border-blue-200 transition-colors disabled:opacity-50"
            >
              {showShopping ? 'Refresh List' : `Shopping List (${missing.length})`}
            </button>
          )}
          <button
            onClick={() => refreshMut.mutate()}
            disabled={refreshMut.isPending}
            className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium py-2.5 px-4 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {refreshMut.isPending ? '...' : 'Suggest Another'}
          </button>
        </div>
      </div>

      {/* Shopping list */}
      {showShopping && shoppingItems && shoppingItems.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">Shopping List</h3>
          <ul className="space-y-2">
            {shoppingItems.map(item => (
              <li key={item.id} className="flex items-center gap-3">
                <button
                  onClick={() => buyMut.mutate(item.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    item.bought
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                >
                  {item.bought ? '✓' : ''}
                </button>
                <span className={`text-sm ${item.bought ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {item.ingredient_name}
                  {item.amount ? ` — ${item.amount}${item.unit ? ' ' + item.unit : ''}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cook confirmation modal */}
      {showCookModal && historyId && (
        <CookConfirmModal
          recipe={recipe}
          historyId={historyId}
          onClose={() => setShowCookModal(false)}
          onCooked={() => {
            setShowCookModal(false);
            qc.invalidateQueries({ queryKey: ['inventory'] });
            qc.invalidateQueries({ queryKey: ['recipe-history'] });
            refreshMut.mutate();
          }}
        />
      )}
    </div>
  );
}
