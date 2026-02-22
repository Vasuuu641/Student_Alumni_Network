import { UserRepository } from "../../domain/repositories/user.repository";
import { PasswordHasher } from "../../domain/services/password-hasher";
import { Email } from "../../domain/value-objects/email.vo";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid credentials");
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export class LoginUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  async execute(email: string, password: string): Promise<AuthenticatedUser> {
    const emailVO = new Email(email);

    const user = await this.userRepository.findByEmail(emailVO);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.passwordHasher.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    return {
      id: user.id,
      email: user.email.getValue(),
      role: user.role,
    };
  }
}