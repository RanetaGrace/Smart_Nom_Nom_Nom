import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import type { PlannedMeal, PlannedIngredient } from '../types';
import { COMMON_UNITS } from '../types';

type FormIngredient = PlannedIngredient & { tempId: string };

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

  const prefilledDate = searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<'recipe' | 'freetext'>('recipe');
  const [date, setDate] = useState(prefilledDate);
  const [recipeId, setRecipeId] = useState('');
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState<FormIngredient[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load existing
  useEffect(() => {
    if (existing) {
      setDate(existing.date);
      setRecipeId(existing.recipeId || '');
      setTitle(existing.title);
      setServings(existing.servings);
      setIngredients(
        existing.ingredients.map((ing, i) => ({
          ...ing,
          tempId: `existing-${i}`,
        }))
      );
      setNotes(existing.notes || '');
      setMode(existing.recipeId ? 'recipe' : 'freetext');
    }
  }, [existing]);

  // When selecting a recipe, copy its ingredients
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (ingredients.some((ing) => !ing.ingredientId)) {
      setError('Every ingredient row must select an ingredient');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
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
        notes: notes.trim() || undefined,
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-800">
          {isEdit ? 'Edit Meal' : 'Add Meal'}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/meal-plan')}
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
        {/* Date + mode */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          {!isEdit && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode('recipe')}
                className={`flex-1 py-2 text-sm rounded-lg border ${
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
                className={`flex-1 py-2 text-sm rounded-lg border ${
                  mode === 'freetext'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Free-text Meal
              </button>
            </div>
          )}

          {mode === 'recipe' && !isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Choose Recipe
              </label>
              <select
                value={recipeId}
                onChange={(e) => handleSelectRecipe(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select a recipe…</option>
                {(recipes ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Ingredients will be copied. You can customize them for this meal only.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Chicken Curry or Eggs & Toast"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Servings</label>
            <input
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
              className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </section>

        {/* Ingredients – the customizable part */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800">Ingredients for this meal</h3>
            <button
              type="button"
              onClick={addIngredientRow}
              className="text-sm text-emerald-600 hover:underline"
            >
              + Add
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Changes here only affect this planned meal, not the original recipe.
          </p>

          {ingredients.length === 0 && (
            <p className="text-sm text-slate-500">No ingredients. Add some so Grocery can calculate needs.</p>
          )}

          <div className="space-y-3">
            {ingredients.map((row) => (
              <div key={row.tempId} className="flex flex-wrap gap-2 items-start">
                <select
                  value={row.ingredientId}
                  onChange={(e) => updateIngredientRow(row.tempId, 'ingredientId', e.target.value)}
                  className="flex-1 min-w-[140px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">Select…</option>
                  {(allIngredients ?? []).map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={row.quantity}
                  onChange={(e) => updateIngredientRow(row.tempId, 'quantity', e.target.value)}
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <select
                  value={row.unit}
                  onChange={(e) => updateIngredientRow(row.tempId, 'unit', e.target.value)}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeIngredientRow(row.tempId)}
                  className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder="Optional"
          />
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {saving ? 'Saving…' : isEdit ? 'Update Meal' : 'Add to Meal Plan'}
        </button>
      </form>
    </div>
  );
}
