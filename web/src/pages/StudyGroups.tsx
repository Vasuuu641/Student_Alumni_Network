import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Globe, Loader2, LockKeyhole, Plus, Search, UserPlus, Users, X } from 'lucide-react';
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
  const [initialMembersText, setInitialMembersText] = useState('');
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
  const displayedGroups = tab === 'DISCOVER' ? filteredGroups : filteredGroups;

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

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const groupName = name.trim();
    const groupDescription = description.trim();
    const initialMemberIds = Array.from(
      new Set(
        initialMembersText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );

    if (!groupName || !groupDescription || initialMemberIds.length < 1) {
      setCreateError('Please provide name, description, and at least one member user ID.');
      return;
    }

    try {
      setIsCreating(true);
      setCreateError('');
      const created = await createStudyGroup({
        name: groupName,
        description: groupDescription,
        visibility,
        initialMemberIds,
      });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setInitialMembersText('');
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
    <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[34px] font-extrabold tracking-tight text-slate-900">Study Groups</h1>
            <p className="mt-1 text-sm text-slate-500">Collaborate with peers on shared subjects</p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="get-started" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              Create Group
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
            <TabButton active={tab === 'MY'} onClick={() => setTab('MY')} icon={<BookOpen size={15} />}>
              My Groups ({tab === 'MY' ? groups.length : 0})
            </TabButton>
            <TabButton active={tab === 'DISCOVER'} onClick={() => setTab('DISCOVER')} icon={<Globe size={15} />}>
              Discover
            </TabButton>
          </div>

          <div className="flex min-w-0 items-center gap-3 sm:w-[300px]">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search groups..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 animate-spin" size={18} /> Loading study groups...
              </div>
            ) : displayedGroups.length === 0 ? (
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
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                {displayedGroups.map((group) => {
                  const isOwner = group.ownerId === currentUserId;
                  const isArchived = group.status !== 'ACTIVE';
                  const canJoin = group.visibility === 'PUBLIC' && !isOwner && !isArchived;
                  const visibilityMeta = VISIBILITY_META[group.visibility] ?? VISIBILITY_META.PUBLIC;
                  const statusMeta = STATUS_META[group.status] ?? STATUS_META.ACTIVE;

                  return (
                    <article key={group.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e7eefc] text-[#2f66e9]">
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <h3 className="text-[31px] text-lg font-bold text-slate-900">{group.name}</h3>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusChip label={visibilityMeta.label} className={visibilityMeta.className} icon={visibilityMeta.icon} />
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            High Activity
                          </span>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-2 text-[28px] text-base leading-7 text-slate-500">{group.description}</p>

                      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                        <span>{isOwner ? 'Owned by you' : `Owner ${shortId(group.ownerId)}`}</span>
                        <span>{statusMeta.label}</span>
                      </div>

                      <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        Created {formatDate(group.createdAt)}
                      </div>

                      <div className="mt-4 flex gap-2">
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

        {tab === 'DISCOVER' && publicGroups.length > 0 ? (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-500">Popular Public Groups</h3>
            <div className="grid gap-3 md:grid-cols-3">
              {publicGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => navigate(`/study-groups/${group.id}`)}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:bg-slate-100"
                >
                  <p className="truncate text-sm font-semibold text-slate-900">{group.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{group.description}</p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
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
                <span className="mb-2 block text-sm font-semibold text-slate-700">Initial member IDs or emails</span>
                <input
                  value={initialMembersText}
                  onChange={(event) => setInitialMembersText(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder="Paste comma-separated user IDs or neptun emails (at least one)"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Group creator is auto-added. Add at least one more valid user ID or email so group size is 2+.
                </p>
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
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${active ? 'border-slate-300 bg-white text-slate-900 shadow-sm' : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50'}`}
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
