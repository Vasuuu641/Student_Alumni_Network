import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BookOpen, Briefcase, CircleAlert, Filter, Globe, Loader2, LockKeyhole, MessageSquare, Plus, Search, Sparkles, UserPlus, Users, X } from 'lucide-react';
import { getAccessToken, getUserIdFromAccessToken } from '../lib/auth';
import Button from '../components/Button';
import {
  archiveStudyGroup,
  createStudyGroup,
  joinStudyGroup,
  listStudyGroups,
  type StudyGroup,
  type StudyGroupStatus,
  type StudyGroupVisibility,
} from '../api/study-groups.api';

type GroupTab = 'MY' | 'DISCOVER';

const VISIBILITY_META: Record<StudyGroupVisibility, { label: string; className: string; icon: typeof Globe }> = {
  PUBLIC: { label: 'Public', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: Globe },
  PRIVATE: { label: 'Private', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: LockKeyhole },
};

const STATUS_META: Record<StudyGroupStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  ARCHIVE: { label: 'Archived', className: 'border-slate-200 bg-slate-100 text-slate-600' },
  DELETED: { label: 'Deleted', className: 'border-rose-200 bg-rose-50 text-rose-700' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

export function StudyGroupsPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUserId = token ? getUserIdFromAccessToken(token) : null;

  const [tab, setTab] = useState<GroupTab>('MY');
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [featuredGroups, setFeaturedGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<StudyGroupVisibility>('PUBLIC');
  const [workingGroupId, setWorkingGroupId] = useState<string | null>(null);
  const isAuthenticated = Boolean(token);

  useEffect(() => {
    async function fetchFeaturedGroups() {
      if (!token) return;

      try {
        const publicGroups = await listStudyGroups({ visibility: 'PUBLIC' });
        setFeaturedGroups(publicGroups.filter((group) => group.status === 'ACTIVE'));
      } catch {
        setFeaturedGroups([]);
      }
    }

    void fetchFeaturedGroups();
  }, [token]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        setLoading(true);
        setErrorMessage('');

        const data =
          tab === 'DISCOVER'
            ? await listStudyGroups({ visibility: 'PUBLIC' })
            : await listStudyGroups();

        setGroups(data);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load study groups.');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      void fetchGroups();
    }
  }, [tab, token]);

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-900">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Users size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Sign in to view study groups</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Study groups are available to authenticated users only. Sign in to browse groups, join discussions, and create your own group.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="get-started" className="flex-1" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/register')}>
              Create account
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter((group) => {
      return (
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query) ||
        group.ownerId.toLowerCase().includes(query)
      );
    });
  }, [groups, searchText]);

  const publicGroups = useMemo(() => featuredGroups.slice(0, 3), [featuredGroups]);

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const groupName = name.trim();
    const groupDescription = description.trim();

    if (!groupName || !groupDescription) {
      setCreateError('Please provide a name and description.');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError('');
      const created = await createStudyGroup({ name: groupName, description: groupDescription, visibility });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setVisibility('PUBLIC');
      setGroups((prev) => [created, ...prev]);
      navigate(`/study-groups/${created.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Unable to create study group.');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoin(groupId: string) {
    try {
      setWorkingGroupId(groupId);
      await joinStudyGroup(groupId);
      navigate(`/study-groups/${groupId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to join group.');
    } finally {
      setWorkingGroupId(null);
    }
  }

  async function handleArchive(groupId: string) {
    try {
      setWorkingGroupId(groupId);
      const updated = await archiveStudyGroup(groupId);
      setGroups((prev) => prev.map((group) => (group.id === groupId ? updated : group)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to archive group.');
    } finally {
      setWorkingGroupId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Sparkles size={14} />
              Built for collaborative study
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Study Groups</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Browse public groups, manage the groups you own, and chat with members using the features the backend already supports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/dashboard')}>
              Back to dashboard
            </Button>
            <Button variant="get-started" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Create Group
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6">
        <div className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <h2 className="text-xl font-bold text-slate-900">What this version supports today</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The current backend supports group creation, browsing owned and public groups, joining/leaving public groups, member lists, text posts, and archive actions. AI recommendations and file uploads are not live yet, so they are intentionally kept out of the flow.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
              <InfoStat icon={<Users size={16} />} label="Group members" value="Live" />
              <InfoStat icon={<MessageSquare size={16} />} label="Text posts" value="Live" />
              <InfoStat icon={<CircleAlert size={16} />} label="AI & uploads" value="Coming soon" tone="muted" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row">
          <section className="flex-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                <TabButton active={tab === 'MY'} onClick={() => setTab('MY')} icon={<BookOpen size={15} />}>
                  My Groups
                </TabButton>
                <TabButton active={tab === 'DISCOVER'} onClick={() => setTab('DISCOVER')} icon={<Globe size={15} />}>
                  Discover
                </TabButton>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-md lg:justify-end">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <Search size={16} className="shrink-0 text-slate-400" />
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search groups..."
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
                <button className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600">
                  <Filter size={15} />
                  Filter
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 animate-spin" size={18} /> Loading study groups...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                <Users size={36} className="text-slate-300" />
                <h3 className="mt-3 text-lg font-semibold text-slate-900">No groups found</h3>
                <p className="mt-2 max-w-md text-sm text-slate-600">
                  {tab === 'DISCOVER'
                    ? 'There are no public groups to show yet. Try creating the first one.'
                    : 'You have not created any groups yet.'}
                </p>
                <Button variant="get-started" className="mt-4" onClick={() => setShowCreateModal(true)}>
                  Create Group
                </Button>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredGroups.map((group) => {
                  const isOwner = group.ownerId === currentUserId;
                  const isArchived = group.status !== 'ACTIVE';
                  const canJoin = group.visibility === 'PUBLIC' && !isOwner && !isArchived;

                  return (
                    <article key={group.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                            <Users size={18} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{group.name}</h3>
                            <p className="text-xs text-slate-500">Created {formatDate(group.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <StatusChip label={VISIBILITY_META[group.visibility].label} className={VISIBILITY_META[group.visibility].className} icon={VISIBILITY_META[group.visibility].icon} />
                          <StatusChip label={STATUS_META[group.status].label} className={STATUS_META[group.status].className} />
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{group.description}</p>

                      <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        Owner: <span className="font-semibold text-slate-800">{isOwner ? 'You' : shortId(group.ownerId)}</span>
                        {group.status === 'ACTIVE' ? ' · Ready for posts and members' : ' · Archived groups are read-only'}
                      </div>

                      <div className="mt-5 flex gap-3">
                        <Button variant="submit-wide" className="flex-1" onClick={() => navigate(`/study-groups/${group.id}`)}>
                          Open Group
                        </Button>

                        {isOwner ? (
                          <Button
                            variant="secondary"
                            disabled={workingGroupId === group.id || isArchived}
                            onClick={() => handleArchive(group.id)}
                          >
                            {workingGroupId === group.id ? 'Working…' : 'Archive'}
                          </Button>
                        ) : canJoin ? (
                          <Button
                            variant="secondary"
                            disabled={workingGroupId === group.id}
                            onClick={() => handleJoin(group.id)}
                          >
                            <UserPlus size={15} />
                            Join
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:max-w-md">
            <div className="flex items-center gap-2 text-slate-900">
              <Bell size={18} className="text-sky-600" />
              <h3 className="text-lg font-bold">Public groups to explore</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This panel uses the real public groups returned by the backend. It replaces the planned AI recommendation engine until that endpoint exists.
            </p>

            <div className="mt-4 space-y-3">
              {publicGroups.length > 0 ? (
                publicGroups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => navigate(`/study-groups/${group.id}`)}
                    className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:bg-slate-100"
                  >
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
                      <Briefcase size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate font-semibold text-slate-900">{group.name}</p>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                          Public
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{group.description}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                  No public groups available yet.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                <Plus size={13} />
                New study group
              </div>
              <h2 className="mt-3 text-2xl font-bold text-slate-900">Create Study Group</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Start with the fields the backend supports now: name, description, and visibility. AI matching and attachments can be added later without blocking this flow.
              </p>
            </div>

            {createError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {createError}
              </div>
            ) : null}

            <form className="mt-5 space-y-4" onSubmit={handleCreateGroup}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Group Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder="e.g. Advanced Calculus Study Group"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder="What should members expect from this study group?"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Visibility</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(['PUBLIC', 'PRIVATE'] as StudyGroupVisibility[]).map((choice) => {
                    const selected = visibility === choice;
                    const meta = VISIBILITY_META[choice];
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setVisibility(choice)}
                        className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200 bg-slate-50 hover:bg-white'}`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <meta.icon size={15} className={selected ? 'text-sky-600' : 'text-slate-400'} />
                          {meta.label}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {choice === 'PUBLIC' ? 'Anyone can discover and join.' : 'Invite-only, hidden from browse.'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button variant="get-started" type="submit" disabled={isCreating}>
                  {isCreating ? 'Creating…' : 'Create Group'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function TabButton({ active, icon, children, onClick }: { active: boolean; icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {icon}
      {children}
    </button>
  );
}

function StatusChip({ label, className, icon }: { label: string; className: string; icon?: React.ElementType }) {
  const Icon = icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {Icon ? <Icon size={11} /> : null}
      {label}
    </span>
  );
}

function InfoStat({ icon, label, value, tone = 'default' }: { icon: ReactNode; label: string; value: string; tone?: 'default' | 'muted' }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'muted' ? 'border-slate-200 bg-slate-50' : 'border-sky-100 bg-sky-50'}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}
