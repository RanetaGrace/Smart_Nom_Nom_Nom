import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

export function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const recipe = useLiveQuery(() => db.recipes.get(id!), [id]);
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), []);
  const [confirmStep, setConfirmStep] = useState(0);
  const [deleteText, setDeleteText] = useState('');

  if (recipe === undefined) {
    return <p className="text-slate-500">Loading...</p>;
  }

  if (!recipe) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Recipe not found.</p>
        <Link to="/recipes" className="text-emerald-600 hover:underline">
          Back to recipes
        </Link>
      </div>
    );
  }

  const ingredientMap = new Map((ingredients ?? []).map((i) => [i.id, i]));

  async function handleDelete() {
    if (confirmStep < 2) {
      setConfirmStep((s) => s + 1);
      return;
    }
    if (deleteText !== 'DELETE') return;

    // Remove planned meals that use this recipe
    const meals = await db.plannedMeals.where('recipeId').equals(recipe!.id).toArray();
    await db.transaction('rw', db.recipes, db.plannedMeals, async () => {
      for (const meal of meals) {
        await db.plannedMeals.delete(meal.id);
      }
      await db.recipes.delete(recipe!.id);
    });

    navigate('/recipes');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/recipes" className="text-sm text-slate-500 hover:text-slate-800">
            ← Recipes
          </Link>
          <h2 className="mt-1 text-2xl font-semibold text-slate-800">{recipe.name}</h2>
          {ingredientMap.get(recipe.primaryIngredientId) && (
            <p className="text-slate-500">
              {ingredientMap.get(recipe.primaryIngredientId)!.name}
            </p>
          )}
        </div>
        <Link
          to={`/recipes/${recipe.id}/edit`}
          className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
        >
          Edit
        </Link>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
        <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
        {recipe.prepTime != null && <span>Prep: {recipe.prepTime} min</span>}
        {recipe.cookTime != null && <span>Cook: {recipe.cookTime} min</span>}
        {recipe.totalTime != null && <span>Total: {recipe.totalTime} min</span>}
        {recipe.rating != null && (
          <span className="text-amber-500">{'★'.repeat(recipe.rating)}</span>
        )}
        {recipe.isSomeday && (
          <span className="text-violet-600 font-medium">Someday</span>
        )}
      </div>

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      <section className="bg-white p-4 rounded-xl border border-slate-200">
        <h3 className="font-medium text-slate-800 mb-3">Ingredients</h3>
        <ul className="space-y-1.5">
          {recipe.ingredients.map((ing, i) => {
            const name = ingredientMap.get(ing.ingredientId)?.name ?? 'Unknown';
            return (
              <li key={i} className="text-sm text-slate-700">
                <span className="font-medium">
                  {ing.quantity} {ing.unit}
                </span>{' '}
                {name}
                {ing.note && <span className="text-slate-400"> — {ing.note}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Instructions */}
      {recipe.instructions && (
        <section className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="font-medium text-slate-800 mb-3">Instructions</h3>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">
            {recipe.instructions}
          </div>
        </section>
      )}

      {/* Delete */}
      <section className="pt-4 border-t border-slate-200">
        {confirmStep === 0 && (
          <button
            type="button"
            onClick={() => setConfirmStep(1)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete this recipe
          </button>
        )}

        {confirmStep === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              This will also remove any planned meals that use this recipe. Purchase and
              inventory history will be kept.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmStep(2)}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg"
              >
                Yes, continue
              </button>
              <button
                type="button"
                onClick={() => setConfirmStep(0)}
                className="px-3 py-1.5 text-sm text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {confirmStep === 2 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Type <strong>DELETE</strong> to confirm permanently.
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg text-sm"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteText !== 'DELETE'}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg disabled:opacity-40"
              >
                Permanently delete
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmStep(0);
                  setDeleteText('');
                }}
                className="px-3 py-1.5 text-sm text-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
