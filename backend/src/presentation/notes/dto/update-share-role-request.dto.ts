import {IsString, IsNotEmpty} from "class-validator";

export class UpdateShareRoleRequestDto {
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    role: "viewer" | "editor";
}