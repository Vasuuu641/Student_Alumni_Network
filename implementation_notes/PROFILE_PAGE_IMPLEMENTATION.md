# User Profile Page Implementation

## Overview
A comprehensive user profile page has been designed and implemented for the UniBridge application. This page displays user onboarding information in an organized, visually appealing format that can be viewed both by the user (own profile) and by other viewers (when the endpoint is available).

## Features

### 1. **Responsive Design**
- Mobile-first approach with adaptive layouts
- Beautiful gradient header with profile picture
- Grid-based card layout (2 columns on desktop, 1 column on mobile)
- Smooth hover animations and transitions

### 2. **Profile Sections**
The profile page displays the following sections based on user onboarding data:

#### Basic Info (Header)
- Profile picture with avatar initials fallback
- Full name or anonymous name (for Alumni)
- User role (Student/Professor/Alumni)
- Edit Profile button (for own profile only)

#### About Section
- User bio/description from onboarding

#### Education Section (for Students/Professors)
- Faculty
- Major/Department
- Graduation year

#### Work Experience Section (for Alumni/Student Alumni)
- Job title
- Company name

#### Interests & Skills Section
- Display of user interests as styled tags
- Tag styling with hover effects

#### Contact Section (own profile only)
- Email address

### 3. **Role-Specific Content**
The page intelligently displays different information based on user role:

| Field | Student | Professor | Alumni |
|-------|---------|-----------|--------|
| Major | ✓ | - | ✓ |
| Faculty | ✓ | ✓ | ✓ |
| Graduation Year | ✓ | - | ✓ |
| Job Title | - | ✓ | ✓ |
| Company | - | - | ✓ |
| Bio | ✓ | ✓ | ✓ |
| Interests | ✓ | ✓ | ✓ |

### 4. **Privacy Features**
- Own profile shows all information including email
- Other profiles respect anonymous mode for Alumni users
- Contact information hidden when viewing other profiles

## File Structure

```
web/src/
├── pages/
│   └── ProfilePage.tsx          # Main profile page component
├── api/
│   └── profile.api.ts           # Profile API client functions
├── styles.css                   # Profile page styling
└── App.tsx                       # Updated with profile routes
```

## Component Details

### ProfilePage.tsx
**Location:** `/home/vasu/Student_Alumni_Network/web/src/pages/ProfilePage.tsx`

**Key Features:**
- Fetches user profile data on mount
- Handles loading and error states
- Supports both own profile and other users' profiles (requires backend implementation)
- Role-aware conditional rendering
- Responsive layout

**Props:**
- `isOwnProfile` (boolean, default: true) - Indicates if viewing own profile

**State:**
- `profile` - User profile data
- `isLoading` - Loading state
- `errorMessage` - Error message for failed requests

### profile.api.ts
**Location:** `/home/vasu/Student_Alumni_Network/web/src/api/profile.api.ts`

**Exports:**
- `getCurrentUserProfile(role)` - Fetches current user's profile
- `getUserProfileById(userId)` - Placeholder for viewing other users' profiles

**Interfaces:**
- `UserProfileData` - Complete profile data structure

## Routes

Two routes are available:

1. **Own Profile**
   - Route: `/profile`
   - Displays current user's full profile
   - Shows edit button and private information (email)

2. **Other User's Profile** (requires backend implementation)
   - Route: `/profile/:userId`
   - Displays another user's public profile
   - Hides private information
   - Respects anonymous mode for Alumni

## Styling

### Color Scheme
- **Header:** Blue gradient (primary colors)
- **Cards:** White background with subtle shadows
- **Tags:** Light blue gradient with blue text
- **Icons:** Primary blue color

### Key Classes
- `.profile-page` - Main container
- `.profile-header` - Header with profile picture and info
- `.profile-grid` - Card grid layout
- `.profile-card` - Individual info card
- `.profile-tag` - Interest/skill tags

### Responsive Breakpoints
- **Desktop:** 2-column grid
- **Tablet (< 900px):** 1-column grid, centered header
- **Mobile (< 640px):** Smaller fonts, adjusted spacing, compact avatar

## Integration Points

### 1. **Navigation**
Add profile link to the main navigation:
```tsx
<Link to="/profile">My Profile</Link>
```

### 2. **Dashboard**
Link from dashboard to profile:
```tsx
<Button onClick={() => navigate('/profile')}>View Profile</Button>
```

### 3. **Study Groups / Recommendations**
When LLM recommends users to invite:
```tsx
<Button onClick={() => navigate(`/profile/${recommendedUserId}`)}>
  View Profile
</Button>
```

### 4. **User Cards**
In user lists, add profile links:
```tsx
<a href={`/profile/${userId}`}>
  <UserCard />
</a>
```

## Backend Requirements

### Current Implementation
- Uses existing `/students/profile`, `/alumni/profile`, `/professors/profile` endpoints
- These endpoints return authenticated user's own profile
- Works with existing onboarding data

### For "View Other User's Profile" Feature
A new backend endpoint is needed:
```
GET /{role}/:userId/profile (public access)
GET /users/:userId/profile (public access)
```

**Endpoint should:**
- Accept public or unauthenticated requests
- Respect privacy settings (anonymous mode, etc.)
- Return publicly available profile fields only
- Handle non-existent users gracefully

**Response should include:**
```json
{
  "userId": "uuid",
  "firstName": "string",
  "lastName": "string",
  "bio": "string",
  "interests": ["string"],
  "profilePictureUrl": "url",
  "major": "string",
  "faculty": "string",
  "jobTitle": "string",
  "company": "string",
  "yearofGraduation": "number"
}
```

## Usage Examples

### View Own Profile
```tsx
import { ProfilePage } from './pages/ProfilePage';

// In route:
<Route path="/profile" element={<ProfilePage isOwnProfile={true} />} />

// Navigate:
navigate('/profile');
```

### View Other User's Profile
```tsx
// When backend is ready:
<Button onClick={() => navigate(`/profile/${userId}`)}>
  View Profile
</Button>

// In route:
<Route path="/profile/:userId" element={<ProfilePage isOwnProfile={false} />} />
```

### Edit Profile
```tsx
// User can edit profile by clicking "Edit Profile" button
// which navigates to:
navigate('/onboarding');
```

## Customization Guide

### Change Header Colors
Edit `.profile-header` in `styles.css`:
```css
.profile-header {
  background: linear-gradient(135deg, YOUR_COLOR_1 0%, YOUR_COLOR_2 100%);
}
```

### Add More Profile Sections
1. Add field to `UserProfileData` interface in `profile.api.ts`
2. Add conditional rendering in `ProfilePage.tsx`:
```tsx
{profile.newField && (
  <section className="profile-card">
    <div className="profile-card__header">
      <IconName size={20} />
      <h2>Section Title</h2>
    </div>
    {/* Content */}
  </section>
)}
```

### Change Grid Layout
Modify `.profile-grid` in `styles.css`:
```css
.profile-grid {
  grid-template-columns: repeat(3, 1fr); /* 3 columns instead of 2 */
}
```

## Future Enhancements

1. **View Other Users' Profiles**
   - Implement backend endpoint
   - Enable `getUserProfileById()` API function
   - Add profile links throughout the app

2. **Edit Profile Inline**
   - Make sections editable without navigating to onboarding
   - Save individual fields without full form resubmission

3. **Profile Activity Feed**
   - Show recent notes, threads, study groups created
   - Display achievements or badges

4. **Follow/Connect Feature**
   - Find and connect with users
   - See mutual connections

5. **Profile Preview**
   - Small preview card for hover/tooltip
   - Quick profile access in lists

6. **Export Profile**
   - Download profile as PDF
   - Create resume from profile data

## Testing

### Test Cases
1. **Own Profile View**
   - Load profile page as authenticated user
   - Verify all onboarding data displays correctly
   - Check edit button presence

2. **Responsive Design**
   - Test on desktop, tablet, mobile
   - Verify grid layout changes appropriately
   - Check touch interactions

3. **Error Handling**
   - Test with network error
   - Test with missing/incomplete profile
   - Verify error messages display correctly

4. **Loading States**
   - Verify loading indicator shows
   - Check loading state is cleared after data loads

5. **Role Variations**
   - Test as Student (verify student-only fields)
   - Test as Professor (verify professor-only fields)
   - Test as Alumni (verify alumni-only fields and anonymous mode)

## Performance Considerations

- Profile picture is fetched with existing onboarding endpoint
- No additional database queries needed (uses existing endpoints)
- Card layout uses CSS Grid (native browser support, performant)
- Animations use GPU-accelerated transforms
- Responsive design uses media queries only (no JavaScript)

## Troubleshooting

### Profile not loading
- Check authentication token validity
- Verify API endpoint is accessible
- Check browser console for errors

### Profile picture not showing
- Verify image URL is correct
- Check CORS headers if serving from different domain
- Verify image file exists and is accessible

### Styling not applied
- Clear browser cache
- Verify CSS file is imported
- Check for CSS conflicts with other stylesheets
- Verify Tailwind CSS is properly configured

## References

- **Onboarding Form Definition:** `web/src/pages/Onboarding.tsx`
- **API Integration:** `web/src/api/profile.api.ts`
- **Styling:** `web/src/styles.css`
- **Component:** `web/src/pages/ProfilePage.tsx`
- **Routes:** `web/src/App.tsx`
