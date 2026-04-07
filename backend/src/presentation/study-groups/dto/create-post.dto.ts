import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePostDto {
  // authorId is derived from the authenticated user; clients must not supply it

  @IsString()
  @IsNotEmpty()
  content!: string;
}
