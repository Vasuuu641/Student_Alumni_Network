import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api/register.api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import {User, Mail, Lock} from 'lucide-react';
import Button from '../components/Button';



export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length >= 6;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await registerUser({ email, password, firstName, lastName });
      navigate('/login', { replace: true, state: { registeredEmail: email } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--register">
      <div className="auth-page__orb auth-page__orb--left" aria-hidden="true" />
      <div className="auth-page__orb auth-page__orb--right" aria-hidden="true" />

      <section className="auth-shell">
        <div className="brand-lockup brand-lockup--stacked">
          <div className="brand-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faBridge} />
          </div>
          <h1>Join UniBridge</h1>
          <p>Connect with your academic community</p>
        </div>

        <section className="auth-card">
          <header className="auth-card__header">
            <h2>Create Account</h2>
            <p>Create your UniBridge profile with your university email</p>
          </header>

          <form className="auth-form" onSubmit={handleSubmit}>
            {errorMessage ? <p className="status-banner status-banner--error">{errorMessage}</p> : null}

            <div className="form-grid">
              <label className="field">
                <span>First name</span>
                <div className="input-shell">
                  <span className="input-icon" aria-hidden="true">
                    <User />
                  </span>
                  <input
                    className="input"
                    type="text"
                    placeholder="John"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    maxLength={50}
                  />
                </div>
              </label>

              <label className="field">
                <span>Last name</span>
                <div className="input-shell">
                  <span className="input-icon" aria-hidden="true">
                    <User />
                  </span>
                  <input
                    className="input"
                    type="text"
                    placeholder="Doe"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                    maxLength={50}
                  />
                </div>
              </label>
            </div>

            <label className="field">
              <span>University Email</span>
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
              <small className="helper-text">Only pre-approved university emails can register</small>
            </label>

            <label className="field">
              <span>Password</span>
              <div className="input-shell">
                <span className="input-icon" aria-hidden="true">
                  <Lock/>
                </span>
                <input
                  className="input"
                  type="password"
                  placeholder="Create a password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </section>
      </section>
    </main>
  );
}


