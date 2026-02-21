import { AuthorizedUser } from "../entities/authorized-user.entity";

export interface AuthorizedUserRepository {
  findById(id: string): Promise<AuthorizedUser | null>;
  findByEmail(email: string): Promise<AuthorizedUser | null>;
  isUsed(email: string): Promise<boolean>;
  create(user: AuthorizedUser): Promise<AuthorizedUser>;
  update(user: AuthorizedUser): Promise<AuthorizedUser>;
  delete(id: string): Promise<void>;
}