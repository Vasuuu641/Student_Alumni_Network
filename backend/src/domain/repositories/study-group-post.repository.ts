import { studyGroupPostStatus } from "../entities/study-group.entity";

export interface StudyGroupPostRepository {
    findById(id: string): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus } | null>;
    findByStudyGroupId(studyGroupId: string): Promise<{ id: string; authorId: string; content: string; status: studyGroupPostStatus }[]>;
    create(post: { studyGroupId: string; authorId: string; content: string }): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus }>;
    update(postId: string, content: string): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus }>;
    updateStatus(postId: string, status: studyGroupPostStatus): Promise<{ id: string; studyGroupId: string; authorId: string; content: string; status: studyGroupPostStatus }>;
    delete(postId: string): Promise<{ id: string; groupId: string }>;
}