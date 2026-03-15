import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const navigate = useNavigate();

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
        <button className="submit-button" type="button" onClick={handleLogout}>
          Log out
        </button>
      </section>
    </main>
  );
}
