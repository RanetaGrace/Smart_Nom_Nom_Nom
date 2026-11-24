import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { db, nextId } from '../db';
import type { PlannedIngredient, Ingredient } from '../types';
import { MEAL_TYPE_LABELS, COMMON_UNITS, INGREDIENT_TYPES } from '../types';
import { convertQuantity } from '../utils/units';

type EditableIng = PlannedIngredient & {
  tempId: string;
  useIt: boolean;
  name?: string; // for display / free-text
  isCustom?: boolean;
};

export function MealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const meal = useLiveQuery(() => db.plannedMeals.get(id!), [id]);
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), []);
  const batches = useLiveQuery(() => db.inventoryBatches.toArray(), []);
  const recipe = useLiveQuery(
    () => (meal?.recipeId ? db.recipes.get(meal.recipeId) : undefined),
    [meal?.recipeId]
  );

  const [confirmMode, setConfirmMode] = useState<'eaten' | 'skipped' | null>(null);
  const [editableIngs, setEditableIngs] = useState<EditableIng[]>([]);
  const [saving, setSaving] = useState(false);

  // Add custom ingredient in confirm
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customUnit, setCustomUnit] = useState('g');

  if (meal === undefined) {
    return <p className="text-slate-500">Loading...</p>;
  }

  if (!meal) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Meal not found.</p>
        <Link to="/meal-plan" className="text-emerald-600">Back to Meal Plan</Link>
      </div>
    );
  }

  const ingredientMap = new Map((ingredients ?? []).map((i) => [i.id, i]));

  function openConfirm(mode: 'eaten' | 'skipped') {
    setEditableIngs(
      meal!.ingredients.map((ing, i) => ({
        ...ing,
        tempId: `c-${i}`,
        useIt: mode === 'eaten',
        name: ingredientMap.get(ing.ingredientId)?.name,
      }))
    );
    setShowAddCustom(false);
    setConfirmMode(mode);
  }

  function updateEditable(tempId: string, field: string, value: string | number | boolean) {
    setEditableIngs((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row))
    );
  }

  function addCustomToList() {
    if (!customName.trim()) return;
    setEditableIngs((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ingredientId: '', // will create or use free-text
        quantity: parseFloat(customQty) || 1,
        unit: customUnit,
        useIt: true,
        name: customName.trim(),
        isCustom: true,
      },
    ]);
    setCustomName('');
    setCustomQty('1');
    setShowAddCustom(false);
  }

  async function subtractFromInventory(ings: EditableIng[]) {
    const toUse = ings.filter((i) => i.useIt && i.quantity > 0);
    if (toUse.length === 0) return;

    const allBatches = batches ?? [];
    const now = new Date().toISOString();

    for (const ing of toUse) {
      // Custom items without ingredientId → create free-text inventory reduction
      // by adding a negative-style note isn't ideal; instead create a free-text
      // batch with 0 or just skip formal subtraction and log as free-text usage.
      // Practical approach: if custom, create/find free-text and reduce or add usage note.
      // For ALPHA: if no ingredientId, create a free-text inventory entry with the
      // amount used as a "used" record isn't needed — we only subtract existing stock.
      // So for custom items that weren't in inventory, we just record them as used
      // by optionally creating a zero batch or skipping. Best: if custom, try to
      // match free-text name in inventory and reduce; else skip subtraction.

      if (ing.isCustom || !ing.ingredientId) {
        // Try match free-text batches by name
        const matching = allBatches
          .filter(
            (b) =>
              !b.ingredientId &&
              (b.freeTextName || '').toLowerCase() === (ing.name || '').toLowerCase() &&
              b.quantity > 0
          )
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        let remaining = Number(ing.quantity);
        for (const batch of matching) {
          if (remaining <= 0) break;
          if (batch.unit !== ing.unit) {
            const converted = convertQuantity(batch.quantity, batch.unit, ing.unit);
            if (converted === null) continue;
            if (converted <= remaining) {
              remaining -= converted;
              await db.inventoryBatches.delete(batch.id);
            } else {
              const used = convertQuantity(remaining, ing.unit, batch.unit);
              if (used !== null) {
                await db.inventoryBatches.update(batch.id, {
                  quantity: batch.quantity - used,
                  updatedAt: now,
                });
                remaining = 0;
              }
            }
          } else {
            if (batch.quantity <= remaining) {
              remaining -= batch.quantity;
              await db.inventoryBatches.delete(batch.id);
            } else {
              await db.inventoryBatches.update(batch.id, {
                quantity: batch.quantity - remaining,
                updatedAt: now,
              });
              remaining = 0;
            }
          }
        }
        continue;
      }

      let remaining = Number(ing.quantity);
      const unit = ing.unit;

      const matching = allBatches
        .filter((b) => b.ingredientId === ing.ingredientId && b.quantity > 0)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

      for (const batch of matching) {
        if (remaining <= 0) break;

        const availableInUnit = convertQuantity(batch.quantity, batch.unit, unit);
        if (availableInUnit === null) continue;

        if (availableInUnit <= remaining) {
          remaining -= availableInUnit;
          await db.inventoryBatches.delete(batch.id);
        } else {
          const usedInBatchUnit = convertQuantity(remaining, unit, batch.unit);
          if (usedInBatchUnit !== null) {
            await db.inventoryBatches.update(batch.id, {
              quantity: batch.quantity - usedInBatchUnit,
              updatedAt: now,
            });
            remaining = 0;
          }
        }
      }
    }
  }

  async function handleConfirm() {
    if (!confirmMode) return;
    setSaving(true);
    try {
      await subtractFromInventory(editableIngs);
      await db.plannedMeals.update(meal!.id, {
        status: confirmMode === 'eaten' ? 'eaten' : 'skipped',
        updatedAt: new Date().toISOString(),
      });
      setConfirmMode(null);
      navigate('/meal-plan');
    } catch (err) {
      console.error(err);
      alert('Failed to update inventory');
    } finally {
      setSaving(false);
    }
  }

  async function handleNA() {
    setSaving(true);
    try {
      await db.plannedMeals.update(meal!.id, {
        status: 'skipped',
        updatedAt: new Date().toISOString(),
      });
      setConfirmMode(null);
      navigate('/meal-plan');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Remove this meal from the plan?')) return;
    await db.plannedMeals.delete(meal!.id);
    navigate('/meal-plan');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/meal-plan" className="text-sm text-slate-500">← Meal Plan</Link>
          <h2 className="mt-1 text-xl font-semibold text-slate-800">{meal.title}</h2>
          <p className="text-sm text-slate-500">
            {format(parseISO(meal.date), 'EEE, MMM d, yyyy')}
            {meal.mealType && (
              <span className="ml-2 text-slate-400">
                · {meal.mealType} ({MEAL_TYPE_LABELS[meal.mealType] || meal.mealType})
              </span>
            )}
          </p>
        </div>
        <Link to={`/meal-plan/${meal.id}/edit`} className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg">
          Edit
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm text-slate-600">
        <span>{meal.servings} serving{meal.servings !== 1 ? 's' : ''}</span>
        {meal.recipeId ? (
          <span>· From recipe{recipe ? `: ${recipe.name}` : ''}</span>
        ) : (
          <span className="text-violet-600">· Free-text</span>
        )}
        {meal.status === 'eaten' && <span className="text-emerald-600 font-medium">· ✓ Eaten</span>}
        {meal.status === 'skipped' && <span className="text-slate-400">· ✕ Skipped</span>}
      </div>

      {meal.status !== 'eaten' && meal.status !== 'skipped' && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => openConfirm('eaten')}
            className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl"
          >
            ✓ I ate this
          </button>
          <button
            type="button"
            onClick={() => openConfirm('skipped')}
            className="flex-1 py-3 bg-slate-200 text-slate-700 font-medium rounded-xl"
          >
            ✕ Didn’t eat
          </button>
        </div>
      )}

      <section className="bg-white p-4 rounded-xl border border-slate-200">
        <h3 className="font-medium text-slate-800 mb-3">Ingredients</h3>
        {meal.ingredients.length === 0 ? (
          <p className="text-sm text-slate-500">No ingredients listed.</p>
        ) : (
          <ul className="space-y-1.5">
            {meal.ingredients.map((ing, i) => {
              const name = ingredientMap.get(ing.ingredientId)?.name ?? 'Unknown';
              return (
                <li key={i} className="text-sm text-slate-700">
                  <span className="font-medium">{ing.quantity} {ing.unit}</span> {name}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {meal.notes && (
        <section className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="font-medium text-slate-800 mb-2">Notes / Event</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{meal.notes}</p>
        </section>
      )}

      <button type="button" onClick={handleDelete} className="text-sm text-red-600">
        Remove from Meal Plan
      </button>

      {/* Centered modal that fits the screen */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <h3 className="font-semibold text-slate-800 text-base">
                {confirmMode === 'eaten' ? 'What did you use?' : 'Anything used?'}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmMode(null)}
                className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-full text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-4 pt-2 pb-1 text-sm text-slate-600 shrink-0">
              {confirmMode === 'eaten'
                ? 'Adjust amounts. Add anything else you ate. Inventory will update.'
                : 'Log what you used, or NA if you ate out / skipped.'}
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0">
              {editableIngs.length === 0 && !showAddCustom && (
                <p className="text-sm text-slate-500 py-3 text-center">No ingredients yet.</p>
              )}
              {editableIngs.map((row) => {
                const name = row.name || ingredientMap.get(row.ingredientId)?.name || 'Item';
                return (
                  <div key={row.tempId} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl">
                    <input
                      type="checkbox"
                      checked={row.useIt}
                      onChange={(e) => updateEditable(row.tempId, 'useIt', e.target.checked)}
                      className="mt-1 rounded text-emerald-600 w-5 h-5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                      <div className="flex gap-2 mt-1.5">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={row.quantity}
                          onChange={(e) => updateEditable(row.tempId, 'quantity', e.target.value)}
                          disabled={!row.useIt}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40"
                        />
                        <select
                          value={row.unit}
                          onChange={(e) => updateEditable(row.tempId, 'unit', e.target.value)}
                          disabled={!row.useIt}
                          className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-40"
                        >
                          {COMMON_UNITS.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add custom */}
              {showAddCustom ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="text-sm font-medium text-slate-800">Add what you ate</div>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Leftover pizza, Apple"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="px-2 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      {COMMON_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addCustomToList}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddCustom(false)}
                      className="px-3 py-1.5 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="w-full py-2.5 text-sm font-medium text-emerald-600 border border-dashed border-emerald-300 rounded-xl"
                >
                  + Add something else you ate
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 space-y-2 shrink-0">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={saving}
                className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl disabled:opacity-50"
              >
                {saving ? 'Updating…' : 'Confirm & Update Inventory'}
              </button>
              {confirmMode === 'skipped' && (
                <button
                  type="button"
                  onClick={handleNA}
                  disabled={saving}
                  className="w-full py-3 bg-slate-100 text-slate-700 font-medium rounded-xl"
                >
                  NA – Ate out / Skipped
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmMode(null)}
                className="w-full py-2 text-sm text-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
