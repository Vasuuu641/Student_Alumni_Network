export interface StudyGroupInviteRecord {
  id: string;
  groupId: string;
  invitedUserId: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface StudyGroupInviteView {
  id: string;
  groupId: string;
  groupName: string;
  invitedBy: string;
  invitedByName: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateStudyGroupInviteInput {
  groupId: string;
  invitedUserId: string;
  invitedBy: string;
  token: string;
  expiresAt: Date;
}

export interface StudyGroupInviteRepository {
  findActivePendingInvite(groupId: string, invitedUserId: string, now: Date): Promise<StudyGroupInviteRecord | null>;
  create(input: CreateStudyGroupInviteInput): Promise<StudyGroupInviteRecord>;
  findById(id: string): Promise<StudyGroupInviteRecord | null>;
  markAccepted(id: string, acceptedAt: Date): Promise<void>;
  delete(id: string): Promise<void>;
  findPendingForUser(userId: string, now: Date): Promise<StudyGroupInviteView[]>;
}
