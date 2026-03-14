import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/login.api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import { Mail, Lock} from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail = (location.state as { registeredEmail?: string } | null)?.registeredEmail ?? '';
  const [email, setEmail] = useState(registeredEmail);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState(
    registeredEmail ? 'Account created successfully. Please sign in.' : '',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await loginUser({ email, password });
      localStorage.setItem('unibridge.accessToken', response.accessToken);
      localStorage.setItem('unibridge.refreshToken', response.refreshToken);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__orb auth-page__orb--left" aria-hidden="true" />

      <section className="auth-shell">
        <div className="brand-lockup brand-lockup--stacked">
          <div className="brand-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faBridge} />
          </div>
          <h1>UniBridge</h1>
          <p>Connecting your academic community</p>
        </div>

        <section className="auth-card">
          <header className="auth-card__header">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your account</p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit}>
            {successMessage ? <p className="status-banner status-banner--success">{successMessage}</p> : null}
            {errorMessage ? <p className="status-banner status-banner--error">{errorMessage}</p> : null}

            <label className="field">
              <span>Email address</span>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <Mail />
                </span>
                <input
                  className="input"
                  type="email"
                  placeholder="you@university.edu"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>

            <div className="form-row">
              <label className="field field--grow">
                <span>Password</span>
                <div className="input-shell">
                  <span className="input-icon" aria-hidden="true">
                    <Lock/>
                  </span>
                  <input
                    className="input"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </label>
            </div>

            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account? <Link to="/register">Create one</Link>
          </p>

          <p className="auth-footer">
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>

         
        </section>

        <p className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </section>
    </main>
  );
}

