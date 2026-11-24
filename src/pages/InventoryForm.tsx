import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import type { InventoryBatch, Expiration, Ingredient } from '../types';
import { COMMON_UNITS, STORAGE_LOCATIONS, INGREDIENT_TYPES } from '../types';
import { IngredientSelect } from '../components/IngredientSelect';

export function InventoryForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useLiveQuery(
    () => (isEdit ? db.inventoryBatches.get(id!) : undefined),
    [id, isEdit]
  );
  const allIngredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), []);

  const [mode, setMode] = useState<'ingredient' | 'freetext'>('ingredient');
  const [ingredientId, setIngredientId] = useState('');
  const [freeTextName, setFreeTextName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('g');
  const [location, setLocation] = useState('Refrigerator');
  const [expType, setExpType] = useState<'date' | 'unknown' | 'na'>('unknown');
  const [expDate, setExpDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      if (existing.ingredientId) {
        setMode('ingredient');
        setIngredientId(existing.ingredientId);
      } else {
        setMode('freetext');
        setFreeTextName(existing.freeTextName || '');
      }
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

    if (mode === 'ingredient' && !ingredientId) {
      setError('Select or create an ingredient');
      return;
    }
    if (mode === 'freetext' && !freeTextName.trim()) {
      setError('Enter a name for this item');
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
        ingredientId: mode === 'ingredient' ? ingredientId : null,
        freeTextName: mode === 'freetext' ? freeTextName.trim() : undefined,
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
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && existing === undefined) {
    return <p className="text-slate-500">Loading...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">
          {isEdit ? 'Edit Batch' : 'Add to Inventory'}
        </h2>
        <button type="button" onClick={() => navigate('/inventory')} className="text-sm text-slate-500">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('ingredient')}
              className={`flex-1 py-2.5 text-sm rounded-lg border font-medium ${
                mode === 'ingredient' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              From Ingredients
            </button>
            <button
              type="button"
              onClick={() => setMode('freetext')}
              className={`flex-1 py-2.5 text-sm rounded-lg border font-medium ${
                mode === 'freetext' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              Free-text / Leftovers
            </button>
          </div>
        )}

        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          {mode === 'ingredient' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">Ingredient *</label>
                <button type="button" onClick={() => setShowNewIngredient(true)} className="text-sm text-emerald-600">
                  + New
                </button>
              </div>
              <IngredientSelect
                ingredients={allIngredients ?? []}
                value={ingredientId}
                onChange={setIngredientId}
                placeholder="Type to search…"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item name *</label>
              <input
                type="text"
                value={freeTextName}
                onChange={(e) => setFreeTextName(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                placeholder="e.g. Leftover chili, Opened salsa"
                required={mode === 'freetext'}
              />
            </div>
          )}

          {showNewIngredient && mode === 'ingredient' && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="text-sm font-medium">New ingredient</div>
              <p className="text-[11px] text-slate-500">Type = group · Family = food · Subcategory = form</p>
              <input
                type="text"
                placeholder="Name *"
                value={newIng.name}
                onChange={(e) => setNewIng((n) => ({ ...n, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select value={newIng.type} onChange={(e) => setNewIng((n) => ({ ...n, type: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                  {INGREDIENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" placeholder="Family" value={newIng.family} onChange={(e) => setNewIng((n) => ({ ...n, family: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleCreateIngredient} className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg">Save</button>
                <button type="button" onClick={() => setShowNewIngredient(false)} className="px-3 py-1.5 text-sm text-slate-600">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
              <input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm">
                {COMMON_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
            <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm">
              {STORAGE_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Expiration</label>
            <div className="flex flex-wrap gap-3 mb-2">
              {(['date', 'unknown', 'na'] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name="expType" checked={expType === t} onChange={() => setExpType(t)} className="text-emerald-600" />
                  {t === 'date' ? 'Date' : t === 'unknown' ? 'Unknown' : 'N/A'}
                </label>
              ))}
            </div>
            {expType === 'date' && (
              <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" placeholder="Optional" />
          </div>
        </section>

        <button type="submit" disabled={saving} className="w-full py-3.5 bg-emerald-600 text-white font-medium rounded-xl disabled:opacity-50">
          {saving ? 'Saving…' : isEdit ? 'Update' : 'Add to Inventory'}
        </button>
      </form>
    </div>
  );
}
