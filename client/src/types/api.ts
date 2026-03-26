import { Profile, Repo } from './github';

export type PaceMs = {
	current: number;
	previous?: number;
	diff?: number;
};

/**
 * ApiSuccess type for storing the success response of the API.
 * @property {Profile} profile - The profile of the user.
 * @property {Repo[]} repos - The repositories of the user.
 */
export type ApiSuccess = {
	profile: Profile;
	repos: Repo[];
	cache?: { status: "hit" | "miss"; changed?: boolean };
	backendPaceMs?: PaceMs;
};

/**
 * ApiError type for storing the error response of the API.
 * @property {string} error - The error message.
 * @property {string} details - The error details.
 */
export type ApiError = { error: string; details?: string };
