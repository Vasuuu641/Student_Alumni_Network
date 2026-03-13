import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { NoteCollaboratorRepository } from "src/domain/repositories/note-collaborator.repository";
import { NoteCollaborator } from "src/domain/entities/note-collaborator.entity";
import { NotePermissionRole } from "src/domain/entities/note.entity";

@Injectable()
export class PrismaNoteCollaboratorRepository implements NoteCollaboratorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByNoteId(noteId: string): Promise<NoteCollaborator[]> {
    const records = await this.prisma.noteCollaborator.findMany({ where: { noteId } });
    return records.map(this.toDomain);
  }

  async findByNoteAndUser(noteId: string, userId: string): Promise<NoteCollaborator | null> {
    const record = await this.prisma.noteCollaborator.findUnique({ where: { noteId_userId: { noteId, userId } } });
    return record ? this.toDomain(record) : null;
  }

  async add(collaborator: NoteCollaborator): Promise<NoteCollaborator> {
    const record = await this.prisma.noteCollaborator.create({ data: this.toPersistence(collaborator) });
    return this.toDomain(record);
  }

  async updateRole(noteId: string, userId: string, role: NotePermissionRole): Promise<NoteCollaborator> {
    const record = await this.prisma.noteCollaborator.update({
      where: { noteId_userId: { noteId, userId } },
      data: { role },
    });
    return this.toDomain(record);
  }

  async remove(noteId: string, userId: string): Promise<void> {
    await this.prisma.noteCollaborator.delete({
      where: { noteId_userId: { noteId, userId } },
    });
  }

  private toDomain(record: any): NoteCollaborator {
    return new NoteCollaborator(
      record.noteId,
      record.userId,
      record.role as NotePermissionRole,
      record.createdAt,
      record.updatedAt,
    );
  }

  private toPersistence(collaborator: NoteCollaborator): any {
    return {
      noteId: collaborator.noteId,
      userId: collaborator.userId,
      role: collaborator.role as NotePermissionRole,
    };
  }
}