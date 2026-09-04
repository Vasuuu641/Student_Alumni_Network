import { refreshSession } from '../api/auth.api';
import { clearTokens, getAccessToken, getRefreshToken, storeTokens } from './auth-storage';
import { isJwtExpired } from './jwt';

let refreshInFlight: Promise<string | null> | null = null;

export async function getValidAccessToken(): Promise<string | null> {
  const accessToken = await getAccessToken();

  if (accessToken && !isJwtExpired(accessToken)) {
    return accessToken;
  }

  return refreshStoredSession();
}

export async function refreshStoredSession(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken();

    if (!refreshToken) {
      await clearTokens();
      return null;
    }

    try {
      const tokens = await refreshSession(refreshToken);
      await storeTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      await clearTokens();
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}
