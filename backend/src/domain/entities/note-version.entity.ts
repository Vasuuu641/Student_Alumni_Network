export class NoteVersion {
  constructor(
    public readonly id: string,
    public readonly noteId: string,
    public readonly versionNumber: number,
    public readonly snapshotJson: unknown,
    public readonly authorId: string,
    public readonly createdAt: Date,
  ) {}
}
