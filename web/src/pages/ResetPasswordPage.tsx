import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api/forgot-password.api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import { Mail, Lock, KeyRound } from 'lucide-react';
import Button from '../components/Button';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? '';

  const [email, setEmail] = useState(prefillEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    email.trim().length > 0 && otp.trim().length === 6 && newPassword.trim().length >= 6;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await resetPassword({ email, otp, newPassword });
      navigate('/login', { state: { registeredEmail: email } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to reset password.');
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
            <h2>Reset your password</h2>
            <p>Enter the code we sent you and choose a new password</p>
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

            <label className="field">
              <span>Reset code</span>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <KeyRound />
                </span>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                />
              </div>
            </label>

            <label className="field">
              <span>New password</span>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <Lock />
                </span>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter a new password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </label>

            <Button
              type="submit"
              disabled={isSubmitting}
              className={!canSubmit ? 'submit-button--soft' : ''}
            >
              {isSubmitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>

          <p className="auth-footer">
            <Link to="/forgot-password">Didn't get a code? Request a new one</Link>
          </p>
        </section>

        <p className="auth-legal">By continuing, you agree to our Terms of Service and Privacy Policy</p>
      </section>
    </main>
  );
}