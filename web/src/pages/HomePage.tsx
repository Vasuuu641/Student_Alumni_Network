import { Link } from 'react-router-dom';
import {BookOpen, GraduationCap, School, Lock} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';



export function HomePage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="brand-lockup brand-lockup--centered">
          <div className="brand-icon" aria-hidden="true">
            <FontAwesomeIcon icon={faBridge} style={{color: "rgb(255, 255, 255)"}} />
          </div>
          <div>
            <h1>UniBridge</h1>
          </div>
        </div>

        <p className="landing-subtitle">
          Your university’s collaborative network for learning,
          mentorship and opportunity
        </p>

        <div className="hero-actions">
          <Link to="/register" className="hero-button hero-button--primary">Get Started</Link>
          <Link to="/login" className="hero-button hero-button--secondary">I already have an account</Link>
        </div>
      </section>

      <section className="feature-grid" aria-label="UniBridge features">
        <article className="feature-card">
          <div className="feature-card__icon feature-card__icon--gold">
            <BookOpen />
          </div>
          <h2>Learn together</h2>
          <p>
            Collaborate on notes, link concepts with AI, and ask course-specific questions in a shared academic workspace.
          </p>
        </article>

        <article className="feature-card">
          <div className="feature-card__icon feature-card__icon--yellow">
            <GraduationCap />
          </div>
          <h2>Connect With Alumni</h2>
          <p>
            Find mentors and career guidance through AI-powered matching with alumni who share your interests.
          </p>
        </article>

        <article className="feature-card">
          <div className="feature-card__icon feature-card__icon--orange">
            <School />
          </div>
          <h2>Navigate Campus Life</h2>
          <p>
            Discover events, resources, and opportunities through a personalized campus feed and location-based support.
          </p>
        </article>
      </section>

      <section className="privacy-panel" aria-label="Privacy information">
        <div className="privacy-panel__lock" aria-hidden="true">
          <Lock/>
        </div>
        <h2>Your Privacy Matters</h2>
        <p>
          UniBridge verifies accounts using official university (Neptun) email addresses. This ensures that all members are verified students, professors, staff, or alumni, keeping the platform secure and limited to the university community.
        </p>
      </section>
    </main>
  );
}

