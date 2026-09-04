import { studyGroupMemberRole, studyGroupJoinStatus } from "../entities/study-group.entity";

export interface StudyGroupMemberRepository {
    findByStudyGroupId(studyGroupId: string): Promise<{ userId: string; role: studyGroupMemberRole; joinStatus: studyGroupJoinStatus }[]>;
    findByUserId(userId: string): Promise<{ studyGroupId: string; role: studyGroupMemberRole; joinStatus: studyGroupJoinStatus }[]>;
    addMember(studyGroupId: string, userId: string, role: studyGroupMemberRole): Promise<void>;
    updateMemberRole(studyGroupId: string, userId: string, role: studyGroupMemberRole): Promise<void>;
    updateMemberJoinStatus(studyGroupId: string, userId: string, joinStatus: studyGroupJoinStatus): Promise<void>;
    removeMember(studyGroupId: string, userId: string): Promise<void>;
}