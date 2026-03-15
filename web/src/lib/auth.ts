export type UserRole = 'STUDENT' | 'ALUMNI' | 'PROFESSOR' | 'ADMIN';

interface AccessTokenPayload {
  userId?: string;
  role?: string;
  exp?: number;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  return atob(padded);
}

export function getAccessToken(): string | null {
  return localStorage.getItem('unibridge.accessToken');
}

export function getRoleFromAccessToken(token: string): UserRole | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payloadText = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadText) as AccessTokenPayload;

    if (
      payload.role === 'STUDENT' ||
      payload.role === 'ALUMNI' ||
      payload.role === 'PROFESSOR' ||
      payload.role === 'ADMIN'
    ) {
      return payload.role;
    }

    return null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return true;
    }

    const payloadText = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadText) as AccessTokenPayload;
    if (!payload.exp) {
      return false;
    }

    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
