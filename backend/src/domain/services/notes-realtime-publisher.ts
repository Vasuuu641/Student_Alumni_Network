export interface NotesRealtimePublisher {
  broadcastCheckpointCreated(
    noteId: string,
    actorId: string,
    versionNumber: number,
  ): void;
}
