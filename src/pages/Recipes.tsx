import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db';
import type { Recipe } from '../types';

export function Recipes() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray(), []);
  const [search, setSearch] = useState('');
  const [showSomedayOnly, setShowSomedayOnly] = useState(false);
  const [showPrepAheadOnly, setShowPrepAheadOnly] = useState(false);

  const filtered = (recipes ?? []).filter((r) => {
    if (showSomedayOnly && !r.isSomeday) return false;
    if (showPrepAheadOnly && !r.prepAhead) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">Recipes</h2>
        <Link
          to="/recipes/new"
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
        >
          + New Recipe
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search recipes, tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={showSomedayOnly}
            onChange={(e) => setShowSomedayOnly(e.target.checked)}
            className="rounded border-slate-300 text-emerald-600"
          />
          Someday
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={showPrepAheadOnly}
            onChange={(e) => setShowPrepAheadOnly(e.target.checked)}
            className="rounded border-slate-300 text-emerald-600"
          />
          Prep Ahead
        </label>
      </div>

      {!recipes && <p className="text-slate-500">Loading...</p>}

      {recipes && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No recipes yet.</p>
          <Link to="/recipes/new" className="mt-2 inline-block text-emerald-600 hover:underline">
            Create your first recipe
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {filtered.map((recipe) => (
          <RecipeRow key={recipe.id} recipe={recipe} />
        ))}
      </ul>
    </div>
  );
}

function RecipeRow({ recipe }: { recipe: Recipe }) {
  return (
    <li>
      <Link
        to={`/recipes/${recipe.id}`}
        className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium text-slate-800">{recipe.name}</div>
            <div className="mt-0.5 text-sm text-slate-500">
              {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
              {recipe.tags.length > 0 && (
                <span className="ml-2">
                  · {recipe.tags.slice(0, 2).join(', ')}
                  {recipe.tags.length > 2 ? '…' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            {recipe.rating != null ? (
              <div className="text-amber-500 text-sm">
                {'★'.repeat(recipe.rating)}
                {'☆'.repeat(5 - recipe.rating)}
              </div>
            ) : (
              <div className="text-slate-300 text-sm">Not rated</div>
            )}
            <div className="mt-1 flex flex-col items-end gap-0.5">
              {recipe.isSomeday && (
                <div className="text-xs text-violet-600 font-medium">Someday</div>
              )}
              {recipe.prepAhead && (
                <div className="text-xs text-amber-600 font-medium">Prep Ahead</div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
