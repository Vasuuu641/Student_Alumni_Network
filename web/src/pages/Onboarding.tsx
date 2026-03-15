import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getOnboardingProfile, updateOnboardingProfile } from '../api/onboarding';
import { getAccessToken, getRoleFromAccessToken, isTokenExpired, type UserRole } from '../lib/auth';
import Button from '../components/Button';

type EditableRole = Exclude<UserRole, 'ADMIN'>;

interface OnboardingFormState {
  firstName: string;
  lastName: string;
  major: string;
  yearOfGraduation: string;
  company: string;
  jobTitle: string;
  faculty: string;
  bio: string;
  interests: string[];
  isAnonymous: boolean;
  anonymousName: string;
}

const initialState: OnboardingFormState = {
  firstName: '',
  lastName: '',
  major: '',
  yearOfGraduation: '',
  company: '',
  jobTitle: '',
  faculty: '',
  bio: '',
  interests: [],
  isAnonymous: false,
  anonymousName: '',
};

const TOTAL_STEPS = 4;

export function OnboardingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<OnboardingFormState>(initialState);
  const [profilePicture, setProfilePicture] = useState<File | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [interestInput, setInterestInput] = useState('');

  const token = getAccessToken();

  const role = useMemo(() => {
    if (!token || isTokenExpired(token)) {
      return null;
    }
    return getRoleFromAccessToken(token);
  }, [token]);

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  const authToken: string = token;
  const editableRole: EditableRole = role;
  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoadingProfile(true);
      try {
        const profile = await getOnboardingProfile(authToken, editableRole);
        if (!isMounted) {
          return;
        }

        const hasExistingProfile =
          Boolean(profile.bio?.trim()) ||
          Boolean(profile.major?.trim()) ||
          Boolean(profile.faculty?.trim()) ||
          (profile.interests?.length ?? 0) > 0 ||
          Boolean(profile.company?.trim());

        if (hasExistingProfile) {
          navigate('/dashboard', { replace: true });
          return;
        }

        setForm((previous) => ({
          ...previous,
          firstName: profile.firstName ?? '',
          lastName: profile.lastName ?? '',
          major: profile.major ?? '',
          yearOfGraduation:
            profile.yearOfGraduation !== undefined && profile.yearOfGraduation !== null
              ? String(profile.yearOfGraduation)
              : profile.yearofGraduation !== undefined && profile.yearofGraduation !== null
                ? String(profile.yearofGraduation)
                : '',
          company: profile.company ?? '',
          jobTitle: profile.jobTitle ?? '',
          faculty: profile.faculty ?? '',
          bio: profile.bio ?? '',
          interests: profile.interests ?? [],
          isAnonymous: Boolean(profile.isAnonymous),
          anonymousName: profile.anonymousName ?? '',
        }));
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load current profile data.');
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [authToken, editableRole]);

  function setField<K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) {
    setSuccessMessage('');
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handlePictureChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSuccessMessage('');
    if (!file) {
      setProfilePicture(undefined);
      return;
    }

    setProfilePicture(file);
  }

  function nextStep() {
    setCurrentStep((previous) => Math.min(TOTAL_STEPS, previous + 1));
  }

  function previousStep() {
    setCurrentStep((previous) => Math.max(1, previous - 1));
  }

  function goToStep(step: number) {
    setCurrentStep(Math.max(1, Math.min(TOTAL_STEPS, step)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (currentStep !== TOTAL_STEPS) {
      return;
    }

    if (editableRole === 'ALUMNI' && form.isAnonymous && !form.anonymousName.trim()) {
      setErrorMessage('Anonymous nickname is required when anonymous mode is enabled.');
      setCurrentStep(3);
      return;
    }

    const payload: Record<string, unknown> = {};

    if (form.firstName.trim()) {
      payload.firstName = form.firstName.trim();
    }
    if (form.lastName.trim()) {
      payload.lastName = form.lastName.trim();
    }
    if (form.bio.trim()) {
      payload.bio = form.bio.trim();
    }

    if (form.interests.length > 0) {
      payload.interests = form.interests;
    }

    if (editableRole === 'ALUMNI') {
      if (form.yearOfGraduation.trim()) {
        payload.yearOfGraduation = Number(form.yearOfGraduation);
      }
      if (form.major.trim()) {
        payload.major = form.major.trim();
      }
      if (form.company.trim()) {
        payload.company = form.company.trim();
      }
      if (form.jobTitle.trim()) {
        payload.jobTitle = form.jobTitle.trim();
      }

      payload.isAnonymous = form.isAnonymous;
      if (form.isAnonymous && form.anonymousName.trim()) {
        payload.anonymousName = form.anonymousName.trim();
      }
    }

    if (editableRole === 'STUDENT') {
      if (form.major.trim()) {
        payload.major = form.major.trim();
      }
      if (form.yearOfGraduation.trim()) {
        payload.yearOfGraduation = Number(form.yearOfGraduation);
      }
      if (form.faculty.trim()) {
        payload.faculty = form.faculty.trim();
      }
      if (form.jobTitle.trim()) {
        payload.jobTitle = form.jobTitle.trim();
      }
      if (form.company.trim()) {
        payload.company = form.company.trim();
      }
    }

    if (editableRole === 'PROFESSOR') {
      if (form.faculty.trim()) {
        payload.faculty = form.faculty.trim();
      }
      if (form.jobTitle.trim()) {
        payload.jobTitle = form.jobTitle.trim();
      }
    }

    setIsSubmitting(true);
    try {
      await updateOnboardingProfile({
        token: authToken,
        role: editableRole,
        payload,
        profilePicture,
      });
      setSuccessMessage('Profile saved. Continue to dashboard when you are ready.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save onboarding information.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const roleTitle = role[0] + role.slice(1).toLowerCase();

  if (isLoadingProfile) {
    return (
      <main className="onboarding-page">
        <section className="onboarding-shell">
          <section className="onboarding-card">
            <p className="helper-text">Loading your profile...</p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-shell">
        <header className="onboarding-header">
          <div className="onboarding-step-row">
            <span>{`Step ${currentStep} of ${TOTAL_STEPS}`}</span>
            <span>{`${progressPercent}% complete`}</span>
          </div>
          <div className="onboarding-progress-track" aria-hidden="true">
            <span className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </header>

        <section className="onboarding-card">
          <div className="onboarding-card__title-wrap">
            <h1>
              {currentStep === 1
                ? 'Tell us about yourself'
                : currentStep === 2
                  ? 'Academic information'
                  : currentStep === 3
                    ? 'Interests, media, and privacy'
                    : 'Review and finish'}
            </h1>
            <p>{roleTitle} onboarding (all fields are optional)</p>
          </div>

          <form
            className="onboarding-form"
            onSubmit={handleSubmit}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && currentStep < TOTAL_STEPS) {
                event.preventDefault();
              }
            }}
          >
            {errorMessage ? <p className="status-banner status-banner--error">{errorMessage}</p> : null}
            {successMessage ? <p className="status-banner status-banner--success">{successMessage}</p> : null}

            {currentStep === 1 ? (
              <>
                <div className="form-grid">
                  <label className="field">
                    <span>First name</span>
                    <div className="input-shell">
                      <input
                        className="input"
                        type="text"
                        value={form.firstName}
                        onChange={(event) => setField('firstName', event.target.value)}
                        placeholder="John"
                      />
                    </div>
                  </label>

                  <label className="field">
                    <span>Last name</span>
                    <div className="input-shell">
                      <input
                        className="input"
                        type="text"
                        value={form.lastName}
                        onChange={(event) => setField('lastName', event.target.value)}
                        placeholder="Doe"
                      />
                    </div>
                  </label>
                </div>

                <label className="field">
                  <span>Bio</span>
                  <div className="input-shell input-shell--textarea">
                    <textarea
                      className="input onboarding-textarea"
                      value={form.bio}
                      onChange={(event) => setField('bio', event.target.value)}
                      placeholder="Share a bit about yourself"
                    />
                  </div>
                </label>
              </>
            ) : null}

            {currentStep === 2 ? (
              <>
                {role !== 'PROFESSOR' ? (
                  <div className="form-grid">
                    <label className="field">
                      <span>Department / Major</span>
                      <div className="input-shell">
                        <input
                          className="input"
                          type="text"
                          value={form.major}
                          onChange={(event) => setField('major', event.target.value)}
                          placeholder="Computer Science"
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Graduation year</span>
                      <div className="input-shell">
                        <input
                          className="input"
                          type="number"
                          value={form.yearOfGraduation}
                          onChange={(event) => setField('yearOfGraduation', event.target.value)}
                          placeholder="2026"
                          min={1900}
                          max={2100}
                        />
                      </div>
                    </label>
                  </div>
                ) : null}

                {role !== 'PROFESSOR' ? (
                  <div className="form-grid">
                    <label className="field">
                      <span>Current company</span>
                      <div className="input-shell">
                        <input
                          className="input"
                          type="text"
                          value={form.company}
                          onChange={(event) => setField('company', event.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Job title</span>
                      <div className="input-shell">
                        <input
                          className="input"
                          type="text"
                          value={form.jobTitle}
                          onChange={(event) => setField('jobTitle', event.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </label>
                  </div>
                ) : null}

                {role === 'STUDENT' || role === 'PROFESSOR' ? (
                  <label className="field">
                    <span>Faculty</span>
                    <div className="input-shell">
                      <input
                        className="input"
                        type="text"
                        value={form.faculty}
                        onChange={(event) => setField('faculty', event.target.value)}
                        placeholder="Engineering Faculty"
                      />
                    </div>
                  </label>
                ) : null}

                {role === 'PROFESSOR' ? (
                  <label className="field">
                    <span>Job title</span>
                    <div className="input-shell">
                      <input
                        className="input"
                        type="text"
                        value={form.jobTitle}
                        onChange={(event) => setField('jobTitle', event.target.value)}
                        placeholder="Associate Professor"
                      />
                    </div>
                  </label>
                ) : null}
              </>
            ) : null}

            {currentStep === 3 ? (
              <>
                <div className="field">
                  <span className="field-label">Interests</span>
                  {form.interests.length > 0 ? (
                    <div className="onboarding-tags-container">
                      {form.interests.map((interest, index) => (
                        <span key={index} className="onboarding-tag">
                          {interest}
                          <button
                            type="button"
                            className="onboarding-tag__remove"
                            onClick={() =>
                              setField(
                                'interests',
                                form.interests.filter((_item, i) => i !== index),
                              )
                            }
                            aria-label={`Remove ${interest}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="input-shell">
                    <input
                      className="input"
                      type="text"
                      value={interestInput}
                      onChange={(event) => setInterestInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ',') {
                          event.preventDefault();
                          const trimmed = interestInput.trim().replace(/,+$/, '');
                          if (trimmed && !form.interests.includes(trimmed)) {
                            setField('interests', [...form.interests, trimmed]);
                          }
                          setInterestInput('');
                        } else if (event.key === 'Backspace' && !interestInput && form.interests.length > 0) {
                          setField('interests', form.interests.slice(0, -1));
                        }
                      }}
                      placeholder="Type an interest and press Enter"
                    />
                  </div>
                  <small className="helper-text">Press Enter or comma to add each interest</small>
                </div>

                <label className="field">
                  <span>Profile picture (optional)</span>
                  <input className="onboarding-file-input" type="file" accept="image/*" onChange={handlePictureChange} />
                </label>

                {role === 'ALUMNI' ? (
                  <section className="onboarding-anonymous-box">
                    <label className="onboarding-checkbox-row">
                      <input
                        type="checkbox"
                        checked={form.isAnonymous}
                        onChange={(event) => setField('isAnonymous', event.target.checked)}
                      />
                      <span>Show my profile anonymously</span>
                    </label>

                    {form.isAnonymous ? (
                      <label className="field">
                        <span>Anonymous nickname</span>
                        <div className="input-shell">
                          <input
                            className="input"
                            type="text"
                            value={form.anonymousName}
                            onChange={(event) => setField('anonymousName', event.target.value)}
                            placeholder="Campus Mentor 42"
                          />
                        </div>
                      </label>
                    ) : null}
                  </section>
                ) : null}

                <p className="helper-text">Next step: review everything before saving.</p>
              </>
            ) : null}

            {currentStep === 4 ? (
              <section className="onboarding-anonymous-box">
                <p className="helper-text">Review and save your profile details.</p>
                <ul className="onboarding-summary-list">
                  <li>{`Name: ${form.firstName || '-'} ${form.lastName || ''}`.trim()}</li>
                  <li>{`Bio: ${form.bio || '-'}`}</li>
                  <li>{`Major: ${form.major || '-'}`}</li>
                  <li>{`Graduation year: ${form.yearOfGraduation || '-'}`}</li>
                  <li>{`Faculty: ${form.faculty || '-'}`}</li>
                  <li>{`Company: ${form.company || '-'}`}</li>
                  <li>{`Job title: ${form.jobTitle || '-'}`}</li>
                  <li>{`Interests: ${form.interests.length > 0 ? form.interests.join(', ') : '-'}`}</li>
                  <li>{`Profile picture selected: ${profilePicture ? profilePicture.name : 'No'}`}</li>
                  {role === 'ALUMNI' ? <li>{`Anonymous: ${form.isAnonymous ? 'Yes' : 'No'}`}</li> : null}
                </ul>

                <div className="onboarding-review-edit-actions">
                  <Button type="button" variant="secondary" onClick={() => goToStep(1)}>
                    Edit basic info
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => goToStep(2)}>
                    Edit academics
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => goToStep(3)}>
                    Edit interests
                  </Button>
                </div>
              </section>
            ) : null}

            <div className="onboarding-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={currentStep === 1 ? () => navigate('/dashboard') : previousStep}
              >
                {currentStep === 1 ? 'Skip for now' : 'Back'}
              </Button>

              {currentStep < TOTAL_STEPS ? (
                <Button type="button" variant="submit" onClick={nextStep}>
                  Continue
                </Button>
              ) : (
                successMessage ? (
                  <Button
                    type="button"
                    variant="submit-wide"
                    onClick={() => navigate('/dashboard', { replace: true })}
                  >
                    Continue to dashboard
                  </Button>
                ) : (
                  <Button type="submit" variant="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Finish'}
                  </Button>
                )
              )}
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
