//Get a professor's profile
import { Inject, Injectable } from "@nestjs/common";
import type { ProfessorRepository } from "../../domain/repositories/professor.repository";
import type { UserRepository } from "../../domain/repositories/user.repository";
import { Professor } from "../../domain/entities/professor.entity";

export interface GetProfessorProfileResult {
    professor: Professor;
    firstName: string;
    lastName: string;
}

@Injectable()
export class GetProfessorProfileUseCase {
    constructor(
        @Inject('ProfessorRepository')
        private readonly professorRepository: ProfessorRepository,
        @Inject('UserRepository')
        private readonly userRepository: UserRepository,
    ) {}

    async execute(userId: string): Promise<GetProfessorProfileResult> {
        const professor = await this.professorRepository.findByUserId(userId);
        if (!professor) {
            throw new Error('Professor profile not found');
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        return {
            professor,
            firstName: user.firstName,
            lastName: user.lastName,
        };
    }
}