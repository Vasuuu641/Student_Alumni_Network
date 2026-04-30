import { IsOptional, IsString } from 'class-validator';

export class UpdateMeRequestDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}