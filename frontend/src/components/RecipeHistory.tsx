import { useQuery } from '@tanstack/react-query';
import { fetchRecipeHistory } from '../api';

export default function RecipeHistory() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['recipe-history'],
    queryFn: fetchRecipeHistory,
  });

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Loading history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="py-16 text-center text-gray-400">
        <p className="text-3xl mb-2">📖</p>
        <p className="text-sm">No recipe history yet. Cook something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-700">Recent Recipes</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {history.map(entry => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{entry.title}</p>
              <p className="text-xs text-gray-400">
                {entry.date}
                {entry.total_time ? ` · ${entry.total_time} min` : ''}
                {entry.rating ? ` · ${entry.rating}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {entry.cooked ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Cooked ✓</span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Suggested</span>
              )}
              {entry.source_url && (
                <a
                  href={entry.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:underline"
                >
                  View →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
