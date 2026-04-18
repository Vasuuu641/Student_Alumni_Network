import { LayoutDashboard, MapPinned, MessageSquare, NotebookText, Users } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/notes', label: 'Notes', icon: NotebookText },
  { to: '/threads', label: 'Threads', icon: MessageSquare },
  { to: '/study-groups', label: 'Study Groups', icon: Users },
  { to: '/geo-help-board', label: 'Geo Help', icon: MapPinned },
];

export function PlatformTopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4">
        <div className="mr-3 inline-flex items-center gap-2">
          <div className="brand-icon !h-8 !w-8" aria-hidden="true">
            <FontAwesomeIcon icon={faBridge} />
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">UniBridge</span>
        </div>
        <nav className="flex items-center gap-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-sky-100 text-sky-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={14} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
