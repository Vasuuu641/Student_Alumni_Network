import type { ReactNode } from 'react';
import { LayoutDashboard, MapPinned, MessageSquare, NotebookText, Users, type LucideIcon } from 'lucide-react';
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
  { to: '/geo-help-board', label: 'Geo Help', icon: MapPinned },
];

interface PlatformTopNavProps {
  items?: PlatformTopNavItem[];
  rightContent?: ReactNode;
}

export function PlatformTopNav({ items = DEFAULT_ITEMS, rightContent }: PlatformTopNavProps) {
  return (
    <header className="platform-top-nav">
      <div className="platform-top-nav__inner">
        <div className="platform-top-nav__brand">
          <div className="brand-icon !h-8 !w-8" aria-hidden="true">
            <FontAwesomeIcon icon={faBridge} />
          </div>
          <span className="platform-top-nav__brand-name">UniBridge</span>
        </div>
        <div className="platform-top-nav__actions">
          <nav className="platform-top-nav__nav">
            {items.map((item) => {
              const Icon = item.icon;

              if (item.onClick) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="platform-top-nav__button"
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
                    `platform-top-nav__link ${isActive ? 'platform-top-nav__link--active' : ''}`
                  }
                >
                  <Icon size={14} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          {rightContent ? <div className="platform-top-nav__right">{rightContent}</div> : null}
        </div>
      </div>
    </header>
  );
}
