import {Email} from "../value-objects/email.vo";
import { Role } from '../entities/role.enum';

export class AuthorizedUser {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly role: Role,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    private _isUsed: boolean,
  ) {}

   get isUsed(): boolean {
    return this._isUsed;
  }

  markAsUsed(): void {
    if (this._isUsed) {
      throw new Error('Authorized user already used');
    }
    this._isUsed = true;
  }
}

