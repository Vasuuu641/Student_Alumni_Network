export type UserRole = 'STUDENT' | 'ALUMNI' | 'PROFESSOR' | 'ADMIN';

type JwtPayload = {
  exp?: number;
  userId?: string;
  role?: string;
};

function decodeJwtPayload(token: string): JwtPayload | null {
  const payloadPart = token.split('.')[1];

  if (!payloadPart) {
    return null;
  }

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string, now = Date.now()): boolean {
  const payload = decodeJwtPayload(token);

  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= now;
}

export function getRoleFromAccessToken(token: string): UserRole | null {
  try {
    const payload = decodeJwtPayload(token);

    if (
      payload?.role === 'STUDENT' ||
      payload?.role === 'ALUMNI' ||
      payload?.role === 'PROFESSOR' ||
      payload?.role === 'ADMIN'
    ) {
      return payload.role;
    }

    return null;
  } catch {
    return null;
  }
}

export function getUserIdFromAccessToken(token: string): string | null {
  try {
    const payload = decodeJwtPayload(token);
    return payload?.userId ?? null;
  } catch {
    return null;
  }
}
