import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-800">Welcome</h2>
        <p className="mt-1 text-slate-600">
          Plan meals, track what you have, and buy only what you need.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/meal-plan"
          className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow transition"
        >
          <div className="text-emerald-600 font-medium">Meal Plan</div>
          <p className="mt-1 text-sm text-slate-500">Schedule meals for the week</p>
        </Link>

        <Link
          to="/grocery"
          className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow transition"
        >
          <div className="text-emerald-600 font-medium">Grocery</div>
          <p className="mt-1 text-sm text-slate-500">See what you still need to buy</p>
        </Link>

        <Link
          to="/inventory"
          className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow transition"
        >
          <div className="text-emerald-600 font-medium">Inventory</div>
          <p className="mt-1 text-sm text-slate-500">Track batches & expiration</p>
        </Link>

        <Link
          to="/recipes"
          className="block p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow transition"
        >
          <div className="text-emerald-600 font-medium">Recipes</div>
          <p className="mt-1 text-sm text-slate-500">Create & manage recipes</p>
        </Link>
      </div>

      <div className="p-4 bg-slate-100 rounded-lg text-sm text-slate-600">
        <strong>ALPHA 1.0</strong> — Core connected workflow. Budget, nutrition, and advanced
        recommendations come later.
      </div>
    </div>
  );
}
