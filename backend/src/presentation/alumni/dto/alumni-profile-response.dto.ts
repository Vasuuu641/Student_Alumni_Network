export class AlumniProfileResponse {
  userId: string;
  firstName: string;
  lastName: string;
  yearOfGraduation: number | null;
  major: string | null;
  company: string | null;
  jobTitle: string | null;
  bio: string | null;
  interests: string[];
  profilePictureUrl: string | null;
  isAnonymous: boolean;
  anonymousName: string | null;
}
