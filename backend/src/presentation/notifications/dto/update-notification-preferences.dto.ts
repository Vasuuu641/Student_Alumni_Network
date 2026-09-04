import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inAppEnabled?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  pushEnabled?: boolean;
}