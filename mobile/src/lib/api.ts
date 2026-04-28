import { Platform } from 'react-native';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');

type JsonRequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  const data = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'Unable to load data.'));
  }

  return data as T;
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