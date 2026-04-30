import { ShieldCheck, UserCog, MapPinned, Pin, LogOut } from 'lucide-react';
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getAccessToken, getRoleFromAccessToken } from '../../lib/auth';

const ADMIN_ITEMS = [
  { to: '/admin/users', label: 'User Access', icon: UserCog },
  { to: '/admin/geo-moderation', label: 'Geo Approvals', icon: MapPinned },
  { to: '/admin/threads-moderation', label: 'Thread Pinning', icon: Pin },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const role = token ? getRoleFromAccessToken(token) : null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  function handleSignOut() {
    localStorage.removeItem('unibridge.accessToken');
    localStorage.removeItem('unibridge.refreshToken');
    navigate('/login', { replace: true });
  }

  return (
    <main className="admin-page-shell">
      <header className="admin-topbar">
        <div className="admin-topbar__left">
          <div className="admin-logo" aria-hidden="true">
            <ShieldCheck size={15} />
          </div>
          <div>
            <p className="admin-brand">UniBridge</p>
          </div>
        </div>

        <div className="admin-topbar__right">
          <span className="admin-pill">Admin</span>
          <button className="admin-ghost-btn" onClick={() => navigate('/profile')}>
            Profile
          </button>
          <button className="admin-ghost-btn" onClick={handleSignOut}>
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      <section className="admin-main-wrap">
        <aside className="admin-sidebar">
          {ADMIN_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `admin-nav-link ${isActive ? 'admin-nav-link--active' : ''}`
                }
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </aside>

        <section className="admin-content">
          <div
            style={{
              border: '1px solid #d8e2f0',
              borderRadius: '0.85rem',
              background: '#fff',
              boxShadow: '0 6px 20px rgba(15, 36, 76, 0.06)',
              padding: '0.95rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <p className="admin-brand" style={{ marginBottom: '0.15rem' }}>Admin Console</p>
              <p className="admin-brand-sub">Review users, the geo board, and discussion moderation.</p>
            </div>
            <button className="admin-ghost-btn" onClick={() => navigate('/profile')}>
              Edit Name
            </button>
          </div>
          <Outlet />
        </section>
      </section>
    </main>
  );
}
