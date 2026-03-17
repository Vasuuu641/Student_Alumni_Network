import { IsString, IsNotEmpty, MaxLength } from "class-validator";

// DTO for creating a note
export class CreateNoteRequest {
  
  @IsString()
  @IsNotEmpty()
  @MaxLength(500, { message: 'Title cannot exceed 500 characters' })
  title: string;
  
}   