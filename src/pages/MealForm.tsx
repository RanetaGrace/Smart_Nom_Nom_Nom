import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import type { PlannedMeal, PlannedIngredient, Ingredient, MealType, InventoryBatch } from '../types';
import { COMMON_UNITS, INGREDIENT_TYPES, MEAL_TYPE_LABELS } from '../types';
import { IngredientSelect } from '../components/IngredientSelect';
import { formatQuantity, convertQuantity } from '../utils/units';

type FormIngredient = PlannedIngredient & {
  tempId: string;
  displayName?: string;
  fromBatchId?: string;
  availableQty?: number;
  availableUnit?: string;
};

export function MealForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const existing = useLiveQuery(
    () => (isEdit ? db.plannedMeals.get(id!) : undefined),
    [id, isEdit]
  );
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []);
  const allIngredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), []);
  const batches = useLiveQuery(() => db.inventoryBatches.toArray(), []);

  const prefilledDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<'recipe' | 'freetext'>('recipe');
  const [date, setDate] = useState(prefilledDate);
  const [recipeId, setRecipeId] = useState('');
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(4);
  const [mealType, setMealType] = useState<MealType>('');
  const [ingredients, setIngredients] = useState<FormIngredient[]>([]);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPickInventory, setShowPickInventory] = useState(false);

  const [showNewIngredient, setShowNewIngredient] = useState(false);
  const [newIng, setNewIng] = useState({
    name: '',
    type: 'Other',
    family: '',
    subcategory: '',
    preferredUnit: 'g',
  });

  const ingredientMap = new Map((allIngredients ?? []).map((i) => [i.id, i]));

  useEffect(() => {
    if (existing) {
      setDate(existing.date);
      setRecipeId(existing.recipeId || '');
      setTitle(existing.title);
      setServings(existing.servings);
      setMealType((existing.mealType as MealType) || '');
      setIngredients(
        existing.ingredients.map((ing, i) => ({
          ...ing,
          tempId: `existing-${i}`,
          displayName: ingredientMap.get(ing.ingredientId)?.name,
        }))
      );
      setNotes(existing.notes || '');
      setNotesOpen(Boolean(existing.notes));
      setMode(existing.recipeId ? 'recipe' : 'freetext');
    }
  }, [existing]);

  function batchLabel(b: InventoryBatch): string {
    if (b.freeTextName) return b.freeTextName;
    return ingredientMap.get(b.ingredientId || '')?.name ?? 'Unknown';
  }

  function handleSelectRecipe(rid: string) {
    setRecipeId(rid);
    const recipe = (recipes ?? []).find((r) => r.id === rid);
    if (recipe) {
      setTitle(recipe.name);
      setServings(recipe.servings);
      setIngredients(
        recipe.ingredients.map((ing, i) => ({
          ...ing,
          tempId: `from-recipe-${i}`,
          displayName: ingredientMap.get(ing.ingredientId)?.name,
        }))
      );
    }
  }

  function addIngredientRow() {
    setIngredients((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ingredientId: '',
        quantity: 1,
        unit: 'g',
        note: '',
      },
    ]);
  }

  function updateIngredientRow(tempId: string, field: string, value: string | number) {
    setIngredients((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  }

  function removeIngredientRow(tempId: string) {
    setIngredients((prev) => prev.filter((row) => row.tempId !== tempId));
  }

  function addFromInventory(batch: InventoryBatch) {
    const name = batchLabel(batch);
    // For free-text batches without ingredientId, use a placeholder id pattern
    // PlannedIngredient requires ingredientId — for free-text we still need an id.
    // Use empty and store name in note/display; on save we'll create or skip formal id.
    // Better: if free-text, ensure we have a way. For planned meals, ingredientId is required
    // in type. We'll use ingredientId if present; for free-text create a synthetic note.
    setIngredients((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ingredientId: batch.ingredientId || `inventory:${batch.id}`,
        quantity: batch.quantity,
        unit: batch.unit,
        note: batch.freeTextName ? `From inventory: ${batch.freeTextName}` : 'From inventory',
        displayName: name,
        fromBatchId: batch.id,
        availableQty: batch.quantity,
        availableUnit: batch.unit,
      },
    ]);
    setShowPickInventory(false);
    setError('');
  }

  function checkInventoryOverages(): string | null {
    for (const row of ingredients) {
      if (!row.fromBatchId || row.availableQty == null) continue;
      const qty = Number(row.quantity) || 0;
      if (row.unit === row.availableUnit) {
        if (qty > row.availableQty + 0.0001) {
          return `"${row.displayName || 'Item'}" needs ${formatQuantity(qty, row.unit)} but inventory only has ${formatQuantity(row.availableQty, row.availableUnit)}.`;
        }
      } else {
        const neededInAvailable = convertQuantity(qty, row.unit, row.availableUnit!);
        if (neededInAvailable !== null && neededInAvailable > row.availableQty + 0.0001) {
          return `"${row.displayName || 'Item'}" needs ${formatQuantity(qty, row.unit)} but inventory only has ${formatQuantity(row.availableQty, row.availableUnit!)}.`;
        }
        if (neededInAvailable === null && qty > row.availableQty) {
          return `"${row.displayName || 'Item'}": quantity may exceed inventory (units differ). Available: ${formatQuantity(row.availableQty, row.availableUnit!)}.`;
        }
      }
    }
    return null;
  }

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

    setIngredients((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ingredientId: newId,
        quantity: 1,
        unit: newIng.preferredUnit || 'g',
        note: '',
        displayName: ingredient.name,
      },
    ]);

    setShowNewIngredient(false);
    setNewIng({ name: '', type: 'Other', family: '', subcategory: '', preferredUnit: 'g' });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    // Validate inventory overages
    const overage = checkInventoryOverages();
    if (overage) {
      setError(overage);
      return;
    }

    // Rows must have ingredientId (or inventory-linked)
    if (ingredients.some((ing) => !ing.ingredientId)) {
      setError('Every ingredient row must select an ingredient or come from inventory');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();

      // For inventory free-text items (ingredientId starts with inventory:),
      // we keep the synthetic id in the planned meal for reference; grocery
      // calculation already handles known ingredient IDs. Free-text inventory
      // links are mainly for your planning + overage alerts.
      const plannedIngredients: PlannedIngredient[] = ingredients.map(
        ({ ingredientId, quantity, unit, note }) => ({
          ingredientId,
          quantity: Number(quantity) || 0,
          unit,
          note: note || undefined,
        })
      );

      const payload: PlannedMeal = {
        id: isEdit ? id! : await nextId('meal'),
        date,
        recipeId: mode === 'recipe' && recipeId ? recipeId : null,
        title: title.trim(),
        servings: Number(servings) || 1,
        ingredients: plannedIngredients,
        mealType: mealType || undefined,
        notes: notes.trim() || undefined,
        status: isEdit && existing?.status ? existing.status : 'planned',
        createdAt: isEdit && existing ? existing.createdAt : now,
        updatedAt: now,
      };

      if (isEdit) {
        await db.plannedMeals.put(payload);
      } else {
        await db.plannedMeals.add(payload);
      }

      navigate('/meal-plan');
    } catch (err) {
      console.error(err);
      setError('Failed to save meal');
    } finally {
      setSaving(false);
    }
  }

  if (isEdit && existing === undefined) {
    return <p className="text-slate-500">Loading...</p>;
  }

  const availableBatches = (batches ?? []).filter((b) => b.quantity > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">
          {isEdit ? 'Edit Meal' : 'Add Meal'}
        </h2>
        <button type="button" onClick={() => navigate('/meal-plan')} className="text-sm text-slate-500">
          Cancel
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 overflow-hidden">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full max-w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm box-border"
              required
            />
          </div>

          {!isEdit && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('recipe')}
                className={`flex-1 py-2.5 text-sm rounded-lg border font-medium ${
                  mode === 'recipe'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                From Recipe
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('freetext');
                  setRecipeId('');
                  setTitle('');
                  setIngredients([]);
                }}
                className={`flex-1 py-2.5 text-sm rounded-lg border font-medium ${
                  mode === 'freetext'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Free-text
              </button>
            </div>
          )}

          {mode === 'recipe' && !isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Recipe</label>
              <select
                value={recipeId}
                onChange={(e) => handleSelectRecipe(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Select a recipe…</option>
                {(recipes ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
              placeholder="e.g. Chicken Curry or Leftover lentils"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Servings</label>
              <input
                type="number"
                min={1}
                step={1}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value) || 1)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">Optional</option>
                {Object.entries(MEAL_TYPE_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{code} – {label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Ingredients */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-medium text-slate-800">Ingredients</h3>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setShowPickInventory(true)} className="text-sm text-emerald-600 font-medium">
                + From inventory
              </button>
              <button type="button" onClick={() => setShowNewIngredient(true)} className="text-sm text-emerald-600 font-medium">
                + New
              </button>
              <button type="button" onClick={addIngredientRow} className="text-sm text-emerald-600 font-medium">
                + Row
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Add from your ingredient list or from current inventory (including leftovers).
          </p>

          {showPickInventory && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-sm font-medium text-slate-800">Pick from inventory</div>
              {availableBatches.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing in inventory with quantity &gt; 0.</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto space-y-1">
                  {availableBatches.map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => addFromInventory(b)}
                        className="w-full text-left px-2 py-2 text-sm rounded-lg hover:bg-emerald-50"
                      >
                        <span className="font-medium">{batchLabel(b)}</span>
                        <span className="text-slate-500 ml-1">
                          {formatQuantity(b.quantity, b.unit)} · {b.location}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => setShowPickInventory(false)} className="text-sm text-slate-500">
                Cancel
              </button>
            </div>
          )}

          {showNewIngredient && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="text-sm font-medium text-slate-700">New ingredient</div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Type = broad group · Family = the food · Subcategory = form
              </p>
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
                    <option key={t} value={t}>{t}</option>
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
              <div className="flex gap-2">
                <button type="button" onClick={handleCreateIngredient} className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg">
                  Save
                </button>
                <button type="button" onClick={() => setShowNewIngredient(false)} className="px-3 py-1.5 text-sm text-slate-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {ingredients.length === 0 && (
            <p className="text-sm text-slate-500">No ingredients yet.</p>
          )}

          <div className="space-y-2">
            {ingredients.map((row) => (
              <div key={row.tempId} className="flex flex-wrap gap-2 items-start">
                {row.fromBatchId ? (
                  <div className="flex-1 min-w-[120px] px-2.5 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                    {row.displayName || 'Inventory item'}
                    {row.availableQty != null && (
                      <span className="text-xs text-slate-500 ml-1">
                        (have {formatQuantity(row.availableQty, row.availableUnit || row.unit)})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-w-[120px]">
                    <IngredientSelect
                      ingredients={allIngredients ?? []}
                      value={row.ingredientId.startsWith('inventory:') ? '' : row.ingredientId}
                      onChange={(id) => updateIngredientRow(row.tempId, 'ingredientId', id)}
                      placeholder="Type to search…"
                    />
                  </div>
                )}
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={row.quantity}
                  onChange={(e) => updateIngredientRow(row.tempId, 'quantity', e.target.value)}
                  className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <select
                  value={row.unit}
                  onChange={(e) => updateIngredientRow(row.tempId, 'unit', e.target.value)}
                  className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeIngredientRow(row.tempId)}
                  className="px-2 py-2 text-red-500 text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <span className="font-medium text-slate-800">Notes / Event</span>
            <span className="text-slate-400 text-sm">{notesOpen ? '▲' : '▼'}</span>
          </button>
          {notesOpen && (
            <div className="px-4 pb-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Event, special instructions…"
              />
            </div>
          )}
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-emerald-600 text-white font-medium rounded-xl disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Update Meal' : 'Add to Meal Plan'}
        </button>
      </form>
    </div>
  );
}
