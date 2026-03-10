import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { NoteRepository } from "src/domain/repositories/note.repository";
import { Note, NoteStatus } from "src/domain/entities/note.entity";

@Injectable()
export class PrismaNoteRepository implements NoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Note | null> {
    const record = await this.prisma.note.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Note[]> {
    const records = await this.prisma.note.findMany({ where: { ownerId } });
    return records.map(this.toDomain);
  }

  async findByUserCollaboration(userId: string): Promise<Note[]> {
    const records = await this.prisma.noteCollaborator.findMany({
      where: { userId },
      include: { note: true },
    });
    return records.map(rc => this.toDomain(rc.note));
  }

  async create(note: Note): Promise<Note> {
    const record = await this.prisma.note.create({ data: this.toPersistence(note) });
    return this.toDomain(record);
  }

  async update(note: Note): Promise<Note> {
    const record = await this.prisma.note.update({
      where: { id: note.id },
      data: this.toPersistence(note),
    });
    return this.toDomain(record);
  }

  async updateMetadata(noteId: string, metadata: { title?: string; status?: string }): Promise<Note> {
    const data: any = {};
    if (metadata.title !== undefined) data.title = metadata.title;
    if (metadata.status !== undefined) data.status = metadata.status;

    const record = await this.prisma.note.update({
      where: { id: noteId },
      data,
    });
    return this.toDomain(record);
  }

  async updateStatus(noteId: string, status: NoteStatus): Promise<Note> {
    const record = await this.prisma.note.update({
      where: { id: noteId },
      data: { status },
    });
    return this.toDomain(record);
  }

  async delete(noteId: string): Promise<void> {
    await this.prisma.note.delete({ where: { id: noteId } });
  }

  private toDomain(record: any): Note {
    return new Note(
      record.id,
      record.ownerId,
      record.title,
      record.status,
      record.createdAt,
      record.updatedAt,
    );
  }

  private toPersistence(note: Note): any {
    return {
      id: note.id,
      ownerId: note.ownerId,
      title: note.title,
      status: note.status,
    };
  }
}