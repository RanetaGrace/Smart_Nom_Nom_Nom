import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Ingredient } from '../types';
import { INGREDIENT_TYPES, COMMON_UNITS } from '../types';

export function IngredientsManager() {
  const ingredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'Other',
    family: '',
    subcategory: '',
    preferredUnit: 'g',
  });
  const [saving, setSaving] = useState(false);

  const filtered = (ingredients ?? []).filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.family.toLowerCase().includes(search.toLowerCase())
  );

  function startEdit(ing: Ingredient) {
    setEditing(ing);
    setForm({
      name: ing.name,
      type: ing.type || 'Other',
      family: ing.family || '',
      subcategory: ing.subcategory || '',
      preferredUnit: ing.preferredUnit || 'g',
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !form.name.trim()) return;
    setSaving(true);
    try {
      await db.ingredients.update(editing.id, {
        name: form.name.trim(),
        type: form.type,
        family: form.family.trim() || form.name.trim(),
        subcategory: form.subcategory.trim(),
        preferredUnit: form.preferredUnit,
        updatedAt: new Date().toISOString(),
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function deleteIngredient(ing: Ingredient) {
    if (!confirm(`Delete "${ing.name}"? Recipes and meals that use it will keep the ID but show as unknown until fixed.`)) {
      return;
    }
    await db.ingredients.delete(ing.id);
    if (editing?.id === ing.id) setEditing(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to="/settings" className="text-sm text-slate-500">← Settings</Link>
          <h2 className="text-xl font-semibold text-slate-800 mt-1">Ingredients</h2>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search ingredients…"
        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
      />

      <p className="text-sm text-slate-500">
        {(ingredients ?? []).length} ingredient{(ingredients ?? []).length !== 1 ? 's' : ''}
      </p>

      {/* Edit form */}
      {editing && (
        <form onSubmit={saveEdit} className="p-4 bg-white rounded-xl border border-emerald-200 space-y-3">
          <div className="font-medium text-slate-800">Edit ingredient</div>
          <p className="text-[11px] text-slate-500">
            Type = group (Meat and Poultry) · Family = food (Chicken) · Subcategory = form (Breast)
          </p>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Name"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {INGREDIENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="text"
              value={form.family}
              onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Family"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={form.subcategory}
              onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="Subcategory"
            />
            <select
              value={form.preferredUnit}
              onChange={(e) => setForm((f) => ({ ...f, preferredUnit: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm text-slate-600">
              Cancel
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-1.5">
        {filtered.map((ing) => (
          <li
            key={ing.id}
            className="flex items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-800 truncate">{ing.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {ing.type}
                {ing.family ? ` · ${ing.family}` : ''}
                {ing.subcategory ? ` · ${ing.subcategory}` : ''}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => startEdit(ing)}
                className="text-sm text-emerald-600"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => deleteIngredient(ing)}
                className="text-sm text-red-500"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="text-center text-slate-500 py-8 text-sm">
          {search ? 'No matches.' : 'No ingredients yet. Create some from Recipes or Inventory.'}
        </p>
      )}
    </div>
  );
}
