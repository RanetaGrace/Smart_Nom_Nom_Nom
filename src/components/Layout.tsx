import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/recipes', label: 'Recipes', icon: '📖' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/grocery', label: 'Grocery', icon: '🛒' },
  { to: '/meal-plan', label: 'Plan', icon: '📅' },
];

export function Layout() {
  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
            Nom Noms
          </h1>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Alpha 2.0
          </span>
        </div>
      </header>

      {/* Scrollable main content */}
      <main className="app-main">
        <div className="px-4 py-4 pb-6 max-w-lg mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom navigation – larger touch targets */}
      <nav className="app-nav">
        <div className="flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item flex-1 ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-icon" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
