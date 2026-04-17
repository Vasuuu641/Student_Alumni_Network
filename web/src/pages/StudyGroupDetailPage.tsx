import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  LockKeyhole,
  Paperclip,
  Plus,
  Search,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import Button from '../components/Button';
import { PlatformTopNav } from '../components/PlatformTopNav';
import { getAccessToken, getUserIdFromAccessToken } from '../lib/auth';
import {
  addStudyGroupMember,
  createStudyGroupPost,
  deleteStudyGroup,
  getStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  listStudyGroupMembers,
  listStudyGroupPosts,
  listStudyGroups,
  type StudyGroup,
  type StudyGroupMember,
  type StudyGroupPost,
} from '../api/study-groups.api';

function shortId(value: string): string {
  return value.slice(0, 8);
}

function getPostDate(post: StudyGroupPost): string {
  const raw = (post as StudyGroupPost & { createdAt?: string }).createdAt;
  if (!raw) return 'Recent messages';
  return new Date(raw).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPostTime(post: StudyGroupPost): string {
  const raw = (post as StudyGroupPost & { createdAt?: string }).createdAt;
  if (!raw) return 'now';
  return new Date(raw).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function StudyGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUserId = token ? getUserIdFromAccessToken(token) : null;

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [members, setMembers] = useState<StudyGroupMember[]>([]);
  const [posts, setPosts] = useState<StudyGroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [composerValue, setComposerValue] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [working, setWorking] = useState(false);

  const isAuthenticated = Boolean(token);

  useEffect(() => {
    async function fetchData() {
      if (!groupId || !token) return;

      try {
        setLoading(true);
        setErrorMessage('');

        const [allGroups, groupData, membersData, postsData] = await Promise.all([
          listStudyGroups(),
          getStudyGroup(groupId),
          listStudyGroupMembers(groupId),
          listStudyGroupPosts(groupId),
        ]);

        setGroups(allGroups.filter((item) => item.status !== 'DELETED'));
        setGroup(groupData);
        setMembers(membersData);
        setPosts(postsData);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load study group.');
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [groupId, token]);

  const activeMembers = useMemo(() => members.filter((member) => member.joinStatus === 'ACTIVE'), [members]);
  const isOwner = group?.ownerId === currentUserId;
  const isMember = useMemo(() => {
    if (!currentUserId) return false;
    if (isOwner) return true;
    return activeMembers.some((member) => member.userId === currentUserId);
  }, [activeMembers, currentUserId, isOwner]);

  const canJoin = Boolean(group && group.visibility === 'PUBLIC' && group.status === 'ACTIVE' && !isMember);
  const canPost = Boolean(group && group.status === 'ACTIVE' && isMember);

  const filteredSidebarGroups = useMemo(() => {
    const query = sidebarSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups.filter((item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query));
  }, [groups, sidebarSearch]);

  const groupedPosts = useMemo(() => {
    const result: Record<string, StudyGroupPost[]> = {};
    posts.forEach((post) => {
      const dateLabel = getPostDate(post);
      if (!result[dateLabel]) {
        result[dateLabel] = [];
      }
      result[dateLabel].push(post);
    });
    return result;
  }, [posts]);

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-900">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Users size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Sign in to open this group</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">You need an authenticated session to open study groups and post messages.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="get-started" className="flex-1" onClick={() => navigate('/login')}>
              Sign in
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => navigate('/study-groups')}>
              Back
            </Button>
          </div>
        </div>
      </main>
    );
  }

  async function handleJoin() {
    if (!groupId) return;

    try {
      setWorking(true);
      await joinStudyGroup(groupId);
      const refreshedMembers = await listStudyGroupMembers(groupId);
      setMembers(refreshedMembers);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to join group.');
    } finally {
      setWorking(false);
    }
  }

  async function handleLeave() {
    if (!groupId) return;

    try {
      setWorking(true);
      await leaveStudyGroup(groupId);
      setMembers((prev) => prev.filter((member) => member.userId !== currentUserId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to leave group.');
    } finally {
      setWorking(false);
    }
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitPostFromComposer();
  }

  async function submitPostFromComposer() {
    const content = composerValue.trim();
    if (!groupId || !content || !canPost || working) return;

    try {
      setWorking(true);
      const post = await createStudyGroupPost(groupId, content);
      setPosts((prev) => [...prev, post]);
      setComposerValue('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to post to group.');
    } finally {
      setWorking(false);
    }
  }

  async function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await submitPostFromComposer();
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupId) return;

    const userId = newMemberId.trim();
    if (!userId) return;

    try {
      setAddingMember(true);
      setErrorMessage('');
      await addStudyGroupMember(groupId, { userId, role: 'MEMBER' });
      const refreshedMembers = await listStudyGroupMembers(groupId);
      setMembers(refreshedMembers);
      setNewMemberId('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add member.');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleDeleteGroup() {
    if (!groupId || !isOwner) return;

    const confirmed = window.confirm('Delete this group permanently from normal listings? This cannot be undone from the UI.');
    if (!confirmed) return;

    try {
      setWorking(true);
      await deleteStudyGroup(groupId);
      navigate('/study-groups');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete group.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="mr-2 animate-spin" size={18} /> Loading study group...
      </main>
    );
  }

  if (!group) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <p className="text-lg font-semibold text-slate-900">Study group not found</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/study-groups')}>
            Back to study groups
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden bg-slate-100 text-slate-900">
      <PlatformTopNav />
      <section className="mx-auto grid h-[calc(100dvh-56px)] w-full max-w-[1500px] grid-cols-1 overflow-hidden border-x border-slate-200 bg-white md:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        <aside className="hidden h-full flex-col border-r border-slate-200 bg-slate-50 md:flex">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Chats</h2>
              <button
                onClick={() => navigate('/study-groups')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                aria-label="Create or browse groups"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Search size={15} className="text-slate-400" />
              <input
                value={sidebarSearch}
                onChange={(event) => setSidebarSearch(event.target.value)}
                placeholder="Search groups..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredSidebarGroups.map((item) => {
              const selected = item.id === group.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(`/study-groups/${item.id}`)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${
                    selected ? 'bg-blue-50' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Users size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                      <span className="text-[11px] text-slate-400">{selected ? 'Open' : ''}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex h-full min-w-0 min-h-0 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 px-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 md:hidden"
                  onClick={() => navigate('/study-groups')}
                  aria-label="Back to group list"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="truncate text-lg font-bold text-slate-900">{group.name}</h1>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    group.visibility === 'PUBLIC'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {group.visibility.toLowerCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500">{activeMembers.length} members</p>
            </div>

            <div className="flex items-center gap-2">
              {canJoin ? (
                <Button variant="secondary" disabled={working} onClick={handleJoin}>
                  <UserPlus size={15} />
                  Join
                </Button>
              ) : null}
              {isMember && !isOwner ? (
                <Button variant="secondary" disabled={working} onClick={handleLeave}>
                  <UserMinus size={15} />
                  Leave
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => navigate('/study-groups')}>
                <ArrowLeft size={15} />
                All Groups
              </Button>
              {isOwner ? (
                <Button variant="secondary" disabled={working} onClick={handleDeleteGroup} className="text-rose-700">
                  <Trash2 size={15} />
                  Delete Group
                </Button>
              ) : null}
            </div>
          </header>

          {errorMessage ? (
            <div className="mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 sm:mx-6">{errorMessage}</div>
          ) : null}

          <div className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 sm:px-6">
            {Object.keys(groupedPosts).length > 0 ? (
              <div className="space-y-5">
                {Object.entries(groupedPosts).map(([date, dayPosts]) => (
                  <div key={date}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{date}</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <div className="space-y-2">
                      {dayPosts.map((post, index) => {
                        const own = post.authorId === currentUserId;
                        const previous = dayPosts[index - 1];
                        const showAuthor = !previous || previous.authorId !== post.authorId;

                        return (
                          <div key={post.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[70%] ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                              {showAuthor ? (
                                <p className="mb-1 px-1 text-xs font-semibold text-slate-500">
                                  {own ? 'You' : shortId(post.authorId)}
                                </p>
                              ) : null}
                              <div
                                className={`rounded-2xl px-4 py-2 text-sm leading-6 ${
                                  own ? 'rounded-br-md bg-blue-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                                }`}
                              >
                                {post.content}
                              </div>
                              <p className="mt-1 px-1 text-[11px] text-slate-400">{getPostTime(post)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-52 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center text-sm text-slate-600">
                No posts yet. Start the conversation in this group.
              </div>
            )}
          </div>

          <form onSubmit={handleCreatePost} className="border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex items-end gap-2 sm:gap-3">
              <button
                type="button"
                disabled
                title="File upload coming soon"
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
                aria-label="File upload coming soon"
              >
                <Paperclip size={17} />
              </button>

              <textarea
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                disabled={!canPost || working}
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder={canPost ? 'Type a message...' : 'Join the group to send messages.'}
              />

              <Button variant="get-started" type="submit" disabled={!canPost || !composerValue.trim() || working}>
                <Send size={15} />
                Send
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500">Attachment upload icon is shown as a placeholder until backend file APIs are implemented.</p>
          </form>
        </section>

        <aside className="hidden h-full flex-col border-l border-slate-200 bg-slate-50 xl:flex">
          <div className="border-b border-slate-200 px-4 py-4">
            <h2 className="text-base font-bold text-slate-900">Members ({activeMembers.length})</h2>
            <p className="mt-1 text-xs text-slate-500">Member names are unavailable from current API, so IDs are shown.</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {activeMembers.length > 0 ? (
              activeMembers.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                    {member.userId.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{member.userId === currentUserId ? 'You' : shortId(member.userId)}</p>
                    <p className="text-xs text-slate-500">{member.role}</p>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">No active members.</div>
            )}
          </div>

          {isOwner ? (
            <form onSubmit={handleAddMember} className="border-t border-slate-200 bg-white px-4 py-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LockKeyhole size={14} />
                Invite by ID/email
              </div>
              <input
                value={newMemberId}
                onChange={(event) => setNewMemberId(event.target.value)}
                placeholder="student@example.com"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
              />
              <Button variant="secondary" className="mt-2 w-full" type="submit" disabled={addingMember || !newMemberId.trim()}>
                {addingMember ? 'Adding...' : 'Add Member'}
              </Button>
            </form>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
