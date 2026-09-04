// Study Groups WebSocket Realtime Publisher contract
// Injected into use cases to decouple REST from WebSocket

export interface StudyGroupMemberInfo {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

export interface StudyGroupPostBroadcast {
  id: string;
  groupId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface StudyGroupInviteBroadcast {
  inviteId: string;
  groupId: string;
  invitedBy: string;
  invitedUserId: string;
  expiresAt: string;
}

export interface StudyGroupJoinRequestBroadcast {
  requestId: string;
  groupId: string;
  requesterUserId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
}

export interface StudyGroupsRealtimePublisher {
  // Member events
  broadcastMemberJoined(groupId: string, member: StudyGroupMemberInfo): void;
  broadcastMemberLeft(groupId: string, userId: string): void;
  broadcastMemberRoleUpdated(groupId: string, userId: string, newRole: string): void;
  broadcastInviteCreated(groupId: string, payload: StudyGroupInviteBroadcast): void;
  broadcastJoinRequestUpdated(groupId: string, payload: StudyGroupJoinRequestBroadcast): void;

  // Post events
  broadcastPostCreated(groupId: string, post: StudyGroupPostBroadcast): void;
  broadcastPostEdited(groupId: string, postId: string, content: string, editedAt: string): void;
  broadcastPostDeleted(groupId: string, postId: string): void;
}
