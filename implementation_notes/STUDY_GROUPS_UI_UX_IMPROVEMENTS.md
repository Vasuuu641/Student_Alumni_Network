# Study Groups Frontend UI/UX Improvements
## Building a WhatsApp/Teams-like Experience

---

## 1. Architecture Overview

### Current State
- Single detail page view (StudyGroupDetailPage.tsx)
- List view on separate page (StudyGroups.tsx)
- Basic member + posts display

### Recommended Structure
```
pages/
  ├── StudyGroupsPage.tsx (layout container)
  │   ├── components/
  │   │   ├── GroupSidebar.tsx (list + search)
  │   │   ├── ChatWindow.tsx (main content area)
  │   │   ├── GroupHeader.tsx (group info + actions)
  │   │   ├── MemberPanel.tsx (right sidebar)
  │   │   └── MessageInput.tsx (bottom composer)
  │   └── hooks/
  │       ├── useGroupChat.ts
  │       ├── useWebSocket.ts
  │       └── useGroupMembers.ts
```

---

## 2. Key UI Components

### A. Split-Pane Layout (Teams/Discord Style)

```tsx
// pages/StudyGroupsPage.tsx
export function StudyGroupsPage() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Left Sidebar - Groups List */}
      <div className="w-72 border-r border-slate-200 flex flex-col">
        <GroupSidebar />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {selectedGroup && (
          <>
            <GroupHeader group={selectedGroup} />
            <ChatWindow groupId={selectedGroup.id} />
            <MessageInput groupId={selectedGroup.id} />
          </>
        )}
      </div>

      {/* Right Sidebar - Members */}
      <div className="w-80 border-l border-slate-200 bg-slate-50 flex flex-col hidden lg:flex">
        <MemberPanel groupId={selectedGroup?.id} />
      </div>
    </div>
  );
}
```

### B. Group Sidebar (Left)
Features:
- **Search bar** with live filtering
- **Tabs**: "My Groups" | "Discover" | "Invites"
- **Group list** with:
  - Unread badge
  - Last message preview
  - Member count
  - Group icon/avatar
- **Create group button** (sticky top)

```tsx
// components/GroupSidebar.tsx
export function GroupSidebar() {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  return (
    <div className="flex flex-col h-full">
      {/* Create Group Button */}
      <div className="p-4 border-b border-slate-200">
        <Button 
          icon={Plus} 
          onClick={() => setShowCreateModal(true)}
          className="w-full"
        >
          New Group
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-slate-200">
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-100 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        {filteredGroups.map((group) => (
          <GroupListItem
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            unreadCount={unreadCounts[group.id] ?? 0}
            onClick={() => setSelectedGroupId(group.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface GroupListItemProps {
  group: StudyGroup;
  isSelected: boolean;
  unreadCount: number;
  onClick: () => void;
}

function GroupListItem({ group, isSelected, unreadCount, onClick }: GroupListItemProps) {
  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
        isSelected ? 'bg-sky-50 border-l-4 border-l-sky-500' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Group Avatar */}
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
          {group.name[0]}
        </div>

        {/* Group Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 truncate">{group.name}</h3>
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs font-bold rounded-full bg-sky-500 text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          {/* Last Message Preview */}
          <p className="text-sm text-slate-600 truncate">
            Last message: {group.lastMessagePreview || 'No messages yet'}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### C. Chat Window (Main)
Features:
- **Message thread** with timestamps
- **Messages grouped by day**
- **User avatars** on each message
- **Message actions** (edit, delete, react)
- **Auto-scroll** to new messages
- **Loading states**

```tsx
// components/ChatWindow.tsx
export function ChatWindow({ groupId }: { groupId: string }) {
  const [posts, setPosts] = useState<StudyGroupPost[]>([]);
  const [userInfo, setUserInfo] = useState<Record<string, any>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  // Group messages by date
  const groupedPosts = useMemo(() => {
    const groups: Record<string, StudyGroupPost[]> = {};
    posts.forEach((post) => {
      const date = new Date(post.createdAt).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(post);
    });
    return groups;
  }, [posts]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-white">
      {Object.entries(groupedPosts).map(([date, dayPosts]) => (
        <div key={date}>
          {/* Date Separator */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-500 font-medium">{date}</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Messages for this day */}
          {dayPosts.map((post, idx) => (
            <MessageBubble
              key={post.id}
              post={post}
              userInfo={userInfo[post.authorId]}
              showAvatar={
                idx === 0 || dayPosts[idx - 1].authorId !== post.authorId
              }
            />
          ))}
        </div>
      ))}
      <div ref={scrollRef} />
    </div>
  );
}

interface MessageBubbleProps {
  post: StudyGroupPost;
  userInfo?: any;
  showAvatar: boolean;
}

function MessageBubble({ post, userInfo, showAvatar }: MessageBubbleProps) {
  const isOwnMessage = post.authorId === getCurrentUserId();

  return (
    <div className={`flex gap-3 mb-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
      {showAvatar && (
        <div className="w-8 h-8 rounded-full bg-slate-300 flex-shrink-0 flex items-center justify-center">
          {userInfo?.avatar ? (
            <img src={userInfo.avatar} alt="" className="w-full h-full rounded-full" />
          ) : (
            <span className="text-xs font-bold text-white">
              {userInfo?.firstName?.[0]}
            </span>
          )}
        </div>
      )}
      {!showAvatar && <div className="w-8 flex-shrink-0" />}

      <div>
        {showAvatar && (
          <p className="text-xs text-slate-600 mb-1 font-semibold">
            {userInfo?.firstName} {userInfo?.lastName}
          </p>
        )}
        <div
          className={`px-4 py-2 rounded-lg ${
            isOwnMessage
              ? 'bg-sky-500 text-white rounded-tr-none'
              : 'bg-slate-100 text-slate-900 rounded-tl-none'
          }`}
        >
          <p className="break-words">{post.content}</p>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {new Date(post.createdAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
```

### D. Group Header (Top)
Features:
- **Group name** + member count
- **Pinned messages** icon
- **Search in group** icon
- **Invite members** button
- **Settings** dropdown (archive, leave, etc.)

```tsx
// components/GroupHeader.tsx
export function GroupHeader({ group }: { group: StudyGroup }) {
  const memberCount = useMemberCount(group.id);

  return (
    <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{group.name}</h2>
        <p className="text-xs text-slate-500">{memberCount} members</p>
      </div>

      <div className="flex items-center gap-2">
        <IconButton icon={Search} tooltip="Search messages" />
        <IconButton icon={Pin} tooltip="Pinned messages" />
        <IconButton icon={UserPlus} onClick={showInviteModal} tooltip="Add members" />
        
        <DropdownMenu>
          <DropdownItem icon={Users} onClick={showMemberList}>View all members</DropdownItem>
          <DropdownItem icon={Bell} onClick={toggleNotifications}>Notifications</DropdownItem>
          <DropdownItem icon={Settings} onClick={showGroupSettings}>Settings</DropdownItem>
          <DropdownItem icon={Archive} onClick={archiveGroup} className="text-red-600">
            Archive
          </DropdownItem>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

### E. Member Panel (Right)
Features:
- **Active members list**
- **Click member** to see profile
- **Member status** (online/offline - future)
- **Member actions** (message, invite, remove)

```tsx
// components/MemberPanel.tsx
export function MemberPanel({ groupId }: { groupId: string }) {
  const [members, setMembers] = useState<StudyGroupMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<StudyGroupMember | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <h3 className="font-bold text-slate-900">Members ({members.length})</h3>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto">
        {members.map((member) => (
          <MemberCard
            key={member.userId}
            member={member}
            isSelected={selectedMember?.userId === member.userId}
            onClick={() => setSelectedMember(member)}
          />
        ))}
      </div>

      {/* Selected Member Details */}
      {selectedMember && (
        <MemberDetails member={selectedMember} groupId={groupId} />
      )}
    </div>
  );
}

interface MemberCardProps {
  member: StudyGroupMember;
  isSelected: boolean;
  onClick: () => void;
}

function MemberCard({ member, isSelected, onClick }: MemberCardProps) {
  const userInfo = useUserInfo(member.userId);

  return (
    <div
      onClick={onClick}
      className={`p-3 border-b border-slate-100 cursor-pointer transition-colors ${
        isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-slate-300 flex-shrink-0 flex items-center justify-center">
          <span className="text-xs font-bold">{userInfo?.firstName?.[0]}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-900">
            {userInfo?.firstName} {userInfo?.lastName}
          </p>
          <p className="text-xs text-slate-500">{member.role}</p>
        </div>

        {/* Status */}
        <div className="w-2 h-2 rounded-full bg-green-500" /> {/* online status */}
      </div>
    </div>
  );
}

interface MemberDetailsProps {
  member: StudyGroupMember;
  groupId: string;
}

function MemberDetails({ member, groupId }: MemberDetailsProps) {
  const userInfo = useUserInfo(member.userId);
  const isOwner = useIsGroupOwner(groupId);

  return (
    <div className="p-4 border-t border-slate-200 bg-slate-100 space-y-3">
      {/* Profile Card */}
      <div className="bg-white rounded-lg p-4 space-y-2">
        <div className="w-16 h-16 rounded-lg bg-slate-300 mx-auto" />
        <h4 className="font-bold text-center">{userInfo?.firstName}</h4>
        <p className="text-xs text-slate-600 text-center">{userInfo?.interests?.join(', ')}</p>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button 
          size="sm"
          variant="outline"
          icon={MessageSquare}
          className="w-full"
        >
          Message
        </Button>
        {isOwner && (
          <Button 
            size="sm"
            variant="outline"
            className="w-full text-red-600"
          >
            Remove Member
          </Button>
        )}
      </div>
    </div>
  );
}
```

### F. Message Input Composer (Bottom)
Features:
- **Rich text input**
- **Emoji picker**
- **File upload button** (for future file support)
- **Send button**
- **Typing indicator** (future)

```tsx
// components/MessageInput.tsx
export function MessageInput({ groupId }: { groupId: string }) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await createStudyGroupPost(groupId, content.trim());
      setContent('');
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    // TODO: Implement file upload
    setIsUploading(true);
    try {
      await uploadFile(files[0], groupId);
      // Insert file reference into message
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="px-6 py-4 border-t border-slate-200 bg-white">
      <div className="flex gap-3 items-end">
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <Paperclip size={20} className="text-slate-600" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.xlsx,.zip,.jpg,.png,.gif"
        />

        {/* Message Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSend(e as any);
            }
          }}
          placeholder="Type a message... (Ctrl+Enter to send)"
          className="flex-1 px-4 py-2 rounded-lg bg-slate-100 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none max-h-24"
          rows={1}
        />

        {/* Emoji Picker */}
        <button
          type="button"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <SmilePlus size={20} className="text-slate-600" />
        </button>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!content.trim() || isUploading}
          className="px-4 py-2 bg-sky-500 text-white rounded-lg font-semibold hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Send size={18} />
              Send
            </>
          )}
        </button>
      </div>
    </form>
  );
}
```

---

## 3. Real-time Features (WebSocket Integration)

### A. WebSocket Hook
```tsx
// hooks/useWebSocket.ts
import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export function useGroupChatWebSocket(groupId: string) {
  const token = getAccessToken();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${API_BASE_URL}/study-groups`, {
      transports: ['websocket'],
      query: { token },
      extraHeaders: { authorization: `Bearer ${token}` },
    });

    socket.on('study-groups:post-created', (event) => {
      // Add new message to chat
      dispatch({ type: 'ADD_POST', payload: event });
    });

    socket.on('study-groups:member-joined', (event) => {
      // Show notification: "User X joined"
      dispatch({ type: 'MEMBER_JOINED', payload: event });
    });

    socket.on('study-groups:invite-created', (event) => {
      // Show notification for invites
      dispatch({ type: 'INVITE_CREATED', payload: event });
    });

    socketRef.current = socket;
    return () => socket.disconnect();
  }, [groupId, token]);

  return socketRef.current;
}
```

### B. Realtime Notifications
```tsx
// components/Notifications.tsx
export function useNotifications() {
  const socket = useGroupChatWebSocket(groupId);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    socket?.on('study-groups:post-created', (event) => {
      setNotifications((prev) => [
        ...prev,
        {
          id: uuid(),
          type: 'new-message',
          message: `New message in ${event.groupName}`,
          duration: 3000,
        },
      ]);
    });
  }, [socket]);

  return (
    <div className="fixed bottom-6 right-6 space-y-2 z-50">
      {notifications.map((notif) => (
        <Toast key={notif.id} notification={notif} onDismiss={() => removeNotification(notif.id)} />
      ))}
    </div>
  );
}
```

---

## 4. File Upload Architecture (For Future Implementation)

### Schema Extension
```sql
ALTER TABLE "StudyGroupPost" ADD COLUMN attachments JSON;
-- attachments: [{ id, name, url, type, size, uploadedAt }]
```

### API Endpoint
```typescript
// backend/src/presentation/study-groups/study-groups.controller.ts
@Post(':id/posts/with-files')
@UseGuards(JwtStrategy, RolesGuard)
@Roles('STUDENT', 'PROFESSOR')
@UseInterceptors(FileInterceptor('file'))
async createPostWithFile(
  @Req() request: any,
  @Param('id') groupId: string,
  @Body('content') content: string,
  @UploadedFile() file?: Express.Multer.File
) {
  // Save file to S3/storage
  // Create post with file reference
}
```

### Frontend Upload Handler
```tsx
const handleFileSelect = async (file: File) => {
  const formData = new FormData();
  formData.append('content', 'Shared a file: ' + file.name);
  formData.append('file', file);

  try {
    const post = await api.post(
      `/study-groups/${groupId}/posts/with-files`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    // Add to chat
  } catch (error) {
    showError('Upload failed');
  }
};
```

---

## 5. Search & Discovery

### In-Group Search
```tsx
// components/GroupSearch.tsx
export function GroupSearch({ groupId }: { groupId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudyGroupPost[]>([]);

  const handleSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      // Search via API
      const filtered = posts.filter((post) =>
        post.content.toLowerCase().includes(q.toLowerCase())
      );
      setResults(filtered);
    }, 300),
    [posts]
  );

  return (
    <div className="absolute top-16 right-0 w-96 bg-white border border-slate-200 rounded-lg shadow-lg">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          handleSearch(e.target.value);
        }}
        placeholder="Search messages..."
        className="w-full px-4 py-2 border-b border-slate-200"
      />
      <div className="max-h-96 overflow-y-auto">
        {results.map((post) => (
          <SearchResult key={post.id} post={post} onClick={() => jumpToMessage(post.id)} />
        ))}
      </div>
    </div>
  );
}
```

---

## 6. Member Profiles (Click to View)

### Member Detail Modal
```tsx
export function MemberProfileModal({ memberId, onClose }: any) {
  const user = useUserInfo(memberId);
  const [sharedGroups, setSharedGroups] = useState<StudyGroup[]>([]);

  useEffect(() => {
    // Fetch groups both users are in
    const shared = groups.filter((g) =>
      members.some((m) => m.userId === memberId && g.id === m.groupId)
    );
    setSharedGroups(shared);
  }, [memberId]);

  return (
    <Modal onClose={onClose} className="w-96">
      {/* Profile Header */}
      <div className="text-center p-6 border-b border-slate-200">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold">{user?.firstName} {user?.lastName}</h2>
        <p className="text-slate-600">{user?.role}</p>
      </div>

      {/* Bio & Interests */}
      <div className="p-6 space-y-4">
        {user?.bio && (
          <div>
            <label className="text-sm font-semibold text-slate-700">About</label>
            <p className="text-slate-600">{user.bio}</p>
          </div>
        )}

        {user?.interests?.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-slate-700">Interests</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {user.interests.map((interest) => (
                <span key={interest} className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Shared Groups */}
        {sharedGroups.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-slate-700">Shared Groups ({sharedGroups.length})</label>
            <div className="space-y-2 mt-2">
              {sharedGroups.map((group) => (
                <div key={group.id} className="p-2 bg-slate-50 rounded border border-slate-200">
                  <p className="font-semibold text-sm">{group.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 border-t border-slate-200 space-y-2">
        <Button icon={MessageSquare} className="w-full" variant="outline">
          Send Message
        </Button>
        <Button icon={UserPlus} className="w-full" variant="outline">
          Add to Group
        </Button>
      </div>
    </Modal>
  );
}
```

---

## 7. Styling with Tailwind CSS

### Color Scheme
```css
/* Sky/Blue palette for study focus */
Primary: sky-500 (#0ea5e9)
Secondary: slate-600 (#475569)
Accent: emerald-500 (for success)
Danger: rose-500 (for warnings)
```

### Responsive Breakpoints
```tsx
// Mobile: Sidebar hidden
// Tablet: Sidebar collapsible
// Desktop: Full 3-pane layout

export function StudyGroupsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile: Hide sidebar on small screens */}
      <div className="hidden md:flex md:w-72 lg:w-80 border-r">
        <GroupSidebar />
      </div>

      {/* Main area - responsive */}
      <div className="flex-1 flex flex-col">
        <GroupHeader />
        <ChatWindow />
        <MessageInput />
      </div>

      {/* Right sidebar - hidden on mobile/tablet */}
      <div className="hidden lg:flex lg:w-80 border-l bg-slate-50">
        <MemberPanel />
      </div>
    </div>
  );
}
```

---

## 8. Implementation Roadmap

### Phase 1 (High Priority)
- [ ] Split-pane layout restructure
- [ ] Enhanced chat window with timestamps + grouping
- [ ] Member list in right sidebar
- [ ] Click member to view profile
- [ ] Improved message input with file upload button (UI only)

### Phase 2 (Medium Priority)
- [ ] Real-time typing indicators
- [ ] Message reactions/emoji
- [ ] In-group search functionality
- [ ] Notification badges
- [ ] Member status (online/offline)

### Phase 3 (File Support)
- [ ] Backend file upload endpoints
- [ ] S3/Cloud storage integration
- [ ] File preview in messages
- [ ] Download tracking

### Phase 4 (Advanced)
- [ ] Message threading/replies
- [ ] Pinned messages
- [ ] Voice messages
- [ ] Video call integration

---

## 9. State Management Recommendation

### Use Zustand or Context API
```tsx
// store/groupChatStore.ts
import { create } from 'zustand';

interface ChatStore {
  selectedGroupId: string | null;
  posts: StudyGroupPost[];
  members: StudyGroupMember[];
  loading: boolean;
  error: string | null;

  selectGroup: (groupId: string) => void;
  addPost: (post: StudyGroupPost) => void;
  updateMembers: (members: StudyGroupMember[]) => void;
  setLoading: (loading: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  selectedGroupId: null,
  posts: [],
  members: [],
  loading: false,
  error: null,

  selectGroup: (groupId) => set({ selectedGroupId: groupId }),
  addPost: (post) => set((state) => ({ posts: [...state.posts, post] })),
  updateMembers: (members) => set({ members }),
  setLoading: (loading) => set({ loading }),
}));
```

---

## 10. Accessibility & Performance

### Accessibility
- Use semantic HTML (`<button>`, `<input>`, etc.)
- ARIA labels for icon-only buttons
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader support for notifications
- Color contrast ratios ≥ 4.5:1

### Performance
- Virtual scrolling for large message lists (use `react-window`)
- Lazy load member avatars
- Debounce search input
- Memoize components to prevent unnecessary re-renders
- Code split chat view from sidebar

```tsx
const ChatWindow = lazy(() => import('./ChatWindow'));
const GroupSidebar = lazy(() => import('./GroupSidebar'));
```

---

## Implementation Tips

1. **Start with layout**: Build the 3-pane structure first, then fill in components
2. **Use existing backend**: Your API already supports posts, members, and real-time events
3. **Progressive enhancement**: Add features incrementally (search → file upload → reactions)
4. **Mobile-first**: Design for mobile, then expand to tablet/desktop
5. **User testing**: Test with a few users to validate the chat experience

Good luck! This will feel much more like a real collaboration tool. 🚀
