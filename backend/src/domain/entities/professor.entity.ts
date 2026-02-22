
export class Professor {
    constructor(
        public readonly userId: string,
        public faculty: string,
        public jobTitle: string,
        public bio: string | null,
        public interests: string[],
    ) {}    
}