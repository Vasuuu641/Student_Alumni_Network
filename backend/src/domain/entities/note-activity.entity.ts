export class NoteActivity {
  constructor(
    public readonly id: string,
    public readonly noteId: string,
    public readonly actorId: string,
    public readonly action: string,
    public readonly metadataJson: unknown | null,
    public readonly createdAt: Date,
  ) {}
}
