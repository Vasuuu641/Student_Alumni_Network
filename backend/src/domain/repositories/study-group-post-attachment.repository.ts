import { StudyGroupPostAttachment } from '../entities/study-group.entity'; 

export interface CreateStudyGroupPostAttachmentData {
  postId: string;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedById: string;
}

export interface StudyGroupPostAttachmentRepository {
  create(data: CreateStudyGroupPostAttachmentData): Promise<StudyGroupPostAttachment>;
  findByPostId(postId: string): Promise<StudyGroupPostAttachment[]>;
  delete(id: string): Promise<void>;
}