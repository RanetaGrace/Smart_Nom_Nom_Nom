import { Link } from 'react-router-dom';

export function Settings() {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Settings</h2>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <Link
          to="/settings/ingredients"
          className="flex items-center justify-between px-4 py-4 hover:bg-slate-50"
        >
          <div>
            <div className="font-medium text-slate-800">Ingredients</div>
            <div className="text-sm text-slate-500">View, edit, and fix ingredient names</div>
          </div>
          <span className="text-slate-400">→</span>
        </Link>
      </div>

      <p className="text-xs text-slate-400 px-1">
        More settings (export, backup, account) will come in later versions.
      </p>
    </div>
  );
}
