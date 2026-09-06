import {Email} from "../value-objects/email.vo";
import { Role } from '../entities/role.enum';

export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    private _password: string,
    public readonly role: Role,
    public firstName: string,
    public lastName: string
  ) {}

  get password(): string {
    return this._password;
  }

  fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  changeName(firstName: string, lastName: string): void {
    this.firstName = firstName;
    this.lastName = lastName;
  }

  changePassword(newHashedPassword: string): void {
    this._password = newHashedPassword;
  }
}