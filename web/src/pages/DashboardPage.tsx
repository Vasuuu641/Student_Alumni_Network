import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import { getAccessToken, getRoleFromAccessToken } from '../lib/auth';

export function DashboardPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const role = token ? getRoleFromAccessToken(token) : null;
  const isAdmin = role === 'ADMIN';

  function handleLogout() {
    localStorage.removeItem('unibridge.accessToken');
    localStorage.removeItem('unibridge.refreshToken');
    navigate('/login', { replace: true });
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <h1>Dashboard</h1>
        <p>Your onboarding is complete. Welcome to UniBridge.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <Button
            type="button"
            variant="submit-wide"
            onClick={() => navigate('/notes')}
          >
            📝 My Notes
          </Button>
          <Button
            type="button"
            variant="submit-wide"
            onClick={() => navigate('/threads')}
          >
            💬 Discussions
          </Button>
          <Button
            type="button"
            variant="submit-wide"
            onClick={() => navigate('/study-groups')}
          >
            👥 Study Groups
          </Button>
          {isAdmin ? (
            <Button
              type="button"
              variant="submit-wide"
              onClick={() => navigate('/admin/users')}
            >
              🛡️ Admin Console
            </Button>
          ) : null}
          <Button type="button" variant="submit-wide" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </section>
    </main>
  );
}
