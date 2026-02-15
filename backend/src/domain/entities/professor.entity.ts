import {User} from "./user.entity";

export class Student {
    constructor(
        public readonly id: string,
        public user: User,
        public faculty: string,
        public jobTitle: string,
        public bio: string,
        public interests: string[],
    ) {}    
}