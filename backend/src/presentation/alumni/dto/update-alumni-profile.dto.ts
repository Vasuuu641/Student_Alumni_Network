export class UpdateAlumniProfileRequest {
  yearOfGraduation?: number;
  major?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  interests?: string[];
  isAnonymous?: boolean;
  anonymousName?: string;
  // File will be handled separately in the controller
}
