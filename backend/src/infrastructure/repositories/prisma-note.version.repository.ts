import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { NoteVersionRepository } from "src/domain/repositories/note-version.repository";
import { NoteVersion } from "src/domain/entities/note-version.entity";

@Injectable()
export class PrismaNoteVersionRepository implements NoteVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(version: NoteVersion): Promise<NoteVersion> {
    const record = await this.prisma.noteVersion.create({ data: this.toPersistence(version) });
    return this.toDomain(record);
  }

  async findById(id: string): Promise<NoteVersion | null> {
    const record = await this.prisma.noteVersion.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByNoteId(noteId: string): Promise<NoteVersion[]> {
    const records = await this.prisma.noteVersion.findMany({ where: { noteId } });
    return records.map(this.toDomain);
  }

  async findLatestByNoteId(noteId: string): Promise<NoteVersion | null> {
    const record = await this.prisma.noteVersion.findFirst({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toDomain(record) : null;
  }

  async listVersions(noteId: string, offset: number, limit: number): Promise<NoteVersion[]> {
    const records = await this.prisma.noteVersion.findMany({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
    return records.map(this.toDomain);
  }

  async findByNoteIdAndVersionNumber(noteId: string, versionNumber: number): Promise<NoteVersion | null> {
    const record = await this.prisma.noteVersion.findFirst({
      where: { noteId },
      orderBy: { createdAt: 'asc' },
      skip: versionNumber - 1,
    });
    return record ? this.toDomain(record) : null;
  }

  private toDomain(record: any): NoteVersion {
    return new NoteVersion(
      record.id,
      record.noteId,
      record.versionNumber,
      record.snapshotJson,
      record.authorId,
      record.createdAt,
    );
  }

  private toPersistence(version: NoteVersion): any {
    return {
      id: version.id,
      noteId: version.noteId,
      versionNumber: version.versionNumber,
      snapshotJson: version.snapshotJson,
      authorId: version.authorId,
      createdAt: version.createdAt,
    };
  }
}