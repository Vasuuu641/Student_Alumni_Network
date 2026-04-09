import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ShareNoteRequest {
  @IsEmail()
  @IsNotEmpty()
  collaboratorEmail: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @IsIn(['viewer', 'editor'])
  role: "viewer" | "editor";
}
