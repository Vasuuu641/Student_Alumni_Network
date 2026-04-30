import axios from 'axios';
import { isTokenExpired } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const NORMALIZED_API_BASE = API_BASE_URL.replace(/\/$/, '');
const ACCESS_TOKEN_KEY = 'unibridge.accessToken';
const REFRESH_TOKEN_KEY = 'unibridge.refreshToken';

type RetryConfig = {
  url?: string;
  headers?: Record<string, string>;
  _retry?: boolean;
} & Record<string, unknown>;

let refreshPromise: Promise<string | null> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${NORMALIZED_API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return null;
      }

      const tokens = (await response.json()) as { accessToken?: string; refreshToken?: string };
      if (!tokens.accessToken || !tokens.refreshToken) {
        clearTokens();
        return null;
      }

      setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const api = axios.create({
  baseURL: NORMALIZED_API_BASE,
});

api.interceptors.request.use(async (config) => {
  let token = getAccessToken();
  
  // If token is expired, refresh it before making the request
  if (token && isTokenExpired(token)) {
    const newToken = await refreshAccessToken();
    token = newToken;
  }
  
  if (!token) return config;

  const headers = (config.headers ?? {}) as Record<string, string>;
  headers.Authorization = `Bearer ${token}`;
  config.headers = headers as any;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: any) => {
    const originalConfig = error.config as RetryConfig | undefined;
    const status = error?.response?.status;

    if (!originalConfig || originalConfig._retry || status !== 401) {
      return Promise.reject(error);
    }

    const requestUrl = `${originalConfig.url ?? ''}`;
    if (requestUrl.includes('/auth/refresh') || requestUrl.includes('/auth/login')) {
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      return Promise.reject(error);
    }

    const headers = (originalConfig.headers ?? {}) as Record<string, string>;
    headers.Authorization = `Bearer ${newAccessToken}`;
    originalConfig.headers = headers;

    return api(originalConfig as any);
  },
);

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const requestHeaders = new Headers(init?.headers ?? {});
  let token = getAccessToken();
  
  // If token is expired, refresh it before making the request
  if (token && isTokenExpired(token)) {
    const newToken = await refreshAccessToken();
    token = newToken;
  }
  
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  const execute = async (headers: Headers): Promise<Response> => fetch(input, {
    ...init,
    headers,
  });

  let response = await execute(requestHeaders);
  if (response.status !== 401) {
    return response;
  }

  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    return response;
  }

  const retryHeaders = new Headers(init?.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);
  response = await execute(retryHeaders);
  return response;
}
