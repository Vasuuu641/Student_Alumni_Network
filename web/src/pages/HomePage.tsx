import { Link } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  Lock,
  MapPinned,
  MessagesSquare,
  Sparkles,
  Users,
  UsersRound,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import { ThemePicker } from '../components/ThemePicker';

const purposeCards = [
  {
    iconClass: 'purpose-card__icon--students',
    icon: <UsersRound />,
    title: 'Students',
    description: 'Full access to notes, groups, campus resources, and mentorship.',
  },
  {
    iconClass: 'purpose-card__icon--professors',
    icon: <BookOpen />,
    title: 'Professors',
    description: 'Lead discussions, collaborate on notes, and advise study groups.',
  },
  {
    iconClass: 'purpose-card__icon--alumni',
    icon: <GraduationCap />,
    title: 'Alumni',
    description: 'Mentor students, share career advice, and stay connected.',
  },
];

const featureCards = [
  {
    icon: <BookOpen />,
    title: 'Collaborative Notes',
    description: 'Real-time Google Docs-style editor. Write, format, and collaborate with classmates and professors on lecture notes and study materials.',
  },
  {
    icon: <MessagesSquare />,
    title: 'Discussion Threads',
    description: 'Reddit-style academic forums for course discussions, career advice, and campus conversations. Organized by topic and department.',
  },
  {
    icon: <Users />,
    title: 'Study Groups',
    description: 'Find and form study groups automatically based on your courses, interests, and schedule. Never study alone again.',
  },
  {
    icon: <Sparkles />,
    title: 'AI-Powered Insights',
    description: 'Smart suggestions that link your notes to relevant discussions, match you with mentors, and surface the right resources at the right time.',
  },
  {
    icon: <MapPinned />,
    title: 'Campus Resources',
    description: 'Interactive campus map showing study spaces, labs, libraries, and facilities. Find available rooms and resources in real time.',
  },
  {
    icon: <GraduationCap />,
    title: 'Alumni Mentorship',
    description: 'Connect with alumni mentors in your field. Get career guidance, resume reviews, and industry insights from those who walked your path.',
  },
];

export function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-shell landing-shell--header">
          <Link to="/" className="brand-lockup brand-lockup--header" aria-label="UniBridge home">
            <div className="brand-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBridge} />
            </div>
            <span className="brand-name">UniBridge</span>
          </Link>

          <nav className="landing-header__actions" aria-label="Primary">
            <ThemePicker compact />
            <Link to="/login" className="text-link text-link--muted">
              Sign In
            </Link>
            <Link to="/register" className="hero-button hero-button--compact hero-button--primary">
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <section className="landing-section landing-section--hero">
        <div className="landing-shell landing-shell--hero">
          <div className="section-pill">
            <Sparkles />
            <span>Built for universities</span>
          </div>

          <h1 className="landing-title">
            Where academics <span>connect</span>, collaborate, and grow
          </h1>

          <p className="landing-subtitle">
            UniBridge is the all-in-one platform for students, professors, and alumni. Share notes, discuss ideas,
            find mentors, and access campus resources — all in one place.
          </p>

          <div className="hero-actions">
            <Link to="/register" className="hero-button hero-button--primary">
              Create Your Account <span aria-hidden="true">→</span>
            </Link>
            <Link to="/login" className="hero-button hero-button--secondary">
              Sign In
            </Link>
          </div>

          <div className="role-pills" aria-label="Audience shortcuts">
            <span className="role-pill"><UsersRound /> Students</span>
            <span className="role-pill"><BookOpen /> Professors</span>
            <span className="role-pill"><GraduationCap /> Alumni</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--purpose" aria-labelledby="purpose-title">
        <div className="landing-shell">
          <div className="section-kicker">Our Purpose</div>
          <h2 id="purpose-title" className="section-title">
            Bridging the gap between academic life and community
          </h2>
          <p className="section-copy section-copy--narrow">
            Universities are full of brilliant minds — but too often, knowledge stays siloed in classrooms and offices.
            UniBridge creates a shared space where students collaborate on notes, professors spark discussions, and alumni
            give back through mentorship. One platform, one community, zero barriers.
          </p>

          <div className="purpose-grid">
            {purposeCards.map((card) => (
              <article className="purpose-card" key={card.title}>
                <div className={`purpose-card__icon ${card.iconClass}`} aria-hidden="true">
                  {card.icon}
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--features" aria-labelledby="features-title">
        <div className="landing-shell">
          <div className="section-kicker">Features</div>
          <h2 id="features-title" className="section-title">
            Everything your campus needs
          </h2>

          <div className="features-grid">
            {featureCards.map((card) => (
              <article className="feature-card" key={card.title}>
                <div className="feature-card__icon" aria-hidden="true">
                  {card.icon}
                </div>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--privacy" aria-labelledby="privacy-title">
        <div className="landing-shell landing-shell--privacy">
          <div className="privacy-panel">
            <div className="privacy-panel__lock" aria-hidden="true">
              <Lock />
            </div>
            <h2 id="privacy-title">Your Privacy Matters</h2>
            <p className="privacy-panel__subtitle">How we protect your data and respect your rights</p>

            <div className="privacy-grid">
              <article className="privacy-item privacy-item--green">
                <div className="privacy-item__icon" aria-hidden="true"><Lock /></div>
                <h3>End-to-End Security</h3>
                <p>All data is encrypted in transit and at rest. Your notes, messages, and personal information are protected by industry-standard encryption.</p>
              </article>

              <article className="privacy-item privacy-item--blue">
                <div className="privacy-item__icon" aria-hidden="true"><BookOpen /></div>
                <h3>Transparent Data Use</h3>
                <p>We never sell your data to third parties. Your academic content remains yours. AI features only process data with your explicit consent.</p>
              </article>

              <article className="privacy-item privacy-item--purple">
                <div className="privacy-item__icon" aria-hidden="true"><ShieldIcon /></div>
                <h3>Institutional Control</h3>
                <p>Access is restricted to pre-approved university members only. Admins control who can join, ensuring a safe and trusted community.</p>
              </article>
            </div>

            <p className="privacy-panel__fineprint">
              UniBridge complies with FERPA and institutional data governance policies. We collect only the minimum data
              necessary to provide our services. You can request a full export or deletion of your data at any time by
              contacting your university admin. For full details, see our Privacy Policy and Terms of Service.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--cta">
        <div className="landing-shell landing-shell--cta">
          <div className="cta-icon" aria-hidden="true">
            <MapPinned />
          </div>
          <h2>Ready to bridge the gap?</h2>
          <p>
            Join your university&apos;s community on UniBridge. It takes less than a minute to get started.
          </p>
          <div className="cta-actions">
            <Link to="/register" className="hero-button hero-button--primary hero-button--large">
              Get Started Free <span aria-hidden="true">→</span>
            </Link>
            <Link to="/login" className="cta-link">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-shell landing-shell--footer">
          <Link to="/" className="brand-lockup brand-lockup--footer">
            <div className="brand-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBridge} />
            </div>
            <span className="brand-name">UniBridge</span>
          </Link>

          <div className="footer-links">
            <a href="#privacy-title">Privacy Policy</a>
            <a href="#privacy-title">Terms of Service</a>
            <a href="mailto:contact@unibridge.app">Contact</a>
          </div>

          <p className="footer-copy">© 2026 UniBridge. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 19 6v5c0 5-3.5 8.8-7 10-3.5-1.2-7-5-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

