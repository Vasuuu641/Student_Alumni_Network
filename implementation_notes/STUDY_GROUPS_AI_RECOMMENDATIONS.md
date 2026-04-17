# Study Groups AI Recommendations Integration

## Overview
The study groups feature now includes **personalized AI recommendations** powered by Cohere embeddings. Recommendations are based on the user's personal interests and the groups they're currently in, not just generic topic matching.

## How It Works

### User Profile Requirements
For recommendations to work, users must have **interests** set in their profile during onboarding:
- **Students**: `major` + `interests` array
- **Alumni**: `interests` array
- **Professors**: `faculty` + `interests` array

### Recommendation Algorithm
1. **Fetch user profile** (interests, major, faculty)
2. **Build user vector** from:
   - User's personal interests
   - Tags from groups they're currently in
3. **Score candidate groups** using Cohere embeddings (cosine similarity)
4. **Return ranked groups** most semantically similar to user's profile

### Example
- User "Alex" is interested in: `["international relations", "diplomacy", "global politics"]`
- Currently in groups tagged: `["political science", "current events"]`
- AI will recommend groups tagged: `["united nations", "foreign policy", "international law"]`

## API Endpoint

### GET `/study-groups/recommendations/me?limit=5`

**Response (200 OK):**
```json
[
  {
    "id": "group-uuid",
    "name": "International Relations Study Group",
    "description": "Discuss global politics and diplomacy",
    "visibility": "PUBLIC",
    "score": 0.92,
    "matchingSignals": ["international relations", "diplomacy"]
  },
  ...
]
```

**Response (400 Bad Request):**
```json
{
  "message": "Please complete your profile with interests to get personalized recommendations. Update your profile in the onboarding or settings."
}
```

## Frontend Integration

### 1. Onboarding Flow
Ensure users fill in their interests during onboarding:

```typescript
// User profile form
const userProfile = {
  firstName: "Alex",
  lastName: "Smith",
  role: "STUDENT",
  student: {
    major: "Political Science",
    yearOfGraduation: 2026,
    interests: ["international relations", "diplomacy", "global politics"],
    faculty: "Social Sciences"
  }
};
```

### 2. Recommendations Page
When fetching recommendations, handle the 400 error gracefully:

```typescript
const fetchRecommendations = async () => {
  try {
    const response = await fetch('/study-groups/recommendations/me?limit=5', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 400) {
      // User hasn't set interests - prompt them
      showModal({
        title: "Complete Your Profile",
        message: "Tell us about your interests so we can recommend relevant study groups.",
        action: "Go to Profile Settings"
      });
      return;
    }

    const recommendations = await response.json();
    displayRecommendedGroups(recommendations);
  } catch (error) {
    console.error("Failed to fetch recommendations", error);
  }
};
```

### 3. Profile Settings
Add/update interests in user profile settings:

```typescript
// PUT /users/profile
{
  "interests": ["international relations", "diplomacy", "global politics"]
}
```

## Backend Architecture

### Files Involved
- **Service**: `backend/src/infrastructure/ai/cohere/cohere-study-group-recommendation.service.ts`
  - Fetches user profile
  - Validates interests exist
  - Creates embeddings with Cohere
  - Scores and ranks candidates

- **Use Case**: `backend/src/application/study-groups/recommend-groups.usecase.ts`
  - Delegates to recommendation service

- **Controller**: `backend/src/presentation/study-groups/study-groups.controller.ts`
  - Route: `GET /study-groups/recommendations/me`

### Error Handling
```typescript
// Service returns BadRequestException if:
if (!userInterests || userInterests.length === 0) {
  throw new BadRequestException(
    'Please complete your profile with interests...'
  );
}
```

## Testing

### Unit Test Example
```javascript
// Verify recommendations endpoint requires interests
try {
  const response = await fetch('/study-groups/recommendations/me', {
    headers: { Authorization: `Bearer ${userWithoutInterestsToken}` }
  });
  assert.equal(response.status, 400); // Expected
} catch (error) {
  // Handle gracefully
}
```

### Integration Test
See `backend/test/study-groups/study-groups-v2.e2e.mjs` for full example.

## Performance Considerations

- **Caching**: Consider caching user profiles and recommendations for 24 hours
- **Batch Embeddings**: Groups are embedded in batch for efficiency
- **Fallback**: If Cohere API is unavailable, endpoint returns groups sorted by recent activity with `score: 0`

## Environment Variables
- `COHERE_API_KEY`: Required for AI-powered recommendations
- Without it, endpoint returns fallback results

## Future Enhancements
1. **Profile Completion Nudge**: Show progress bar during onboarding
2. **Interest Suggestions**: Auto-suggest interests based on major/faculty
3. **Recommendation Refresh**: Allow users to regenerate recommendations
4. **Feedback Loop**: Track which recommendations users click to improve ranking
