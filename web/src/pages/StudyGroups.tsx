import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Compass,
  Globe,
  Loader2,
  LockKeyhole,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getAccessToken, getUserIdFromAccessToken } from '../lib/auth';
import Button from '../components/Button';
import { PlatformTopNav } from '../components/PlatformTopNav';
import {
  archiveStudyGroup,
  createStudyGroup,
  deleteStudyGroup,
  joinStudyGroup,
  listStudyGroupMembers,
  listArchivedStudyGroups,
  listRecommendedStudyGroups,
  listStudyGroups,
  unarchiveStudyGroup,
  type RecommendedStudyGroup,
  type StudyGroup,
  type StudyGroupStatus,
  type StudyGroupVisibility,
} from '../api/study-groups.api';

type GroupTab = 'MY' | 'DISCOVER' | 'ARCHIVED';

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

export function StudyGroupsPage() {
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUserId = token ? getUserIdFromAccessToken(token) : null;

  const [tab, setTab] = useState<GroupTab>('MY');
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [recommendedGroups, setRecommendedGroups] = useState<RecommendedStudyGroup[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendationHint, setRecommendationHint] = useState('');

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
    async function fetchGroups() {
      if (!token) return;

      try {
        setLoading(true);
        setErrorMessage('');

        let data: StudyGroup[] = [];
        if (tab === 'DISCOVER') {
          data = await listStudyGroups({ visibility: 'PUBLIC' });
        } else if (tab === 'ARCHIVED') {
          data = await listArchivedStudyGroups();
        } else {
          data = await listStudyGroups();
        }

        setGroups(data);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load study groups.');
      } finally {
        setLoading(false);
      }
    }

    void fetchGroups();
  }, [tab, token]);

  useEffect(() => {
    async function fetchMemberCounts() {
      if (groups.length === 0) {
        setMemberCounts({});
        return;
      }

      const pairs = await Promise.all(
        groups.map(async (group) => {
          try {
            const members = await listStudyGroupMembers(group.id);
            const activeCount = members.filter((member) => member.joinStatus === 'ACTIVE').length;
            return [group.id, activeCount] as const;
          } catch {
            return [group.id, 0] as const;
          }
        }),
      );

      setMemberCounts(Object.fromEntries(pairs));
    }

    void fetchMemberCounts();
  }, [groups]);

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

  const aiSuggestedGroups = useMemo(() => {
    return recommendedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      score: Math.max(0, Math.min(100, Math.round(group.score * 100))),
    }));
  }, [recommendedGroups]);

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

    if (!groupName || !groupDescription) {
      setCreateError('Please provide group name and subject/topic.');
      return;
    }

    if (visibility === 'PRIVATE' && initialMemberIds.length < 1) {
      setCreateError('Private groups require at least one invitee when creating the group.');
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
      await refreshGroups();
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
      await archiveStudyGroup(groupId);
      await refreshGroups();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to archive group.');
    } finally {
      setWorkingGroupId(null);
    }
  }

  async function refreshRecommendations() {
    if (!token) return;

    try {
      setIsLoadingRecommendations(true);
      setRecommendationHint('');
      const data = await listRecommendedStudyGroups(3);
      setRecommendedGroups(data);
    } catch (error) {
      setRecommendedGroups([]);
      const message = (error as any)?.response?.data?.message;
      const resolvedMessage = Array.isArray(message) ? message.join(' ') : message;
      if (typeof resolvedMessage === 'string' && resolvedMessage.trim().length > 0) {
        setRecommendationHint(resolvedMessage);
      } else {
        setRecommendationHint('Add your interests in your profile to get personalized recommendations.');
      }
    } finally {
      setIsLoadingRecommendations(false);
    }
  }

  async function refreshGroups() {
    let nextGroups: StudyGroup[] = [];
    if (tab === 'DISCOVER') {
      nextGroups = await listStudyGroups({ visibility: 'PUBLIC' });
    } else if (tab === 'ARCHIVED') {
      nextGroups = await listArchivedStudyGroups();
    } else {
      nextGroups = await listStudyGroups();
    }

    setGroups(nextGroups);
  }

  async function handleUnarchive(groupId: string) {
    try {
      setWorkingGroupId(groupId);
      await unarchiveStudyGroup(groupId);
      await refreshGroups();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to unarchive group.');
    } finally {
      setWorkingGroupId(null);
    }
  }

  async function handleDelete(groupId: string) {
    const confirmed = window.confirm('Delete this group permanently from normal listings? This cannot be undone from the UI.');
    if (!confirmed) return;

    try {
      setWorkingGroupId(groupId);
      await deleteStudyGroup(groupId);
      await refreshGroups();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete group.');
    } finally {
      setWorkingGroupId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <PlatformTopNav />
      <section className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Study Groups</h1>
            <p className="mt-1 text-sm text-slate-600">Collaborate with peers on shared subjects</p>
          </div>
          <Button variant="get-started" onClick={() => setShowCreateModal(true)}>
            <Plus size={16} />
            Create Group
          </Button>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2 text-slate-900">
              <Sparkles size={16} className="mt-1 text-sky-600" />
              <div>
                <h2 className="text-xl font-bold">AI-Suggested Groups For You</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Run the LLM only when you want fresh recommendations.
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => void refreshRecommendations()} disabled={isLoadingRecommendations}>
              {isLoadingRecommendations ? 'Finding matches...' : 'Get recommendations'}
            </Button>
          </div>

          {aiSuggestedGroups.length > 0 ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {aiSuggestedGroups.map((group) => {
                return (
                  <article key={group.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                        <BookOpen size={18} />
                      </div>
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">{group.score}% match</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">{group.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{group.description}</p>
                    <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                      <span>{memberCounts[group.id] ?? 0} members</span>
                      <button
                        onClick={() => void handleJoin(group.id)}
                        className="inline-flex items-center gap-1.5 font-semibold text-sky-700 hover:text-sky-900"
                      >
                        <UserPlus size={14} />
                        Join
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {recommendationHint ? (
                <>
                  <p className="font-semibold text-slate-900">More profile details needed</p>
                  <p className="mt-1">{recommendationHint}</p>
                </>
              ) : (
                <>No recommendations loaded yet. Press <span className="font-semibold text-slate-900">Get recommendations</span> when you want the LLM to run.</>
              )}
            </div>
          )}
        </section>

        <section className="mt-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
              <TabButton active={tab === 'MY'} onClick={() => setTab('MY')} icon={<BookOpen size={15} />}>
                My Groups
              </TabButton>
              <TabButton active={tab === 'DISCOVER'} onClick={() => setTab('DISCOVER')} icon={<Compass size={15} />}>
                Discover
              </TabButton>
              <TabButton active={tab === 'ARCHIVED'} onClick={() => setTab('ARCHIVED')} icon={<BookOpen size={15} />}>
                Archived
              </TabButton>
            </div>

            <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 md:max-w-xs">
              <Search size={15} className="text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search groups..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
          ) : null}

          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-500">
              <Loader2 className="mr-2 animate-spin" size={18} /> Loading study groups...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
              <Users size={36} className="text-slate-300" />
              <h3 className="mt-3 text-lg font-semibold text-slate-900">No groups found</h3>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                {tab === 'DISCOVER'
                  ? 'There are no public groups to show yet. Try creating the first one.'
                  : tab === 'ARCHIVED'
                    ? 'You have not archived any groups yet.'
                    : 'You have not created or joined any groups yet.'}
              </p>
              {tab !== 'ARCHIVED' ? (
                <Button variant="get-started" className="mt-4" onClick={() => setShowCreateModal(true)}>
                  Create Group
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredGroups.map((group) => {
                const isOwner = group.ownerId === currentUserId;
                const isDiscoverTab = tab === 'DISCOVER';
                const isArchived = tab === 'ARCHIVED' || group.status !== 'ACTIVE';
                const canJoin = group.visibility === 'PUBLIC' && !isOwner && !isArchived;
                const visibilityMeta = VISIBILITY_META[group.visibility] ?? VISIBILITY_META.PUBLIC;
                const statusMeta = tab === 'ARCHIVED' ? STATUS_META.ARCHIVE : STATUS_META[group.status] ?? STATUS_META.ACTIVE;

                return (
                  <article key={group.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{group.name}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">Created {formatDate(group.createdAt)}</p>
                        </div>
                      </div>
                      <StatusChip label={visibilityMeta.label} className={visibilityMeta.className} icon={visibilityMeta.icon} />
                    </div>

                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{group.description}</p>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{memberCounts[group.id] ?? 0} members</span>
                      <StatusChip label={statusMeta.label} className={statusMeta.className} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {!isDiscoverTab ? (
                        <Button variant="submit-wide" className="flex-1" onClick={() => navigate(`/study-groups/${group.id}`)}>
                          Open Group
                        </Button>
                      ) : null}

                      {tab === 'ARCHIVED' ? (
                        <Button variant="secondary" disabled={workingGroupId === group.id} onClick={() => handleUnarchive(group.id)}>
                          {workingGroupId === group.id ? 'Working...' : 'Unarchive'}
                        </Button>
                      ) : (
                        <>
                          {!isDiscoverTab && !isArchived ? (
                            <Button
                              variant="secondary"
                              disabled={workingGroupId === group.id}
                              onClick={() => handleArchive(group.id)}
                            >
                              {workingGroupId === group.id ? 'Working...' : 'Archive'}
                            </Button>
                          ) : null}

                          {isOwner ? (
                            <Button
                              variant="secondary"
                              disabled={workingGroupId === group.id}
                              onClick={() => handleDelete(group.id)}
                              className="text-rose-700"
                            >
                              <Trash2 size={14} />
                              Delete
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
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            <h2 className="text-2xl font-bold text-slate-900">Create Study Group</h2>
            <p className="mt-1 text-sm text-slate-600">Start a new study group and invite peers to join.</p>

            {createError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{createError}</div>
            ) : null}

            <form className="mt-5 space-y-4" onSubmit={handleCreateGroup}>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Group Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder="e.g. Advanced Calculus Study Group"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Subject/Topic</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder="e.g. Mathematics, Computer Science"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Invitees (IDs or emails)</span>
                <input
                  value={initialMembersText}
                  onChange={(event) => setInitialMembersText(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                  placeholder={
                    visibility === 'PRIVATE'
                      ? 'Required for private groups: user-id-1, user-id-2'
                      : 'Optional for public groups: user-id-1, user-id-2'
                  }
                />
                <p className="mt-1 text-xs text-slate-500">
                  {visibility === 'PRIVATE'
                    ? 'Private groups need at least one person added at creation.'
                    : 'Public groups can be created without invitees, and you can invite people later.'}
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
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200 bg-slate-50 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                          <meta.icon size={15} className={selected ? 'text-sky-600' : 'text-slate-500'} />
                          {meta.label}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {choice === 'PUBLIC' ? 'Anyone can discover and join.' : 'Invite-only and hidden from browse.'}
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
                  {isCreating ? 'Creating...' : 'Create Group'}
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
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
        active ? 'border-slate-300 bg-white text-slate-900 shadow-sm' : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50'
      }`}
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
