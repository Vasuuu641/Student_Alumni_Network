import {User} from "./user.entity";

export class Student {
    constructor(
        public readonly id: string,
        public user: User,
        public major: string,
        public yearOfGraduation: number,
        public interests: string[],
        public faculty: string,
        public bio: string,
    ) {}    
}