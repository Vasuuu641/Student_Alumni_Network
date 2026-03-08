# Refresh Token Implementation

## Overview
The authentication system now supports **refresh tokens** to allow users to obtain new access tokens without re-entering their credentials.

## How It Works

### 1. Login Response
When a user logs in via `POST /auth/login`, they receive:
```json
{
  "token": "short-lived-access-token",
  "accessToken": "short-lived-access-token",
  "refreshToken": "long-lived-refresh-token"
}
```

### 2. Using Access Tokens
- Use the `accessToken` (or `token`) in the `Authorization` header for protected routes
- Format: `Bearer <accessToken>`
- Default expiry: **1 hour** (configurable via `JWT_EXPIRES_IN`)

### 3. Refreshing Tokens
When the access token expires, use the refresh token to get new tokens:
- Endpoint: `POST /auth/refresh`
- Body: `{ "refreshToken": "your-refresh-token" }`
- Returns new `accessToken` and `refreshToken`
- Default expiry: **24 hours** (configurable via `JWT_REFRESH_EXPIRES_IN`)

## Environment Variables

Configure these in your `.env` file:

```env
# Access token secret (required)
JWT_SECRET=your-secret-key-here

# Refresh token secret (optional, defaults to JWT_SECRET)
JWT_REFRESH_SECRET=your-refresh-secret-key-here

# Access token expiration (default: 1h)
JWT_EXPIRES_IN=1h

# Refresh token expiration (default: 24h)
JWT_REFRESH_EXPIRES_IN=24h
```

### Expiry Time Formats
- Seconds: `3600` or `"3600"`
- Minutes: `"60m"`
- Hours: `"1h"`
- Days: `"7d"`
- Weeks: `"2w"`

## Security Features

1. **Separate Secrets**: Access and refresh tokens use different secrets
2. **Token Type Validation**: Tokens are marked with `tokenType` ('access' or 'refresh')
3. **Type Enforcement**: 
   - Protected routes only accept access tokens
   - Refresh endpoint only accepts refresh tokens
4. **Stateless JWT**: Tokens are self-contained (no database storage required)

## API Endpoints

### POST /auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### POST /auth/refresh
**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

## Client Implementation Example

```typescript
// Store tokens after login
const loginResponse = await login(email, password);
localStorage.setItem('accessToken', loginResponse.accessToken);
localStorage.setItem('refreshToken', loginResponse.refreshToken);

// Make authenticated requests
const makeAuthenticatedRequest = async (url: string) => {
  let accessToken = localStorage.getItem('accessToken');
  
  try {
    return await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
  } catch (error) {
    if (error.status === 401) {
      // Token expired, refresh it
      const refreshToken = localStorage.getItem('refreshToken');
      const refreshResponse = await fetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      
      const newTokens = await refreshResponse.json();
      localStorage.setItem('accessToken', newTokens.accessToken);
      localStorage.setItem('refreshToken', newTokens.refreshToken);
      
      // Retry original request with new token
      return await fetch(url, {
        headers: {
          'Authorization': `Bearer ${newTokens.accessToken}`
        }
      });
    }
    throw error;
  }
};
```

## Testing

Use the provided test file:
```
backend/test/auth/refresh-token.http
```

1. First, call the login endpoint and copy the `refreshToken` from the response
2. Use that token in the refresh endpoint to get new tokens

## Migration Notes

- The `token` field is kept for backward compatibility (it's an alias for `accessToken`)
- Existing code using `token` will continue to work
- Clients should start using `accessToken` and `refreshToken` explicitly
