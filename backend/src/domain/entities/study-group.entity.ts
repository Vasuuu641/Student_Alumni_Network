//study group entitiy goes here
export enum studyGroupsVisibility {
  PUBLIC,
  PRIVATE
}

export enum studyGroupStatus {
  ACTIVE,
  ARCHIVE,
  DELETED
}

export enum studyGroupMemberRole {
  OWNER,
  MODERATOR,
  MEMBER
}

export enum studyGroupJoinStatus {
  ACTIVE,
  LEFT,
  REMOVED,
  PENDING
}

export enum studyGroupPostStatus {
  ACTIVE,
  EDITED,
  DELETED
}

export class StudyGroup {
    constructor(
        public readonly id: string,
        public name: string,
        public description: string,
        public topicTags: string[],
        public visibility: studyGroupsVisibility,
        public status: studyGroupStatus,
        public readonly ownerId: string,
        public readonly createdAt: Date,
        public readonly updatedAt: Date,
    ) {}

    isOwnedBy(userId: string): boolean {
        return this.ownerId === userId;
    }
}

export class StudyGroupPostAttachment {
  constructor(
    public readonly id: string,
    public readonly postId: string,
    public readonly key: string,
    public readonly url: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly uploadedById: string,
    public readonly createdAt: Date,
  ) {}

  isUploadedBy(userId: string): boolean {
    return this.uploadedById === userId;
  }
}
