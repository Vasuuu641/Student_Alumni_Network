export class StudentProfileResponse {
    userId: string;
    firstName: string;
    lastName: string;
    major: string | null;
    yearofGraduation: number | null;
    jobTitle: string | null;
    faculty: string | null;
    bio: string | null;
    interests: string[];
    profilePictureUrl: string | null;
  }