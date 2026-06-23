import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  searchInventory,
  InventoryItem,
} from '../api';

const CATEGORIES = ['protein', 'produce', 'dairy', 'grains', 'canned', 'spices', 'condiments', 'other'];
const UNITS = ['g', 'kg', 'ml', 'L', 'pieces', 'cups', 'tbsp', 'tsp', 'cloves', 'cans', 'slices'];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function InventoryList() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: fetchInventory,
  });

  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'expiry' | 'category'>('category');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const deleteMut = useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InventoryItem> }) =>
      updateInventoryItem(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      setEditingId(null);
    },
  });

  const filtered = items
    .filter(i => !filterCategory || i.category === filterCategory)
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'expiry') {
        const da = a.expiry_date || '9999';
        const db = b.expiry_date || '9999';
        return da.localeCompare(db);
      }
      return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });

  if (isLoading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Loading pantry...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="category">Sort: Category</option>
          <option value="name">Sort: Name</option>
          <option value="expiry">Sort: Expiry</option>
        </select>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="ml-auto bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-green-700"
        >
          + Add Item
        </button>
      </div>

      {showAdd && (
        <QuickAdd
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ['inventory'] });
            setShowAdd(false);
          }}
        />
      )}

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-10">No items found.</p>
        )}
        {filtered.map(item => {
          const days = daysUntil(item.expiry_date);
          const expiringSoon = days !== null && days <= 3;
          const expired = days !== null && days < 0;

          if (editingId === item.id) {
            return (
              <EditRow
                key={item.id}
                item={item}
                onSave={data => updateMut.mutate({ id: item.id, data })}
                onCancel={() => setEditingId(null)}
              />
            );
          }

          return (
            <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${expired ? 'bg-red-50' : expiringSoon ? 'bg-amber-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">
                  {item.quantity} {item.unit}
                  {item.expiry_date && (
                    <span className={`ml-2 ${expired ? 'text-red-600 font-medium' : expiringSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                      {expired ? '⚠ Expired' : `Exp. in ${days}d`}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{item.category}</span>
              <button
                onClick={() => setEditingId(item.id)}
                className="text-gray-400 hover:text-gray-600 text-sm px-1"
              >
                ✏️
              </button>
              <button
                onClick={() => deleteMut.mutate(item.id)}
                className="text-gray-400 hover:text-red-500 text-sm px-1"
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickAdd({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pieces');
  const [category, setCategory] = useState('other');
  const [expiry, setExpiry] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; unit: string; category: string }[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addMut = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: onAdded,
  });

  const onNameChange = (v: string) => {
    setName(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (v.length > 1) {
        const res = await searchInventory(v);
        setSuggestions(res);
      } else {
        setSuggestions([]);
      }
    }, 200);
  };

  const applySuggestion = (s: { name: string; unit: string; category: string }) => {
    setName(s.name);
    setUnit(s.unit);
    setCategory(s.category);
    setSuggestions([]);
  };

  return (
    <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">Add Item</h3>
      <div className="relative">
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Item name"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={i}
                onClick={() => applySuggestion(s)}
                className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
              >
                {s.name} <span className="text-gray-400 text-xs">({s.category})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={quantity}
          onChange={e => setQuantity(e.target.value)}
          min="0"
          className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
        >
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input
        type="date"
        value={expiry}
        onChange={e => setExpiry(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        placeholder="Expiry date (optional)"
      />
      <button
        onClick={() =>
          addMut.mutate({
            name,
            quantity: parseFloat(quantity) || 0,
            unit,
            category,
            expiry_date: expiry || null,
          })
        }
        disabled={!name || addMut.isPending}
        className="w-full bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
      >
        {addMut.isPending ? 'Adding...' : 'Add to Pantry'}
      </button>
    </div>
  );
}

function EditRow({
  item,
  onSave,
  onCancel,
}: {
  item: InventoryItem;
  onSave: (data: Partial<InventoryItem>) => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState(item.unit);
  const [expiry, setExpiry] = useState(item.expiry_date || '');

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-green-50">
      <span className="text-sm font-medium text-gray-700 flex-1">{item.name}</span>
      <input
        type="number"
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        className="w-16 border border-gray-200 rounded px-2 py-1 text-sm"
      />
      <select
        value={unit}
        onChange={e => setUnit(e.target.value)}
        className="border border-gray-200 rounded px-1 py-1 text-sm"
      >
        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
      <input
        type="date"
        value={expiry}
        onChange={e => setExpiry(e.target.value)}
        className="border border-gray-200 rounded px-2 py-1 text-sm"
      />
      <button
        onClick={() =>
          onSave({ quantity: parseFloat(quantity), unit, expiry_date: expiry || null })
        }
        className="text-green-600 font-medium text-sm"
      >
        Save
      </button>
      <button onClick={onCancel} className="text-gray-400 text-sm">✕</button>
    </div>
  );
}
