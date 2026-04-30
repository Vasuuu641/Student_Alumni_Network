import type { UserRole } from '../lib/auth';
import { authFetch } from './http-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const profileEndpointByRole: Record<Exclude<UserRole, 'ADMIN'>, string> = {
	STUDENT: '/students/profile',
	ALUMNI: '/alumni/profile',
	PROFESSOR: '/professors/profile',
};

export interface UserProfileData {
	userId: string;
	firstName: string;
	lastName: string;
	email?: string;
	bio?: string | null;
	interests?: string[] | null;
	profilePictureUrl?: string | null;
	
	// Student/Professor fields
	major?: string | null;
	yearofGraduation?: number | null;
	faculty?: string | null;
	
	// Alumni/Student fields
	company?: string | null;
	jobTitle?: string | null;
	
	// Alumni-specific fields
	isAnonymous?: boolean | null;
	anonymousName?: string | null;
}

export interface AdminProfileData {
	userId: string;
	firstName: string;
	lastName: string;
	role: 'ADMIN';
}

/**
 * Fetches the current user's profile data
 * Determines the role-specific endpoint and retrieves full profile
 */
export async function getCurrentUserProfile(role: Exclude<UserRole, 'ADMIN'>): Promise<UserProfileData> {
	const endpoint = profileEndpointByRole[role];
	const response = await authFetch(`${API_BASE_URL}${endpoint}`, {
		method: 'GET',
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to load profile data.'));
	}

	return (data as UserProfileData) ?? {};
}

export async function getAdminProfile(): Promise<AdminProfileData> {
	const response = await authFetch(`${API_BASE_URL}/auth/me`, {
		method: 'GET',
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to load profile data.'));
	}

	return (data as AdminProfileData) ?? {} as AdminProfileData;
}

export async function updateAdminProfile(payload: {
	firstName?: string;
	lastName?: string;
}): Promise<AdminProfileData> {
	const response = await authFetch(`${API_BASE_URL}/auth/me`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(payload),
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Unable to save profile data.'));
	}

	return (data as AdminProfileData) ?? {} as AdminProfileData;
}

/**
 * Fetches another user's profile by ID
 * Note: This endpoint may need to be created in the backend if it doesn't exist
 * For now, this is a placeholder for future implementation
 */
export async function getUserProfileById(userId: string): Promise<UserProfileData> {
	// TODO: Implement public profile endpoint in backend
	// GET /{role}/:userId/profile (without authentication)
	const endpoint = `/users/${userId}/profile`;
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		method: 'GET',
	});

	const data = await readJsonSafely(response);
	if (!response.ok) {
		throw new Error(getErrorMessage(data, 'Profile not found or is private.'));
	}

	return (data as UserProfileData) ?? {};
}

async function readJsonSafely(response: Response): Promise<unknown> {
	const contentType = response.headers.get('content-type');
	if (!contentType?.includes('application/json')) {
		return null;
	}

	try {
		return await response.json();
	} catch {
		return null;
	}
}

function getErrorMessage(data: unknown, fallback: string): string {
	if (
		data &&
		typeof data === 'object' &&
		'message' in data &&
		typeof data.message === 'string'
	) {
		return data.message;
	}

	return fallback;
}
