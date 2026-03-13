import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="page">
      <section className="card">
        <h1>UniBridge Web</h1>
        <p>React setup complete. Next: build homepage UI.</p>
        <div className="actions">
          <Link to="/register" className="btn btn-primary">Get Started</Link>
          <Link to="/login" className="btn btn-outline">I already have an account</Link>
        </div>
      </section>
    </main>
  );
}
