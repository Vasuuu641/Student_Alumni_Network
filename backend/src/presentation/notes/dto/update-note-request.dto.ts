import { IsString, IsOptional, MaxLength } from "class-validator";
import type { NoteStatus } from "../../../domain/entities/note.entity";

export class UpdateNoteRequestDto {
    @IsString()
    @IsOptional()
    @MaxLength(500, { message: 'Title cannot exceed 500 characters' })
    title?: string;

    @IsString()
    @IsOptional()
    status?: NoteStatus;

    @IsOptional()
    content?: any; // Rich-text/JSON content - validated in use case for size
}