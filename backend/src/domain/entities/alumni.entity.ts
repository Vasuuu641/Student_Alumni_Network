
export class Alumni {
    constructor(
        public readonly userId: string,
        public yearOfGraduation: number | null,
        public major: string,
        public company: string | null,
        public jobTitle: string | null,
        public bio: string | null,
        public interests: string[],
    ) {}    
}