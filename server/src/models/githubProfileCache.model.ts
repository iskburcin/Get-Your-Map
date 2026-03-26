import mongoose, { Schema, Model } from "mongoose";

/**
 * This model defines the schema for caching GitHub user profiles and their repositories.
 * It stores the username, profile data, list of repositories, and hashes to track changes.
 * The cache is used to minimize API calls to GitHub and improve response times for user profile requests.
 * @interface GithubProfileCacheDocument
 * @property {string} username - GitHub username (unique identifier)
 * @property {Record<string, unknown>} profile - Cached GitHub profile data
 * @property {Array<Record<string, unknown>>} repos - Cached list of user's repositories
 * @property {string} profileHash - Hash of the profile data for change detection
 * @property {string} reposHash - Hash of the repositories list for change detection
 * @property {Date} lastSourceSyncAt - Timestamp of the last sync with GitHub API
 * @property {Date} lastServedAt - Timestamp of the last time this cache was served to a client
 */
type GithubProfileCacheModel = Model<GithubProfileCacheDocument>;
export interface GithubProfileCacheDocument {
    username: string;
    profile: Record<string, unknown>;
    repos: Array<Record<string, unknown>>;
    profileHash: string;
    reposHash: string;
    lastSourceSyncAt: Date;
    lastServedAt: Date;
}

/**
 * Mongoose schema for the GitHub profile cache. It defines the structure of the documents stored in the "github_profile_cache" collection.
 * Indexes are created on the username field for fast lookups, and the username is unique to prevent duplicate entries for the same user.
 * The schema also includes timestamps for when the document was created and last updated.
 * @constant {Schema} githubProfileCacheSchema - Mongoose schema for GitHub profile cache
 * @collection github_profile_cache
 */
const githubProfileCacheSchema = new Schema(
    {
        username: { type: String, required: true, unique: true, index: true },
        profile: { type: Schema.Types.Mixed, required: true },
        repos: { type: [Schema.Types.Mixed], required: true },
        profileHash: { type: String, required: true },
        reposHash: { type: String, required: true },
        lastSourceSyncAt: { type: Date, required: true },
        lastServedAt: { type: Date, required: true }
    },
    {
        timestamps: true,
        collection: "github_profile_cache"
    }
);

export const GithubProfileCacheModel: Model<GithubProfileCacheDocument> =
    (mongoose.models.GithubProfileCache as Model<GithubProfileCacheDocument>) ||
    mongoose.model<GithubProfileCacheDocument>("GithubProfileCache", githubProfileCacheSchema);
