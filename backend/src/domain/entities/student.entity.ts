
export class Student {
    constructor(
        public readonly userId: string,
        public major: string,
        public yearOfGraduation: number | null,
        public jobTitle: string | null,
        public company: string | null,
        public interests: string[],
        public faculty: string | null,
        public bio: string | null,
        public profilePictureUrl: string | null = null,
    ) {}    
}