import { useState } from 'react';
import RecipeCard from './components/RecipeCard';
import InventoryList from './components/InventoryList';
import RecipeHistory from './components/RecipeHistory';

type Tab = 'home' | 'inventory' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-700">🥗 Pantry & Recipe</h1>
          <nav className="flex gap-1">
            {(['home', 'inventory', 'history'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === t
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t === 'home' ? 'Recipe' : t === 'inventory' ? 'Pantry' : 'History'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {tab === 'home' && <RecipeCard />}
        {tab === 'inventory' && <InventoryList />}
        {tab === 'history' && <RecipeHistory />}
      </main>
    </div>
  );
}
