import {Email} from "../value-objects/email.vo";

export enum Role {
  STUDENT = 'STUDENT',
  ALUMNI = 'ALUMNI',
  PROFESSOR = 'PROFESSOR',
  ADMIN = 'ADMIN',
}

export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly password: string,
    public readonly role: Role,
    public firstName: string,
    public lastName: string
  ) {}

  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  changeName(firstName: string, lastName: string): void {
    this.firstName = firstName;
    this.lastName = lastName;
  }
}