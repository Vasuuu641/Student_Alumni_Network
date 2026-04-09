import type { UserRole } from '../lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const profileEndpointByRole: Record<Exclude<UserRole, 'ADMIN'>, string> = {
	STUDENT: '/students/profile',
	ALUMNI: '/alumni/profile',
	PROFESSOR: '/professors/profile',
};

export interface UpdateOnboardingRequest {
	token: string;
	role: Exclude<UserRole, 'ADMIN'>;
	payload: Record<string, unknown>;
	profilePicture?: File;
}

export interface OnboardingProfileResponse {
	firstName?: string | null;
	lastName?: string | null;
	major?: string | null;
	yearOfGraduation?: number | null;
	yearofGraduation?: number | null;
	company?: string | null;
	jobTitle?: string | null;
	faculty?: string | null;
	bio?: string | null;
	interests?: string[] | null;
	isAnonymous?: boolean | null;
	anonymousName?: string | null;
}

export async function getOnboardingProfile(
	token: string,
	role: Exclude<UserRole, 'ADMIN'>,
): Promise<OnboardingProfileResponse> {
	const endpoint = profileEndpointByRole[role];
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to load onboarding data.'));
	}

	return (data as OnboardingProfileResponse) ?? {};
}

export async function updateOnboardingProfile({
	token,
	role,
	payload,
	profilePicture,
}: UpdateOnboardingRequest): Promise<void> {
	const endpoint = profileEndpointByRole[role];

	if (Object.keys(payload).length > 0) {
		await sendJsonProfileUpdate(endpoint, token, payload);
	}

	if (profilePicture) {
		await sendProfilePictureUpdate(endpoint, token, profilePicture);
	}
}

async function sendJsonProfileUpdate(
	endpoint: string,
	token: string,
	payload: Record<string, unknown>,
): Promise<void> {
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to save onboarding information.'));
	}
}

async function sendProfilePictureUpdate(endpoint: string, token: string, file: File): Promise<void> {
	const formData = new FormData();
	formData.append('profilePicture', file);

	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body: formData,
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to upload profile picture.'));
	}
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
