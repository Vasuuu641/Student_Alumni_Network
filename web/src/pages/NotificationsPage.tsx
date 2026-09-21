// src/pages/NotificationsPage.tsx
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCheck,
  CircleArrowRight,
  Mail,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { getAccessToken, getRoleFromAccessToken } from '../lib/auth';
import { PlatformTopNav } from '../components/PlatformTopNav';
import {
  dismissNotification,
  getNotificationPreferences,
  listNotificationMutes,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  muteNotificationSource,
  unmuteNotification,
  updateNotificationPreferences,
  type NotificationItem,
  type NotificationMute,
  type NotificationPreferences,
} from '../api/notifications.api';

type SectionTab = 'notifications' | 'mutes' | 'preferences';
type ReadFilter = 'all' | 'unread';

const PAGE_SIZE = 20;

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function describeMute(mute: NotificationMute): string {
  if (mute.scope === 'CATEGORY') {
    return `Category: ${mute.category} (${mute.sourceModule})`;
  }
  return `${mute.entityType ?? 'Item'} in ${mute.sourceModule}`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const role = token ? getRoleFromAccessToken(token) : null;

  const [activeTab, setActiveTab] = useState<SectionTab>('notifications');

  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [mutes, setMutes] = useState<NotificationMute[]>([]);
  const [mutesLoading, setMutesLoading] = useState(false);
  const [mutesError, setMutesError] = useState<string | null>(null);
  const [workingMuteId, setWorkingMuteId] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [savingPreferenceKey, setSavingPreferenceKey] = useState<string | null>(null);

  const loadNotifications = useCallback(async (targetPage: number, filter: ReadFilter) => {
    try {
      setNotificationsLoading(true);
      setNotificationsError(null);
      const response = await listNotifications({
        skip: targetPage * PAGE_SIZE,
        take: PAGE_SIZE,
        unreadOnly: filter === 'unread',
      });
      setNotifications(response.notifications);
      setTotal(response.total);
    } catch {
      setNotificationsError('Could not load notifications right now.');
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadNotifications(page, readFilter);
  }, [token, page, readFilter, loadNotifications]);

  const loadMutes = useCallback(async () => {
    try {
      setMutesLoading(true);
      setMutesError(null);
      const response = await listNotificationMutes();
      setMutes(response.mutes);
    } catch {
      setMutesError('Could not load muted sources right now.');
    } finally {
      setMutesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token || activeTab !== 'mutes') return;
    void loadMutes();
  }, [token, activeTab, loadMutes]);

  const loadPreferences = useCallback(async () => {
    try {
      setPreferencesLoading(true);
      setPreferencesError(null);
      const response = await getNotificationPreferences();
      setPreferences(response.preferences);
    } catch {
      setPreferencesError('Could not load preferences right now.');
    } finally {
      setPreferencesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token || activeTab !== 'preferences') return;
    void loadPreferences();
  }, [token, activeTab, loadPreferences]);

  async function handleOpenNotification(notification: NotificationItem) {
    try {
      if (!notification.isRead) {
        await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() }
              : item,
          ),
        );
      }

      if (!notification.actionUrl) return;

      if (notification.actionUrl.startsWith('/')) {
        navigate(notification.actionUrl);
        return;
      }

      window.open(notification.actionUrl, '_blank', 'noopener,noreferrer');
    } catch {
      setNotificationsError('Could not open that notification right now.');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? new Date().toISOString() })),
      );
    } catch {
      setNotificationsError('Could not mark notifications as read right now.');
    }
  }

  async function handleDismiss(notification: NotificationItem) {
    try {
      setWorkingId(notification.id);
      await dismissNotification(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      setTotal((count) => Math.max(0, count - 1));
    } catch {
      setNotificationsError('Could not dismiss that notification right now.');
    } finally {
      setWorkingId(null);
    }
  }

  async function handleMuteSource(notification: NotificationItem) {
    try {
      setWorkingId(notification.id);
      await muteNotificationSource(notification.id);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      setTotal((count) => Math.max(0, count - 1));
    } catch {
      setNotificationsError('Could not mute that source right now.');
    } finally {
      setWorkingId(null);
    }
  }

  async function handleUnmute(mute: NotificationMute) {
    try {
      setWorkingMuteId(mute.id);
      await unmuteNotification(mute.id);
      setMutes((current) => current.filter((item) => item.id !== mute.id));
    } catch {
      setMutesError('Could not remove that mute right now.');
    } finally {
      setWorkingMuteId(null);
    }
  }

  async function handleTogglePreference(key: keyof Pick<NotificationPreferences, 'inAppEnabled' | 'emailEnabled' | 'pushEnabled'>) {
    if (!preferences) return;

    const nextValue = !preferences[key];
    const previous = preferences;

    try {
      setSavingPreferenceKey(key);
      setPreferences({ ...preferences, [key]: nextValue });
      const response = await updateNotificationPreferences({ [key]: nextValue });
      setPreferences(response.preferences);
    } catch {
      setPreferences(previous);
      setPreferencesError('Could not save that preference right now.');
    } finally {
      setSavingPreferenceKey(null);
    }
  }

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrev = page > 0;
  const canGoNext = page + 1 < totalPages;

  return (
    <main className="notifications-page">
      <PlatformTopNav role={role} />

      <div className="notifications-page__container">
        <button type="button" className="profile-back-button" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="notifications-page__header">
          <h1>Notifications</h1>
          <p>Manage what you're notified about and how.</p>
        </div>

        <div className="profile-section-tabs">
          <button
            type="button"
            className={activeTab === 'notifications' ? 'profile-section-tab profile-section-tab--active' : 'profile-section-tab'}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={14} /> All Notifications
          </button>
          <button
            type="button"
            className={activeTab === 'mutes' ? 'profile-section-tab profile-section-tab--active' : 'profile-section-tab'}
            onClick={() => setActiveTab('mutes')}
          >
            <BellOff size={14} /> Muted Sources
          </button>
          <button
            type="button"
            className={activeTab === 'preferences' ? 'profile-section-tab profile-section-tab--active' : 'profile-section-tab'}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
        </div>

        {activeTab === 'notifications' ? (
          <section className="notifications-page__panel">
            <div className="notifications-page__panel-head">
              <div className="notifications-page__filter-tabs">
                <button
                  type="button"
                  className={readFilter === 'all' ? 'notifications-page__filter-tab notifications-page__filter-tab--active' : 'notifications-page__filter-tab'}
                  onClick={() => {
                    setReadFilter('all');
                    setPage(0);
                  }}
                >
                  All
                </button>
                <button
                  type="button"
                  className={readFilter === 'unread' ? 'notifications-page__filter-tab notifications-page__filter-tab--active' : 'notifications-page__filter-tab'}
                  onClick={() => {
                    setReadFilter('unread');
                    setPage(0);
                  }}
                >
                  Unread
                </button>
              </div>

              <button
                type="button"
                className="dashboard-v2__notifications-action"
                onClick={() => void handleMarkAllRead()}
                disabled={notificationsLoading || notifications.length === 0}
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            </div>

            {notificationsError ? <p className="status-banner status-banner--error">{notificationsError}</p> : null}

            <div className="notifications-page__list">
              {notificationsLoading ? (
                <div className="dashboard-v2__empty">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="dashboard-v2__empty">
                  {readFilter === 'unread' ? 'No unread notifications.' : "You're all caught up."}
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={
                      notification.isRead
                        ? 'dashboard-v2__notification-item dashboard-v2__notification-item--read'
                        : 'dashboard-v2__notification-item'
                    }
                  >
                    <button
                      type="button"
                      className="dashboard-v2__notification-open"
                      onClick={() => void handleOpenNotification(notification)}
                    >
                      <div className="dashboard-v2__notification-copy">
                        <strong>{notification.title}</strong>
                        <p>{notification.body}</p>
                        <small>
                          {notification.sourceModule} · {formatRelativeDate(notification.createdAt)}
                        </small>
                      </div>
                      <span className="dashboard-v2__notification-goal">
                        <CircleArrowRight size={14} />
                      </span>
                    </button>
                    <div className="dashboard-v2__notification-item-actions">
                      <button
                        type="button"
                        className="dashboard-v2__notification-icon-btn"
                        onClick={() => void handleMuteSource(notification)}
                        disabled={workingId === notification.id}
                        aria-label="Mute this source"
                        title="Mute this source"
                      >
                        <BellOff size={13} />
                      </button>
                      <button
                        type="button"
                        className="dashboard-v2__notification-icon-btn"
                        onClick={() => void handleDismiss(notification)}
                        disabled={workingId === notification.id}
                        aria-label="Dismiss"
                        title="Dismiss"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!notificationsLoading && total > PAGE_SIZE ? (
              <div className="notifications-page__pagination">
                <button
                  type="button"
                  className="threads-secondary-btn"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={!canGoPrev}
                >
                  Previous
                </button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  className="threads-secondary-btn"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!canGoNext}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === 'mutes' ? (
          <section className="notifications-page__panel">
            {mutesError ? <p className="status-banner status-banner--error">{mutesError}</p> : null}

            <div className="notifications-page__list">
              {mutesLoading ? (
                <div className="dashboard-v2__empty">Loading muted sources...</div>
              ) : mutes.length === 0 ? (
                <div className="dashboard-v2__empty">You haven't muted anything yet.</div>
              ) : (
                mutes.map((mute) => (
                  <div key={mute.id} className="notifications-page__mute-row">
                    <div className="notifications-page__mute-copy">
                      <strong>{describeMute(mute)}</strong>
                      <small>Muted {formatRelativeDate(mute.createdAt)}</small>
                    </div>
                    <button
                      type="button"
                      className="dashboard-v2__notification-icon-btn"
                      onClick={() => void handleUnmute(mute)}
                      disabled={workingMuteId === mute.id}
                      aria-label="Unmute"
                      title="Unmute"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {activeTab === 'preferences' ? (
          <section className="notifications-page__panel">
            {preferencesError ? <p className="status-banner status-banner--error">{preferencesError}</p> : null}

            {preferencesLoading ? (
              <div className="dashboard-v2__empty">Loading preferences...</div>
            ) : preferences ? (
              <div className="notifications-page__preferences">
                <div className="notifications-page__preference-row">
                  <div className="notifications-page__preference-copy">
                    <Bell size={16} />
                    <div>
                      <strong>In-app notifications</strong>
                      <small>Show notifications in the bell dropdown and this page.</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={preferences.inAppEnabled ? 'notifications-page__toggle notifications-page__toggle--on' : 'notifications-page__toggle'}
                    onClick={() => void handleTogglePreference('inAppEnabled')}
                    disabled={savingPreferenceKey === 'inAppEnabled'}
                    role="switch"
                    aria-checked={preferences.inAppEnabled}
                  >
                    <span />
                  </button>
                </div>

                <div className="notifications-page__preference-row">
                  <div className="notifications-page__preference-copy">
                    <Mail size={16} />
                    <div>
                      <strong>Email notifications</strong>
                      <small>Get a copy of important notifications by email.</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={preferences.emailEnabled ? 'notifications-page__toggle notifications-page__toggle--on' : 'notifications-page__toggle'}
                    onClick={() => void handleTogglePreference('emailEnabled')}
                    disabled={savingPreferenceKey === 'emailEnabled'}
                    role="switch"
                    aria-checked={preferences.emailEnabled}
                  >
                    <span />
                  </button>
                </div>

                <div className="notifications-page__preference-row">
                  <div className="notifications-page__preference-copy">
                    <Smartphone size={16} />
                    <div>
                      <strong>Push notifications</strong>
                      <small>Get notified on your device, even when the app is closed.</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={preferences.pushEnabled ? 'notifications-page__toggle notifications-page__toggle--on' : 'notifications-page__toggle'}
                    onClick={() => void handleTogglePreference('pushEnabled')}
                    disabled={savingPreferenceKey === 'pushEnabled'}
                    role="switch"
                    aria-checked={preferences.pushEnabled}
                  >
                    <span />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}