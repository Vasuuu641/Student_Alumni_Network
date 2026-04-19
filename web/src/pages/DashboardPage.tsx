import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBridge } from '@fortawesome/free-solid-svg-icons';
import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Clock3,
  Compass,
  FolderOpen,
  MessageSquare,
  MessagesSquare,
  Plus,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { getAccessToken, getRoleFromAccessToken, getUserIdFromAccessToken, type UserRole } from '../lib/auth';
import { getCurrentUserProfile, type UserProfileData } from '../api/profile.api';
import { listUserNotes } from '../api/notes.api';
import { listThreads, type Thread, type ThreadPanel } from '../api/threads.api';

function resolveProfilePictureUrl(profilePictureUrl?: string | null): string | null {
  if (!profilePictureUrl) {
    return null;
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
  const normalizedUrl = profilePictureUrl.replace(/\\/g, '/');

  if (
    normalizedUrl.startsWith('http://') ||
    normalizedUrl.startsWith('https://') ||
    normalizedUrl.startsWith('data:')
  ) {
    return normalizedUrl;
  }

  const uploadsSegment = '/uploads/';
  const uploadsIndex = normalizedUrl.indexOf(uploadsSegment);
  const normalizedPath = uploadsIndex >= 0
    ? normalizedUrl.slice(uploadsIndex)
    : normalizedUrl.startsWith('uploads/')
      ? `/${normalizedUrl}`
      : normalizedUrl.startsWith('/')
        ? normalizedUrl
        : `/${normalizedUrl}`;

  return `${apiBaseUrl}${normalizedPath}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const role = token ? getRoleFromAccessToken(token) : null;
  const userId = token ? getUserIdFromAccessToken(token) : null;
  const isAdmin = role === 'ADMIN';

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(token));
  const [notesCount, setNotesCount] = useState(0);
  const [discussionCount, setDiscussionCount] = useState(0);
  const [recentDiscussions, setRecentDiscussions] = useState<Thread[]>([]);
  const [statsLoading, setStatsLoading] = useState(Boolean(token));
  const [placeholderNotice, setPlaceholderNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !role || isAdmin) {
      setProfileLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        setProfileLoading(true);
        const data = await getCurrentUserProfile(role as Exclude<UserRole, 'ADMIN'>);
        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, role, token]);

  useEffect(() => {
    if (!token || !role || isAdmin) {
      setStatsLoading(false);
      return;
    }

    const panels: ThreadPanel[] = role === 'ALUMNI' ? ['ALUMNI'] : ['ACADEMIC', 'ALUMNI'];

    let cancelled = false;

    async function loadDashboardStats() {
      try {
        setStatsLoading(true);
        const [notesResponse, ...threadResponses] = await Promise.all([
          listUserNotes(),
          ...panels.map((panel) => listThreads({ panel, sortBy: 'newest', take: 25 })),
        ]);

        if (cancelled) {
          return;
        }

        setNotesCount(notesResponse.notes.length);
        const totalThreads = threadResponses.reduce((sum, response) => sum + response.total, 0);
        setDiscussionCount(totalThreads);

        const merged = threadResponses
          .flatMap((response) => response.threads)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 3);

        setRecentDiscussions(merged);
      } catch {
        if (!cancelled) {
          setNotesCount(0);
          setDiscussionCount(0);
          setRecentDiscussions([]);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    }

    void loadDashboardStats();

    return () => {
      cancelled = true;
    };
  }, [isAdmin, role, token]);

  useEffect(() => {
    if (!placeholderNotice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPlaceholderNotice(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [placeholderNotice]);

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'John Doe';
  const firstName = displayName.split(' ')[0] || 'John';
  const profilePictureSrc = resolveProfilePictureUrl(profile?.profilePictureUrl);
  const profileInitials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const headlineParts = [profile?.major?.trim(), profile?.jobTitle?.trim(), profile?.company?.trim()].filter(Boolean);
  const profileHeadline = headlineParts.length > 0 ? headlineParts.join(' | ') : 'Computer Science Student | ML Enthusiast';
  const roleBadge = role.charAt(0) + role.slice(1).toLowerCase();

  const recentDiscussionsByUser = useMemo(() => {
    if (!userId) {
      return recentDiscussions;
    }

    const mine = recentDiscussions.filter((thread) => thread.authorId === userId);
    return mine.length > 0 ? mine : recentDiscussions;
  }, [recentDiscussions, userId]);

  function handleLogout() {
    localStorage.removeItem('unibridge.accessToken');
    localStorage.removeItem('unibridge.refreshToken');
    navigate('/login', { replace: true });
  }

  function openPlaceholder(featureName: string) {
    setPlaceholderNotice(`${featureName} is coming soon.`);
  }

  return (
    <main className="dashboard-v2">
      <header className="dashboard-v2__topbar">
        <div className="dashboard-v2__topbar-inner">
          <Link to="/dashboard" className="dashboard-v2__brand" aria-label="UniBridge dashboard">
            <div className="dashboard-v2__brand-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBridge} />
            </div>
            <span>UniBridge</span>
          </Link>

          <nav className="dashboard-v2__nav" aria-label="Primary">
            <Link className="dashboard-v2__nav-item dashboard-v2__nav-item--active" to="/dashboard">Dashboard</Link>
            <Link className="dashboard-v2__nav-item" to="/notes">Notes</Link>
            <Link className="dashboard-v2__nav-item" to="/threads">Discussions</Link>
            <Link className="dashboard-v2__nav-item" to="/geo-help-board">Geo Help Board</Link>
            <button className="dashboard-v2__nav-item" type="button" onClick={() => openPlaceholder('More')}>
              More
            </button>
          </nav>

          <div className="dashboard-v2__topbar-actions">
            <button type="button" className="dashboard-v2__icon-btn" onClick={() => openPlaceholder('Theme settings')}>
              <Sparkles size={14} />
            </button>
            <button type="button" className="dashboard-v2__icon-btn" onClick={() => openPlaceholder('Notifications')}>
              <Bell size={14} />
            </button>
            {isAdmin ? (
              <button type="button" className="dashboard-v2__admin-btn" onClick={() => navigate('/admin/users')}>
                Admin Console
              </button>
            ) : null}
            <button type="button" className="dashboard-v2__profile-chip" onClick={() => navigate('/profile')}>
              <span>{profileInitials || 'JD'}</span>
              {firstName}
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-v2__body">
        {placeholderNotice ? <div className="dashboard-v2__notice">{placeholderNotice}</div> : null}

        <div className="dashboard-v2__hero-row">
          <div>
            <h1>Welcome back, {firstName}!</h1>
            <p>Here&apos;s what&apos;s happening in your academic community</p>
          </div>
          <button type="button" className="dashboard-v2__new-note" onClick={() => navigate('/notes')}>
            <Plus size={16} />
            New Note
          </button>
        </div>

        <section className="dashboard-v2__stats" aria-label="Dashboard highlights">
          <article className="dashboard-v2__stat-card">
            <div className="dashboard-v2__stat-head">
              <span>Your Notes</span>
              <div className="dashboard-v2__stat-icon dashboard-v2__stat-icon--blue"><BookOpen size={16} /></div>
            </div>
            <strong>{statsLoading ? '...' : notesCount}</strong>
            <Link to="/notes">View all notes</Link>
          </article>

          <article className="dashboard-v2__stat-card">
            <div className="dashboard-v2__stat-head">
              <span>Discussions</span>
              <div className="dashboard-v2__stat-icon dashboard-v2__stat-icon--gold"><MessagesSquare size={16} /></div>
            </div>
            <strong>{statsLoading ? '...' : discussionCount}</strong>
            <Link to="/threads">Join discussions</Link>
          </article>
        </section>

        <section className="dashboard-v2__content-grid">
          <div className="dashboard-v2__left-column">
            <section className="dashboard-v2__panel">
              <h2>Quick Actions</h2>
              <div className="dashboard-v2__quick-grid">
                <button type="button" className="dashboard-v2__quick-btn" onClick={() => navigate('/notes')}>
                  <span className="dashboard-v2__quick-icon dashboard-v2__quick-icon--blue"><BookOpen size={16} /></span>
                  Notes
                </button>
                <button type="button" className="dashboard-v2__quick-btn" onClick={() => navigate('/threads')}>
                  <span className="dashboard-v2__quick-icon dashboard-v2__quick-icon--blue"><MessageSquare size={16} /></span>
                  Academic
                </button>
                <button type="button" className="dashboard-v2__quick-btn" onClick={() => navigate('/geo-help-board')}>
                  <span className="dashboard-v2__quick-icon dashboard-v2__quick-icon--violet"><CircleHelp size={16} /></span>
                  Geo Help Board
                </button>
                <button type="button" className="dashboard-v2__quick-btn" onClick={() => openPlaceholder('Ask a Doubt')}>
                  <span className="dashboard-v2__quick-icon dashboard-v2__quick-icon--green"><Compass size={16} /></span>
                  Ask Doubt
                </button>
              </div>
            </section>

            <section className="dashboard-v2__panel">
              <div className="dashboard-v2__panel-head">
                <h2>Recent Discussions</h2>
                <Link to="/threads">View all</Link>
              </div>

              <div className="dashboard-v2__discussion-list">
                {recentDiscussionsByUser.length === 0 ? (
                  <div className="dashboard-v2__empty">No discussions yet. Start one from Discussions.</div>
                ) : (
                  recentDiscussionsByUser.map((thread) => (
                    <article key={thread.id} className="dashboard-v2__discussion-card">
                      <div className="dashboard-v2__discussion-avatar">
                        {thread.authorName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="dashboard-v2__discussion-copy">
                        <div className="dashboard-v2__discussion-author-row">
                          <strong>{thread.authorName || 'UniBridge User'}</strong>
                          <span className={`dashboard-v2__discussion-panel dashboard-v2__discussion-panel--${thread.panel.toLowerCase()}`}>
                            {thread.panel === 'ALUMNI' ? 'alumni' : 'academic'}
                          </span>
                        </div>
                        <h3>{thread.title}</h3>
                        <p>{thread.description || 'Open the discussion to see full details and replies.'}</p>
                        <div className="dashboard-v2__discussion-meta">
                          <span><Clock3 size={13} /> {formatRelativeDate(thread.updatedAt)}</span>
                          <span><MessageSquare size={13} /> {thread.replyCount} comments</span>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="dashboard-v2__right-column">
            <section className="dashboard-v2__profile-card">
              <div className="dashboard-v2__profile-cover" aria-hidden="true" />
              <div className="dashboard-v2__profile-body">
                <div className="dashboard-v2__profile-avatar">
                  {profileLoading ? (
                    <span>...</span>
                        ) : profilePictureSrc ? (
                          <img src={profilePictureSrc ?? undefined} alt={displayName} />
                  ) : (
                    <span>{profileInitials || 'JD'}</span>
                  )}
                </div>
                <h2>{displayName}</h2>
                <p>{profileHeadline}</p>
                <span className="dashboard-v2__role-pill">{roleBadge}</span>
                <Link to="/profile" className="dashboard-v2__profile-btn">View Profile</Link>
              </div>
            </section>

            <section className="dashboard-v2__side-card">
              <div className="dashboard-v2__side-card-icon"><Sparkles size={16} /></div>
              <h3>Smart Notes</h3>
              <p>AI-Powered</p>
              <small>Write notes and discover related discussions from your academic community in real-time.</small>
              <button type="button" onClick={() => openPlaceholder('Smart Notes')}>Try Smart Notes</button>
            </section>

            <section className="dashboard-v2__side-card dashboard-v2__side-card--links">
              <h3>Quick Links</h3>
              <button type="button" className="dashboard-v2__quick-link" onClick={() => openPlaceholder('Find a Mentor')}>
                <UserPlus size={14} />
                Find a Mentor
              </button>
              <button type="button" className="dashboard-v2__quick-link" onClick={() => navigate('/study-groups')}>
                <Users size={14} />
                Study Groups
              </button>
              <button type="button" className="dashboard-v2__quick-link" onClick={() => openPlaceholder('Campus Events')}>
                <CalendarDays size={14} />
                Campus Events
              </button>
              <button type="button" className="dashboard-v2__quick-link" onClick={() => openPlaceholder('Resources & FAQs')}>
                <FolderOpen size={14} />
                Resources & FAQs
              </button>
            </section>

            <button type="button" className="dashboard-v2__logout" onClick={handleLogout}>Log out</button>
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return 'just now';
  }

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
