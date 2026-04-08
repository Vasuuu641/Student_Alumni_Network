import { IsBoolean } from 'class-validator';

export class VerifyGeoHelpSpotDto {
  @IsBoolean()
  isVerified!: boolean;
}
