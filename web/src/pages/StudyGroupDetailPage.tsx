import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Loader2, LockKeyhole, MessageSquare, Send, UserPlus, UserMinus, Users } from 'lucide-react';
import Button from '../components/Button';
import { getAccessToken, getUserIdFromAccessToken } from '../lib/auth';
import {
  createStudyGroupPost,
  getStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  listStudyGroupMembers,
  listStudyGroupPosts,
  type StudyGroup,
  type StudyGroupMember,
  type StudyGroupPost,
} from '../api/study-groups.api';

function shortId(value: string): string {
  return value.slice(0, 8);
}

export function StudyGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const token = getAccessToken();
  const currentUserId = token ? getUserIdFromAccessToken(token) : null;

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [members, setMembers] = useState<StudyGroupMember[]>([]);
  const [posts, setPosts] = useState<StudyGroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [composerValue, setComposerValue] = useState('');
  const [working, setWorking] = useState(false);
  const isAuthenticated = Boolean(token);

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center text-slate-900">
        <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <MessageSquare size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold">Sign in to open this group</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You need an authenticated session to open study groups and post in the discussion feed.
          </p>
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

  useEffect(() => {
    async function fetchData() {
      if (!groupId) return;

      try {
        setLoading(true);
        setErrorMessage('');

        const [groupData, membersData, postsData] = await Promise.all([
          getStudyGroup(groupId),
          listStudyGroupMembers(groupId),
          listStudyGroupPosts(groupId),
        ]);

        setGroup(groupData);
        setMembers(membersData);
        setPosts(postsData);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to load study group.');
      } finally {
        setLoading(false);
      }
    }

    if (groupId && token) {
      void fetchData();
    }
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

  async function handleJoin() {
    if (!groupId) return;
    try {
      setWorking(true);
      await joinStudyGroup(groupId);
      setMembers((prev) => [...prev, { userId: currentUserId ?? 'unknown', role: 'MEMBER', joinStatus: 'ACTIVE' }]);
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
    const content = composerValue.trim();
    if (!groupId || !content) return;

    try {
      setWorking(true);
      const post = await createStudyGroupPost(groupId, content);
      setPosts((prev) => [post, ...prev]);
      setComposerValue('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to post to group.');
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/study-groups')}>
              <ArrowLeft size={15} />
              Back
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{group.name}</h1>
                {group.visibility === 'PUBLIC' ? (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    Public
                  </span>
                ) : (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Private
                  </span>
                )}
                {group.status !== 'ACTIVE' ? (
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    Archived
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-600">Created by {isOwner ? 'you' : shortId(group.ownerId)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canJoin ? (
              <Button variant="get-started" disabled={working} onClick={handleJoin}>
                <UserPlus size={15} />
                Join group
              </Button>
            ) : null}
            {isMember && !isOwner ? (
              <Button variant="secondary" disabled={working} onClick={handleLeave}>
                <UserMinus size={15} />
                Leave group
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <Users size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">Members</p>
                <p className="text-2xl font-extrabold text-slate-900">{activeMembers.length}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">Current member list is powered by the backend’s membership endpoint. User display names are not exposed yet, so the UI uses member IDs.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <LockKeyhole size={16} className="text-sky-600" />
              <h2 className="text-base font-bold">Group details</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{group.description}</p>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div>Status: <span className="font-semibold text-slate-800">{group.status}</span></div>
              <div className="mt-1">Visibility: <span className="font-semibold text-slate-800">{group.visibility}</span></div>
              <div className="mt-1">Owner: <span className="font-semibold text-slate-800">{isOwner ? 'You' : shortId(group.ownerId)}</span></div>
            </div>
            {group.status === 'ACTIVE' ? (
              <Button variant="secondary" className="mt-4 w-full" disabled={working} onClick={() => navigate('/study-groups')}>
                Manage in list view
              </Button>
            ) : null}
          </div>

          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <Archive size={16} className="text-slate-500" />
              <h2 className="text-base font-bold">Not yet implemented</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              AI group recommendations, file uploads, and rich session scheduling are intentionally left out until their backend APIs exist.
            </p>
          </div>
        </aside>

        <section className="space-y-4">
          {errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-900">
              <MessageSquare size={18} className="text-sky-600" />
              <h2 className="text-lg font-bold">Discussion feed</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">Use text posts to keep conversations focused and light-weight for the current backend.</p>

            <form onSubmit={handleCreatePost} className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <textarea
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                disabled={!canPost || working}
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                placeholder={canPost ? 'Share an update, ask a question, or plan the next session...' : 'Join the group to post messages.'}
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Attachments and AI suggestions are not available yet.
                </p>
                <Button variant="get-started" type="submit" disabled={!canPost || !composerValue.trim() || working}>
                  <Send size={15} />
                  Post
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Members</h2>
                <p className="text-sm text-slate-600">{activeMembers.length} active members in this group.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activeMembers.length > 0 ? (
                activeMembers.map((member) => (
                  <div key={member.userId} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                      {member.userId.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{member.userId === currentUserId ? 'You' : shortId(member.userId)}</p>
                      <p className="text-xs text-slate-500">{member.role} · {member.joinStatus}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600 md:col-span-2">
                  No active members returned from the backend yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Recent posts</h2>
                <p className="text-sm text-slate-600">The backend currently exposes text-only posts.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <article key={post.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{post.authorId === currentUserId ? 'You' : shortId(post.authorId)}</span>
                      <span>Text post</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.content}</p>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                  No posts yet. Be the first to start the conversation.
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
