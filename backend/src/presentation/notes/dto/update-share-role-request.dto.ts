import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateShareRoleRequestDto {
    @IsString()
    @IsNotEmpty()
    email: string;

        @Transform(({ value }) =>
            typeof value === 'string' ? value.toLowerCase() : value,
        )
    @IsString()
    @IsNotEmpty()
        @IsIn(['viewer', 'editor'])
    role: "viewer" | "editor";
}