import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class ShareNoteRequest {
  @IsEmail()
  @IsNotEmpty()
  collaboratorEmail: string;

  @IsString()
  @IsNotEmpty()
  role: "viewer" | "editor";
}
