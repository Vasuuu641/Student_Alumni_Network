import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getAccessToken, getRoleFromAccessToken, type UserRole } from '../lib/auth';
import { getCurrentUserProfile, type UserProfileData } from '../api/profile.api';
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

export function ProfilePage({ isOwnProfile = true }: ProfilePageProps) {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

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
              <p className="profile-role">
                {role === 'STUDENT'
                  ? 'Student'
                  : role === 'PROFESSOR'
                    ? 'Professor'
                    : role === 'ALUMNI'
                      ? 'Alumni'
                      : 'User'}
              </p>
            </div>
          </div>
        </div>

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
      </div>
    </main>
  );
}
