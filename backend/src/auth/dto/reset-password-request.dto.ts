import { IsEmail, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}