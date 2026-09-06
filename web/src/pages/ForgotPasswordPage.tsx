import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../api/forgot-password.api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import { Mail } from 'lucide-react';
import Button from '../components/Button';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = email.trim().length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await requestPasswordReset({ email });
      navigate('/reset-password', { state: { email } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send reset code.');
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
            <h2>Forgot your password?</h2>
            <p>Enter your email and we'll send you a reset code</p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit}>
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
                  placeholder="neptun@tr.pte.hu"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </label>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={!canSubmit ? 'submit-button--soft' : ''}
            >
              {isSubmitting ? 'Sending...' : 'Send reset code'}
            </Button>
          </form>

          <p className="auth-footer">
            Remembered your password? <Link to="/login">Sign in</Link>
          </p>
        </section>

        <p className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </section>
    </main>
  );
}