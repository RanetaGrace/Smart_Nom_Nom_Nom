import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import type { InventoryBatch, Expiration, Ingredient } from '../types';
import { COMMON_UNITS, STORAGE_LOCATIONS, INGREDIENT_TYPES } from '../types';

export function InventoryForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useLiveQuery(
    () => (isEdit ? db.inventoryBatches.get(id!) : undefined),
    [id, isEdit]
  );
  const allIngredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), []);

  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('g');
  const [location, setLocation] = useState('Refrigerator');
  const [expType, setExpType] = useState<'date' | 'unknown' | 'na'>('unknown');
  const [expDate, setExpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Inline new ingredient
  const [showNewIngredient, setShowNewIngredient] = useState(false);
  const [newIng, setNewIng] = useState({
    name: '',
    type: 'Other',
    family: '',
    subcategory: '',
    preferredUnit: 'g',
  });

  useEffect(() => {
    if (existing) {
      setIngredientId(existing.ingredientId);
      setQuantity(String(existing.quantity));
      setUnit(existing.unit);
      setLocation(existing.location);
      setExpType(existing.expiration.type);
      setExpDate(existing.expiration.date ?? '');
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  async function handleCreateIngredient() {
    if (!newIng.name.trim()) {
      setError('Ingredient name is required');
      return;
    }
    const newId = await nextId('ingredient');
    const now = new Date().toISOString();
    const ingredient: Ingredient = {
      id: newId,
      name: newIng.name.trim(),
      type: newIng.type,
      family: newIng.family.trim() || newIng.name.trim(),
      subcategory: newIng.subcategory.trim() || '',
      preferredUnit: newIng.preferredUnit,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.ingredients.add(ingredient);
    setIngredientId(newId);
    setUnit(newIng.preferredUnit || 'g');
    setShowNewIngredient(false);
    setNewIng({ name: '', type: 'Other', family: '', subcategory: '', preferredUnit: 'g' });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!ingredientId) {
      setError('Select or create an ingredient');
      return;
    }
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (expType === 'date' && !expDate) {
      setError('Enter an expiration date or choose Unknown / Not applicable');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const expiration: Expiration = {
        type: expType,
        date: expType === 'date' ? expDate : undefined,
      };

      const payload: InventoryBatch = {
        id: isEdit ? id! : await nextId('batch'),
        ingredientId,
        quantity: qty,
        unit,
        location,
        expiration,
        notes: notes.trim() || undefined,
        createdAt: isEdit && existing ? existing.createdAt : now,
        updatedAt: now,
      };

      if (isEdit) {
        await db.inventoryBatches.put(payload);
      } else {
        await db.inventoryBatches.add(payload);
      }

      navigate('/inventory');
    } catch (err) {
      console.error(err);
      setError('Failed to save batch');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && existing === undefined) {
    return <p className="text-slate-500">Loading...</p>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-800">
          {isEdit ? 'Edit Batch' : 'Add Inventory Batch'}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Ingredient *</label>
              <button
                type="button"
                onClick={() => setShowNewIngredient(true)}
                className="text-sm text-emerald-600 hover:underline"
              >
                + New Ingredient
              </button>
            </div>
            <select
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Select ingredient…</option>
              {(allIngredients ?? []).map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.name}
                </option>
              ))}
            </select>
          </div>

          {showNewIngredient && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <div className="text-sm font-medium text-slate-700">Create new ingredient</div>
              <input
                type="text"
                placeholder="Name *"
                value={newIng.name}
                onChange={(e) => setNewIng((n) => ({ ...n, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newIng.type}
                  onChange={(e) => setNewIng((n) => ({ ...n, type: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {INGREDIENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Family (e.g. Chicken)"
                  value={newIng.family}
                  onChange={(e) => setNewIng((n) => ({ ...n, family: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Subcategory"
                  value={newIng.subcategory}
                  onChange={(e) => setNewIng((n) => ({ ...n, subcategory: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <select
                  value={newIng.preferredUnit}
                  onChange={(e) => setNewIng((n) => ({ ...n, preferredUnit: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateIngredient}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg"
                >
                  Save Ingredient
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewIngredient(false)}
                  className="px-3 py-1.5 text-sm text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="any"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {STORAGE_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expiration</label>
            <div className="flex flex-wrap gap-3 mb-2">
              {(['date', 'unknown', 'na'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="expType"
                    checked={expType === t}
                    onChange={() => setExpType(t)}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  {t === 'date' ? 'Date' : t === 'unknown' ? 'Unknown' : 'Not applicable'}
                </label>
              ))}
            </div>
            {expType === 'date' && (
              <input
                type="date"
                value={expDate}
                onChange={(e) => setExpDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Optional"
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : isEdit ? 'Update Batch' : 'Add Batch'}
        </button>
      </form>
    </div>
  );
}
