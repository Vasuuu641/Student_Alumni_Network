const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface LoginRequest {
	email: string;
	password: string;
}

export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
}

export async function loginUser(payload: LoginRequest): Promise<LoginResponse> {
	const response = await fetch(`${API_BASE_URL}/auth/login`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const data = await readJsonSafely(response);

	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to sign in.'));
	}

	return data as LoginResponse;
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
