const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface RegisterRequest {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
}

export interface RegisterResponse {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	role: string;
}

export async function registerUser(payload: RegisterRequest): Promise<RegisterResponse> {
	const response = await fetch(`${API_BASE_URL}/auth/register`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const data = await readJsonSafely(response);

	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to create account.'));
	}

	return data as RegisterResponse;
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
