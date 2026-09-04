//study group repo goes here
import { studyGroupsVisibility, studyGroupStatus, StudyGroup } from "../entities/study-group.entity";

export interface StudyGroupRepository {
    findById(id: string): Promise<StudyGroup | null>;
    findByOwnerId(ownerId: string): Promise<StudyGroup[]>;
    findByIds(ids: string[]): Promise<StudyGroup[]>;
    findByVisibility(visibility: studyGroupsVisibility): Promise<StudyGroup[]>;
    create(studyGroup: StudyGroup): Promise<StudyGroup>;
    update(studyGroup: StudyGroup): Promise<StudyGroup>;
    updateStatus(studyGroupId: string, status: studyGroupStatus): Promise<StudyGroup>;
    delete(studyGroupId: string): Promise<void>;
}