export interface NotesRealtimePublisher {
  broadcastCheckpointCreated(
    noteId: string,
    actorId: string,
    versionNumber: number,
  ): void;

   broadcastVersionRestored(
    noteId: string,
    actorId: string,
    content: unknown,
  ): void
}
