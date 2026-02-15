import { Role } from "generated/prisma/enums";

// domain/entities/user.entity.ts
export class User {
  constructor(
    public readonly id: string,
    public email: string,
    public password: string,
    public firstName: string,
    public lastName: string,
    public role: Role
  ) {}

  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
