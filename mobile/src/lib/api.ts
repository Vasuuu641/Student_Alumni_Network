import { API_BASE_URL as API_BASE_URL_VALUE } from './api-base';
import { refreshStoredSession } from './auth-session';

export { API_BASE_URL } from './api-base';

type JsonRequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const response = await fetchJson(path, options, options.token);
  const data = await readJsonSafely(response);

  if (response.status === 401 && options.token) {
    const refreshedToken = await refreshStoredSession();

    if (refreshedToken && refreshedToken !== options.token) {
      const retryResponse = await fetchJson(path, options, refreshedToken);
      const retryData = await readJsonSafely(retryResponse);

      if (!retryResponse.ok) {
        throw new Error(getErrorMessage(retryData, 'Unable to load data.'));
      }

      return retryData as T;
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'Unable to load data.'));
  }

  return data as T;
}

async function fetchJson(path: string, options: JsonRequestOptions, token?: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  return fetch(`${API_BASE_URL_VALUE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) {
    return data;
  }

  if (data && typeof data === 'object') {
    const message = (data as { message?: string | string[] }).message;
    if (Array.isArray(message) && message.length > 0) {
      return message.join(', ');
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}