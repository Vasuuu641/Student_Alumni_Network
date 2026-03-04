export class StudentProfileResponse {
    userId: string;
    firstName: string;
    lastName: string;
    yearOfStudy: number | null;
    major: string | null;
    bio: string | null;
    interests: string[];
    profilePictureUrl: string | null;
    isAnonymous: boolean;
    anonymousName: string | null;
  }