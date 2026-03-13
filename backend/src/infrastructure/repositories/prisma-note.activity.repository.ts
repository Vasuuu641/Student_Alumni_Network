import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import { NoteActivityRepository } from "src/domain/repositories/note-activity.repository";
import { NoteActivity } from "src/domain/entities/note-activity.entity";

@Injectable()
export class PrismaNoteActivityRepository implements NoteActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(activity: NoteActivity): Promise<NoteActivity> {
    const created = await this.prisma.noteActivity.create({
      data: {
        id: activity.id,
        noteId: activity.noteId,
        actorId: activity.actorId,
        action: activity.action,
        metadataJson: activity.metadataJson as any,
        createdAt: activity.createdAt,
      },
    });
    return new NoteActivity(
      created.id,
      created.noteId,
      created.actorId,
      created.action,
      created.metadataJson,
      created.createdAt
    );
  }

  async findByNoteId(noteId: string, limit = 20, offset = 0): Promise<NoteActivity[]> {
    const activities = await this.prisma.noteActivity.findMany({
      where: { noteId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
    return activities.map(
      (a) =>
        new NoteActivity(
          a.id,
          a.noteId,
          a.actorId,
          a.action,
          a.metadataJson,
          a.createdAt
        )
    );
  }

  async findByActorId(actorId: string, limit = 20, offset = 0): Promise<NoteActivity[]> {
    const activities = await this.prisma.noteActivity.findMany({
      where: { actorId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });     

    return activities.map(
      (a) =>
        new NoteActivity(
          a.id,
          a.noteId,     
            a.actorId,
            a.action,
            a.metadataJson,
            a.createdAt
        )
    );
  }

  async findRecent(limit = 20, offset = 0): Promise<NoteActivity[]> {
    const activities = await this.prisma.noteActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
    return activities.map(
      (a) =>
        new NoteActivity(
          a.id,
          a.noteId,
          a.actorId,
          a.action,
          a.metadataJson,
          a.createdAt
        )
    );
  }

  async countByNoteId(noteId: string): Promise<number> {
    return this.prisma.noteActivity.count({ where: { noteId } });
  }

  async deleteByNoteId(noteId: string): Promise<void> {
    await this.prisma.noteActivity.deleteMany({ where: { noteId } });
  }
}