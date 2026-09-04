export type StudyGroupJoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface StudyGroupJoinRequestRecord {
  id: string;
  groupId: string;
  userId: string;
  status: StudyGroupJoinRequestStatus;
  createdAt: Date;
}

export interface StudyGroupJoinRequestView {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: StudyGroupJoinRequestStatus;
  createdAt: Date;
}

export interface StudyGroupJoinRequestRepository {
  findPendingByGroupAndUser(groupId: string, userId: string): Promise<StudyGroupJoinRequestRecord | null>;
  createPending(groupId: string, userId: string): Promise<StudyGroupJoinRequestRecord>;
  findById(id: string): Promise<StudyGroupJoinRequestRecord | null>;
  listPendingByGroupId(groupId: string): Promise<StudyGroupJoinRequestView[]>;
  updateStatus(id: string, status: StudyGroupJoinRequestStatus): Promise<void>;
}
