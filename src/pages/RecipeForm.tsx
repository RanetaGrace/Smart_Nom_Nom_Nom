import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import type { Recipe, RecipeIngredient, Ingredient } from '../types';
import { COMMON_UNITS, INGREDIENT_TYPES } from '../types';
import { IngredientSelect } from '../components/IngredientSelect';

type FormIngredient = RecipeIngredient & { tempId: string };

const emptyForm = {
  name: '',
  primaryIngredientId: '',
  servings: 4,
  prepTime: '',
  cookTime: '',
  totalTime: '',
  rating: '' as string | number,
  tags: '',
  instructions: '',
  isSomeday: false,
  prepAhead: false,
};

export function RecipeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id) && id !== 'new';
  const navigate = useNavigate();

  const existing = useLiveQuery(
    () => (isEdit ? db.recipes.get(id!) : undefined),
    [id, isEdit]
  );

  const allIngredients = useLiveQuery(() => db.ingredients.orderBy('name').toArray(), []);

  const [form, setForm] = useState(emptyForm);
  const [ingredients, setIngredients] = useState<FormIngredient[]>([]);
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

  // Load existing recipe into form
  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name,
        primaryIngredientId: existing.primaryIngredientId,
        servings: existing.servings,
        prepTime: existing.prepTime?.toString() ?? '',
        cookTime: existing.cookTime?.toString() ?? '',
        totalTime: existing.totalTime?.toString() ?? '',
        rating: existing.rating ?? '',
        tags: existing.tags.join(', '),
        instructions: existing.instructions ?? '',
        isSomeday: existing.isSomeday,
        prepAhead: existing.prepAhead || false,
      });
      setIngredients(
        existing.ingredients.map((ing, i) => ({
          ...ing,
          tempId: `existing-${i}`,
        }))
      );
    }
  }, [existing]);

  // Auto-calculate total time
  useEffect(() => {
    const prep = parseInt(form.prepTime) || 0;
    const cook = parseInt(form.cookTime) || 0;
    if (prep || cook) {
      setForm((f) => ({ ...f, totalTime: String(prep + cook) }));
    }
  }, [form.prepTime, form.cookTime]);

  function updateField(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
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

    // Add a row using the new ingredient
    setIngredients((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        ingredientId: newId,
        quantity: 1,
        unit: newIng.preferredUnit || 'g',
        note: '',
      },
    ]);

    setShowNewIngredient(false);
    setNewIng({ name: '', type: 'Other', family: '', subcategory: '', preferredUnit: 'g' });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Recipe name is required');
      return;
    }
    if (!form.primaryIngredientId) {
      setError('Primary ingredient is required');
      return;
    }
    if (ingredients.length === 0) {
      setError('Add at least one ingredient');
      return;
    }
    if (ingredients.some((ing) => !ing.ingredientId)) {
      setError('Every ingredient row must select an ingredient');
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const recipeIngredients: RecipeIngredient[] = ingredients.map(
        ({ ingredientId, quantity, unit, note }) => ({
          ingredientId,
          quantity: Number(quantity) || 0,
          unit,
          note: note || undefined,
        })
      );

      const payload: Recipe = {
        id: isEdit ? id! : await nextId('recipe'),
        name: form.name.trim(),
        primaryIngredientId: form.primaryIngredientId,
        servings: Number(form.servings) || 1,
        ingredients: recipeIngredients,
        prepTime: form.prepTime ? Number(form.prepTime) : undefined,
        cookTime: form.cookTime ? Number(form.cookTime) : undefined,
        totalTime: form.totalTime ? Number(form.totalTime) : undefined,
        rating: form.rating === '' ? null : Number(form.rating),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        instructions: form.instructions.trim() || undefined,
        isSomeday: form.isSomeday,
        prepAhead: form.prepAhead,
        createdAt: isEdit && existing ? existing.createdAt : now,
        updatedAt: now,
      };

      if (isEdit) {
        await db.recipes.put(payload);
      } else {
        await db.recipes.add(payload);
      }

      navigate('/recipes');
    } catch (err) {
      console.error(err);
      setError('Failed to save recipe');
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
          {isEdit ? 'Edit Recipe' : 'New Recipe'}
        </h2>
        <button
          type="button"
          onClick={() => navigate('/recipes')}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Recipe Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Chicken Curry"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Primary Ingredient *
            </label>
            <IngredientSelect
              ingredients={allIngredients ?? []}
              value={form.primaryIngredientId}
              onChange={(id) => updateField('primaryIngredientId', id)}
              placeholder="Type to search…"
            />
            <p className="mt-1 text-xs text-slate-500">
              Don’t see it? Add it below in the ingredients section first.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Servings *</label>
              <input
                type="number"
                min="1"
                value={form.servings}
                onChange={(e) => updateField('servings', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prep (min)</label>
              <input
                type="number"
                min="0"
                value={form.prepTime}
                onChange={(e) => updateField('prepTime', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cook (min)</label>
              <input
                type="number"
                min="0"
                value={form.cookTime}
                onChange={(e) => updateField('cookTime', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total (min)</label>
              <input
                type="number"
                min="0"
                value={form.totalTime}
                onChange={(e) => updateField('totalTime', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rating</label>
              <select
                value={form.rating}
                onChange={(e) => updateField('rating', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {'★'.repeat(n)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isSomeday}
                  onChange={(e) => updateField('isSomeday', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Someday
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.prepAhead}
                  onChange={(e) => updateField('prepAhead', e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600"
                />
                Prep Ahead
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => updateField('tags', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Budget Friendly, One Pot, Batch Cook"
            />
          </div>
        </section>

        {/* Ingredients */}
        <section className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800">Ingredients *</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewIngredient(true)}
                className="text-sm text-emerald-600 hover:underline"
              >
                + New Ingredient
              </button>
              <button
                type="button"
                onClick={addIngredientRow}
                className="text-sm text-emerald-600 hover:underline"
              >
                + Add Row
              </button>
            </div>
          </div>

          {/* Inline create ingredient */}
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
                  placeholder="Subcategory (e.g. Breast)"
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

          {ingredients.length === 0 && (
            <p className="text-sm text-slate-500">No ingredients yet. Add a row or create a new ingredient.</p>
          )}

          <div className="space-y-3">
            {ingredients.map((row) => (
              <div key={row.tempId} className="flex flex-wrap gap-2 items-start">
                <div className="flex-1 min-w-[140px]">
                  <IngredientSelect
                    ingredients={allIngredients ?? []}
                    value={row.ingredientId}
                    onChange={(id) => updateIngredientRow(row.tempId, 'ingredientId', id)}
                    placeholder="Type to search…"
                  />
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={row.quantity}
                  onChange={(e) => updateIngredientRow(row.tempId, 'quantity', e.target.value)}
                  className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Qty"
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
                <input
                  type="text"
                  value={row.note || ''}
                  onChange={(e) => updateIngredientRow(row.tempId, 'note', e.target.value)}
                  className="flex-1 min-w-[100px] px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Note (optional)"
                />
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

        {/* Instructions */}
        <section className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-1">Instructions</label>
          <textarea
            value={form.instructions}
            onChange={(e) => updateField('instructions', e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Write or paste the instructions…"
          />
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : isEdit ? 'Update Recipe' : 'Create Recipe'}
          </button>
        </div>
      </form>
    </div>
  );
}
