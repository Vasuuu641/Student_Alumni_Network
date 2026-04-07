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

export interface StudyGroupsRealtimePublisher {
  // Member events
  broadcastMemberJoined(groupId: string, member: StudyGroupMemberInfo): void;
  broadcastMemberLeft(groupId: string, userId: string): void;
  broadcastMemberRoleUpdated(groupId: string, userId: string, newRole: string): void;

  // Post events
  broadcastPostCreated(groupId: string, post: StudyGroupPostBroadcast): void;
  broadcastPostEdited(groupId: string, postId: string, content: string, editedAt: string): void;
  broadcastPostDeleted(groupId: string, postId: string): void;
}
