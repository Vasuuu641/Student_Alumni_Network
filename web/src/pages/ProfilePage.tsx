import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getAccessToken, getRoleFromAccessToken, type UserRole } from '../lib/auth';
import { getCurrentUserProfile, type UserProfileData } from '../api/profile.api';
import { listThreads, type Thread } from '../api/threads.api';
import { listUserNotes, type Note } from '../api/notes.api';
import Button from '../components/Button';
import {
  Mail,
  Briefcase,
  BookOpen,
  Sparkles,
  GraduationCap,
  ArrowLeft,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

function resolveProfilePictureUrl(profilePictureUrl?: string | null): string | null {
  if (!profilePictureUrl) {
    return null;
  }

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

  return `${API_BASE_URL}${normalizedPath}`;
}

interface ProfilePageProps {
  isOwnProfile?: boolean;
}

type ProfileTab = 'profile' | 'activity';

interface ActivityState {
  recentThreads: Thread[];
  recentNotes: Note[];
}

export function ProfilePage({ isOwnProfile = true }: ProfilePageProps) {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [activity, setActivity] = useState<ActivityState>({ recentThreads: [], recentNotes: [] });
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activityError, setActivityError] = useState('');

  const token = getAccessToken();
  const role = token ? getRoleFromAccessToken(token) : null;

  useEffect(() => {
    if (!token || !role || role === 'ADMIN') {
      return;
    }

    async function loadProfile() {
      try {
        setIsLoading(true);
        // role is narrowed to exclude null and 'ADMIN' by the guards above
        const data = await getCurrentUserProfile(role as Exclude<UserRole, 'ADMIN'>);
        setProfile(data);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Unable to load profile data.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [token, role]);

  useEffect(() => {
    if (!profile || activeTab !== 'activity') {
      return;
    }

    const profileUserId = profile.userId;

    async function loadActivity() {
      try {
        setIsLoadingActivity(true);
        setActivityError('');

        const [academicThreads, alumniThreads, noteResponse] = await Promise.all([
          listThreads({ panel: 'ACADEMIC', sortBy: 'newest', take: 20 }),
          listThreads({ panel: 'ALUMNI', sortBy: 'newest', take: 20 }),
          listUserNotes(),
        ]);

        const allThreads = [...academicThreads.threads, ...alumniThreads.threads];
        const recentThreads = allThreads
          .filter((thread) => thread.authorId === profileUserId)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 6);

        const recentNotes = [...noteResponse.notes]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 6);

        setActivity({ recentThreads, recentNotes });
      } catch (error) {
        setActivityError(error instanceof Error ? error.message : 'Unable to load recent activity.');
      } finally {
        setIsLoadingActivity(false);
      }
    }

    void loadActivity();
  }, [activeTab, profile]);

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">
          <p>Loading profile...</p>
        </div>
      </main>
    );
  }

  if (errorMessage || !profile) {
    return (
      <main className="profile-page">
        <button className="profile-back-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
          Go Back
        </button>
        <div className="profile-error">
          <p>{errorMessage || 'Unable to load profile.'}</p>
        </div>
      </main>
    );
  }

  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const isAnonymous = profile.isAnonymous && !isOwnProfile;
  const displayName = isAnonymous ? profile.anonymousName || 'Anonymous User' : fullName;
  const profilePictureSrc = resolveProfilePictureUrl(profile.profilePictureUrl);
  const profileTypeLabel =
    role === 'STUDENT'
      ? 'Student'
      : role === 'PROFESSOR'
        ? 'Professor'
        : role === 'ALUMNI'
          ? 'Alumni'
          : 'User';

  const profileHeadlineParts = [
    profile.jobTitle?.trim() || undefined,
    profile.major?.trim() || undefined,
    profile.company?.trim() || undefined,
  ].filter(Boolean) as string[];

  const profileHeadline =
    profileHeadlineParts.length > 0 ? profileHeadlineParts.join(' | ') : `${profileTypeLabel} at UniBridge`;

  const profileMetaParts = [
    profile.faculty?.trim() || undefined,
    profile.yearofGraduation ? `Class of ${profile.yearofGraduation}` : undefined,
  ].filter(Boolean) as string[];

  return (
    <main className="profile-page">
      <button
        className="profile-back-button"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={20} />
        Go Back
      </button>

      <div className="profile-container">
        {/* Header Section with Profile Picture and Basic Info */}
        <div className="profile-header">
          <div className="profile-header__cover" aria-hidden="true" />
          <div className="profile-header__content">
            <div className="profile-avatar">
              {profilePictureSrc ? (
                <img
                  src={profilePictureSrc}
                  alt={displayName}
                  className="profile-avatar__image"
                />
              ) : (
                <div className="profile-avatar__placeholder">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="profile-header__info">
              <h1 className="profile-name">{displayName}</h1>
              <p className="profile-headline">{profileHeadline}</p>
              <p className="profile-role">{profileTypeLabel}</p>
              {profileMetaParts.length > 0 ? (
                <p className="profile-meta">{profileMetaParts.join(' • ')}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="profile-section-tabs" role="tablist" aria-label="Profile sections">
          <button
            type="button"
            className={`profile-section-tab ${activeTab === 'profile' ? 'profile-section-tab--active' : ''}`}
            aria-selected={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            type="button"
            className={`profile-section-tab ${activeTab === 'activity' ? 'profile-section-tab--active' : ''}`}
            aria-selected={activeTab === 'activity'}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>

        {activeTab === 'profile' ? (
          <>
            {/* Main Content Grid */}
            <div className="profile-grid">
          {/* About Section */}
          {profile.bio && (
            <section className="profile-card">
              <div className="profile-card__header">
                <div className="profile-card__title-wrap">
                  <Sparkles size={20} />
                  <h2>About</h2>
                </div>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="profile-card-edit-link"
                    onClick={() => navigate('/onboarding?mode=edit&step=1')}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <p className="profile-card__text">{profile.bio}</p>
            </section>
          )}

          {/* Education Section */}
          {(profile.major || profile.yearofGraduation || profile.faculty) && (
            <section className="profile-card">
              <div className="profile-card__header">
                <div className="profile-card__title-wrap">
                  <BookOpen size={20} />
                  <h2>Education</h2>
                </div>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="profile-card-edit-link"
                    onClick={() => navigate('/onboarding?mode=edit&step=2')}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <div className="profile-card__content">
                {profile.faculty && (
                  <div className="profile-info-row">
                    <span className="info-label">Faculty</span>
                    <span className="info-value">{profile.faculty}</span>
                  </div>
                )}
                {profile.major && (
                  <div className="profile-info-row">
                    <span className="info-label">Major</span>
                    <span className="info-value">{profile.major}</span>
                  </div>
                )}
                {profile.yearofGraduation && (
                  <div className="profile-info-row">
                    <span className="info-label">Graduation Year</span>
                    <span className="info-value">{profile.yearofGraduation}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Work Experience Section */}
          {(profile.company || profile.jobTitle) && (
            <section className="profile-card">
              <div className="profile-card__header">
                <div className="profile-card__title-wrap">
                  <Briefcase size={20} />
                  <h2>Work Experience</h2>
                </div>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="profile-card-edit-link"
                    onClick={() => navigate('/onboarding?mode=edit&step=2')}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <div className="profile-card__content">
                {profile.jobTitle && (
                  <div className="profile-info-row">
                    <span className="info-label">Title</span>
                    <span className="info-value">{profile.jobTitle}</span>
                  </div>
                )}
                {profile.company && (
                  <div className="profile-info-row">
                    <span className="info-label">Company</span>
                    <span className="info-value">{profile.company}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Interests Section */}
          {profile.interests && profile.interests.length > 0 && (
            <section className="profile-card profile-card--full-width">
              <div className="profile-card__header">
                <div className="profile-card__title-wrap">
                  <GraduationCap size={20} />
                  <h2>Interests & Skills</h2>
                </div>
                {isOwnProfile ? (
                  <button
                    type="button"
                    className="profile-card-edit-link"
                    onClick={() => navigate('/onboarding?mode=edit&step=3')}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <div className="profile-tags">
                {profile.interests.map((interest, index) => (
                  <span key={index} className="profile-tag">
                    {interest}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Contact Section - Only visible to own profile */}
          {isOwnProfile && (
            <section className="profile-card profile-card--full-width">
              <div className="profile-card__header">
                <div className="profile-card__title-wrap">
                  <Mail size={20} />
                  <h2>Contact</h2>
                </div>
                <button
                  type="button"
                  className="profile-card-edit-link"
                  onClick={() => navigate('/onboarding?mode=edit&step=1')}
                >
                  Edit
                </button>
              </div>
              <div className="profile-card__content">
                <div className="profile-info-row">
                  <span className="info-label">Email</span>
                  <span className="info-value">{profile.email || 'Not available'}</span>
                </div>
              </div>
            </section>
          )}
            </div>

            {/* Empty State Message */}
            {!profile.bio &&
              !profile.major &&
              !profile.company &&
              (!profile.interests || profile.interests.length === 0) && (
                <div className="profile-empty-state">
                  <p>No profile information available yet.</p>
                  {isOwnProfile && (
                    <Button onClick={() => navigate('/onboarding')}>
                      Complete Your Profile
                    </Button>
                  )}
                </div>
              )}
          </>
        ) : (
          <section className="profile-card profile-activity-card">
            <div className="profile-card__header">
              <div className="profile-card__title-wrap">
                <Sparkles size={20} />
                <h2>Recent Activity</h2>
              </div>
            </div>

            {isLoadingActivity ? <p className="profile-card__text">Loading recent activity...</p> : null}
            {activityError ? <p className="profile-activity-error">{activityError}</p> : null}

            {!isLoadingActivity && !activityError ? (
              <div className="profile-activity-grid">
                <section>
                  <h3 className="profile-activity-title">Recent Discussions</h3>
                  {activity.recentThreads.length > 0 ? (
                    <ul className="profile-activity-list">
                      {activity.recentThreads.map((thread) => (
                        <li key={thread.id}>
                          <button
                            type="button"
                            className="profile-activity-link"
                            onClick={() => navigate(`/threads/${thread.id}`)}
                          >
                            <span>{thread.title}</span>
                            <small>{new Date(thread.updatedAt).toLocaleDateString()}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="profile-activity-empty">No recent discussion activity yet.</p>
                  )}
                </section>

                <section>
                  <h3 className="profile-activity-title">Recent Notes</h3>
                  {activity.recentNotes.length > 0 ? (
                    <ul className="profile-activity-list">
                      {activity.recentNotes.map((note) => (
                        <li key={note.id}>
                          <button
                            type="button"
                            className="profile-activity-link"
                            onClick={() => navigate(`/notes/${note.id}`)}
                          >
                            <span>{note.title || 'Untitled note'}</span>
                            <small>{new Date(note.updatedAt).toLocaleDateString()}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="profile-activity-empty">No recent note activity yet.</p>
                  )}
                </section>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
