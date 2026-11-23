import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { db } from '../db';

export function MealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const meal = useLiveQuery(() => db.plannedMeals.get(id!), [id]);
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), []);
  const recipe = useLiveQuery(
    () => (meal?.recipeId ? db.recipes.get(meal.recipeId) : undefined),
    [meal?.recipeId]
  );

  if (meal === undefined) {
    return <p className="text-slate-500">Loading...</p>;
  }

  if (!meal) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Meal not found.</p>
        <Link to="/meal-plan" className="text-emerald-600 hover:underline">
          Back to Meal Plan
        </Link>
      </div>
    );
  }

  const ingredientMap = new Map((ingredients ?? []).map((i) => [i.id, i]));

  async function handleDelete() {
    if (!confirm('Remove this meal from the plan? Grocery will recalculate.')) return;
    await db.plannedMeals.delete(meal!.id);
    navigate('/meal-plan');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/meal-plan" className="text-sm text-slate-500 hover:text-slate-800">
            ← Meal Plan
          </Link>
          <h2 className="mt-1 text-2xl font-semibold text-slate-800">{meal.title}</h2>
          <p className="text-slate-500">
            {format(parseISO(meal.date), 'EEEE, MMM d, yyyy')}
          </p>
        </div>
        <Link
          to={`/meal-plan/${meal.id}/edit`}
          className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
        >
          Edit
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        <span>{meal.servings} serving{meal.servings !== 1 ? 's' : ''}</span>
        {meal.recipeId ? (
          <span className="text-slate-500">
            Based on recipe{recipe ? `: ${recipe.name}` : ''}
          </span>
        ) : (
          <span className="text-violet-600">Free-text meal</span>
        )}
      </div>

      <section className="bg-white p-4 rounded-xl border border-slate-200">
        <h3 className="font-medium text-slate-800 mb-3">Ingredients for this meal</h3>
        {meal.ingredients.length === 0 ? (
          <p className="text-sm text-slate-500">No ingredients listed.</p>
        ) : (
          <ul className="space-y-1.5">
            {meal.ingredients.map((ing, i) => {
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
        )}
      </section>

      {meal.notes && (
        <section className="bg-white p-4 rounded-xl border border-slate-200">
          <h3 className="font-medium text-slate-800 mb-2">Notes</h3>
          <p className="text-sm text-slate-700">{meal.notes}</p>
        </section>
      )}

      <button
        type="button"
        onClick={handleDelete}
        className="text-sm text-red-600 hover:underline"
      >
        Remove from Meal Plan
      </button>
    </div>
  );
}
