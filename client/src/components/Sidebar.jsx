import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬛' },
  { to: '/listings', label: 'Listings', icon: '📋' },
  { to: '/batch', label: 'Batch Review', icon: '⚡' },
  { to: '/history', label: 'Review History', icon: '🕓' },
];

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col py-6 px-3 shrink-0">
      {/* Logo */}
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="font-semibold text-slate-100 text-sm leading-tight">
            Marketplace<br />
            <span className="text-slate-400 font-normal">Quality Reviewer</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600/20 text-brand-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 text-xs text-slate-600 mt-4">
        v1.0.0 · Assessment Build
      </div>
    </aside>
  );
}
