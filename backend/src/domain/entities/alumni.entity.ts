
export class Alumni {
    constructor(
        public readonly userId: string,
        public yearOfGraduation: number | null,
        public major: string,
        public company: string | null,
        public jobTitle: string | null,
        public bio: string | null,
        public interests: string[],
        public profilePictureUrl: string | null = null,
        public isAnonymous: boolean = false,
        public anonymousName: string | null = null,
    ) {}    
}