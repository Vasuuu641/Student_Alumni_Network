export interface StudyGroupUserArchiveRepository {
  archiveForUser(groupId: string, userId: string): Promise<void>;
  unarchiveForUser(groupId: string, userId: string): Promise<void>;
  findArchivedGroupIdsByUserId(userId: string): Promise<string[]>;
}
