import type { ReactNode } from 'react';
import { LayoutDashboard, MessageSquare, NotebookText, Users, type LucideIcon } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import { NavLink } from 'react-router-dom';

export interface PlatformTopNavItem {
  label: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
}

const DEFAULT_ITEMS: PlatformTopNavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/notes', label: 'Notes', icon: NotebookText },
  { to: '/threads', label: 'Threads', icon: MessageSquare },
  { to: '/study-groups', label: 'Study Groups', icon: Users },
];

interface PlatformTopNavProps {
  items?: PlatformTopNavItem[];
  rightContent?: ReactNode;
}

export function PlatformTopNav({ items = DEFAULT_ITEMS, rightContent }: PlatformTopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4">
        <div className="mr-3 inline-flex items-center gap-2">
          <div className="brand-icon !h-8 !w-8" aria-hidden="true">
            <FontAwesomeIcon icon={faBridge} />
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">UniBridge</span>
        </div>
        <div className="flex flex-1 items-center justify-between gap-2">
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;

              if (item.onClick) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              }

              if (!item.to) {
                return null;
              }

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
          {rightContent ? <div>{rightContent}</div> : null}
        </div>
      </div>
    </header>
  );
}
