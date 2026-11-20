import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/recipes', label: 'Recipes' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/grocery', label: 'Grocery' },
  { to: '/meal-plan', label: 'Meal Plan' },
];

export function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
            Meal Planner <span className="text-xs font-normal text-slate-400">ALPHA 1.0</span>
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-20">
        <div className="max-w-5xl mx-auto flex justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 py-3 text-center text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-emerald-600 border-t-2 border-emerald-600 -mt-px'
                    : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
