import { Injectable } from '@nestjs/common';
import type { NotesRealtimePublisher } from 'src/domain/services/notes-realtime-publisher';
import { NotesGateway } from '../websocket/notes.gateway';

@Injectable()
export class NotesRealtimePublisherService implements NotesRealtimePublisher {
  constructor(private readonly notesGateway: NotesGateway) {}

  broadcastCheckpointCreated(
    noteId: string,
    actorId: string,
    versionNumber: number,
  ): void {
    this.notesGateway.broadcastCheckpointCreated(noteId, actorId, versionNumber);
  }
}
