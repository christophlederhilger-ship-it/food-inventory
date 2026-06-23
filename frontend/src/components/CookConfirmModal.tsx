import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cookRecipe, Recipe } from '../api';

interface Props {
  recipe: Recipe;
  historyId: number;
  onClose: () => void;
  onCooked: () => void;
}

export default function CookConfirmModal({ recipe, historyId, onClose, onCooked }: Props) {
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ decremented: { name: string; removed: number; remaining: number }[]; skipped: string[] } | null>(null);

  const cookMut = useMutation({
    mutationFn: () => cookRecipe(historyId),
    onSuccess: data => {
      setResult(data);
      setDone(true);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {!done ? (
          <>
            <div className="px-6 pt-6 pb-4">
              <h2 className="text-lg font-bold text-gray-900">Ready to cook?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Cooking <span className="font-medium text-gray-700">{recipe.title}</span> will subtract these ingredients from your pantry:
              </p>
              <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{ing.name}</span>
                    <span className="text-gray-400">
                      {ing.amount ? `−${ing.amount}${ing.unit ? ' ' + ing.unit : ''}` : '−1 serving'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => cookMut.mutate()}
                disabled={cookMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                {cookMut.isPending ? 'Cooking...' : "Let's Cook! 🍳"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-6 pb-4">
              <div className="text-center text-4xl mb-3">✅</div>
              <h2 className="text-lg font-bold text-gray-900 text-center">Enjoy your meal!</h2>
              <p className="text-sm text-gray-500 text-center mt-1">Pantry updated:</p>
              {result && (
                <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto">
                  {result.decremented.map((d, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{d.name}</span>
                      <span className="text-gray-400">
                        −{d.removed} → {d.remaining} left
                      </span>
                    </li>
                  ))}
                  {result.skipped.map((s, i) => (
                    <li key={`sk${i}`} className="flex justify-between text-sm">
                      <span className="text-gray-400 line-through">{s}</span>
                      <span className="text-gray-300 text-xs">not in pantry</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={onCooked}
                className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
