// src/components/notes/PresenceAvatars.tsx
import { usePresence, NoteRole, PresenceUser } from '../../hooks/usePresence'
import { stringToColor } from '../../lib/utils'

interface CurrentUser {
  userId: string
  name: string
  email?: string | null
  color: string
  role: NoteRole
}

interface Props {
  noteId: string
  currentUser: CurrentUser
  initialPresence?: PresenceUser[] 
}

// Generate initials from a name or userId fallback
function getInitials(name: string): string {
  if (!name?.trim()) return '??'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Role badge color
function getRoleBadgeClass(role: NoteRole): string {
  switch (role) {
    case 'OWNER':  return 'bg-purple-100 text-purple-700'
    case 'EDITOR': return 'bg-blue-100 text-blue-700'
    case 'VIEWER': return 'bg-gray-100 text-gray-600'
  }
}

export function PresenceAvatars({ noteId, currentUser, initialPresence = []}: Props) {
  const { presentUsers } = usePresence(noteId, initialPresence)

  // Show only other collaborators online (exclude self)
  const allUsers = presentUsers.filter((user) => user.userId !== currentUser.userId)

  // Cap visible avatars — show +N if there are more
  const MAX_VISIBLE = 4
  const visible = allUsers.slice(0, MAX_VISIBLE)
  const overflow = allUsers.length - MAX_VISIBLE

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {visible.map((user, index) => {
          const isCurrentUser = user.userId === currentUser.userId
          const name = isCurrentUser
            ? currentUser.name
            : (user.displayName ?? user.email ?? user.userId)
          const email = isCurrentUser ? currentUser.email : user.email
          const color = isCurrentUser ? currentUser.color : stringToColor(user.userId)

          return (
            <div key={user.userId} className="relative group">
              {/* Avatar circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center
                           text-white text-xs font-medium ring-2 ring-white
                           cursor-default select-none"
                style={{ backgroundColor: color, zIndex: visible.length - index }}
              >
                {getInitials(name)}
              </div>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                              hidden group-hover:flex flex-col items-center
                              pointer-events-none z-50">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1
                                whitespace-nowrap">
                  {isCurrentUser
                    ? `${currentUser.name} (you)`
                    : (user.displayName ?? user.userId)}
                </div>
                {email && (
                  <div className="text-[10px] rounded px-1.5 py-0.5 mt-0.5 bg-gray-800 text-gray-200">
                    {email}
                  </div>
                )}
                <div className={`text-xs rounded px-1.5 py-0.5 mt-0.5 ${getRoleBadgeClass(user.role)}`}>
                  {user.role.toLowerCase()}
                </div>
                {/* Tooltip arrow */}
                <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
              </div>
            </div>
          )
        })}

        {/* Overflow pill */}
        {overflow > 0 && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center
                          justify-center text-gray-600 text-xs font-medium
                          ring-2 ring-white">
            +{overflow}
          </div>
        )}
      </div>

      {/* Live indicator dot */}
      <div className="flex items-center gap-1">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-gray-400">
          {allUsers.length} online
        </span>
      </div>
    </div>
  )
}

