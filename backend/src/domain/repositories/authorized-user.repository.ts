import { AuthorizedUser } from "../entities/authorized-user.entity";
import { Email } from "../value-objects/email.vo";

export interface AuthorizedUserRepository {
  findById(id: string): Promise<AuthorizedUser | null>;
  findByEmail(email: Email): Promise<AuthorizedUser | null>;
  create(user: AuthorizedUser): Promise<AuthorizedUser>;
  update(user: AuthorizedUser): Promise<AuthorizedUser>;
  delete(id: string): Promise<void>;
}