import mongoose, { Schema, Model } from "mongoose";

/**
 * This model defines the schema for caching GitHub repository analysis results.
 * It stores the repository owner, name, target role for analysis, the head commit SHA,
 * the response payload from the analysis, and timestamps for when the data was last synced and served.
 * The cache is used to minimize redundant analysis and API calls to GitHub, improving response times for repository analysis requests.
 * @interface RepoAnalysisCacheDocument
 * @property {string} owner - GitHub repository owner (username)
 * @property {string} repo - GitHub repository name
 * @property {string} targetRole - The role for which the analysis was performed (e.g., "frontend", "backend")
 * @property {string} repoHeadSha - The head commit SHA of the repository at the time of analysis
 * @property {Record<string, unknown>} responsePayload - The cached response payload from the analysis
 * @property {Date} lastSourceSyncAt - Timestamp of the last sync with GitHub API
 * @property {Date} lastServedAt - Timestamp of the last time this cache was served to a client
 * @constant {Schema} repoAnalysisCacheSchema - Mongoose schema for repository analysis cache
 * @collection repo_analysis_cache
 */
export interface RepoAnalysisCacheDocument {
    owner: string;
    repo: string;
    targetRole: string;
    repoHeadSha: string;
    responsePayload: Record<string, unknown>;
    lastSourceSyncAt: Date;
    lastServedAt: Date;
}

/**
 * Mongoose schema for the repository analysis cache. It defines the structure of the documents stored in the "repo_analysis_cache" collection.
 * Indexes are created on the combination of owner, repo, targetRole, and repoHeadSha for fast lookups and to ensure uniqueness of cache entries for specific analysis scenarios.
 * The schema also includes timestamps for when the document was created and last updated.
 * @constant {Schema} repoAnalysisCacheSchema - Mongoose schema for repository analysis cache
 * @collection repo_analysis_cache
 */
const repoAnalysisCacheSchema = new Schema(
    {
        owner: { type: String, required: true, index: true },
        repo: { type: String, required: true, index: true },
        targetRole: { type: String, required: true, default: "" },
        repoHeadSha: { type: String, required: true, index: true },
        responsePayload: { type: Schema.Types.Mixed, required: true },
        lastSourceSyncAt: { type: Date, required: true },
        lastServedAt: { type: Date, required: true }
    },
    {
        timestamps: true,
        collection: "repo_analysis_cache"
    }
    
);

/**
 * Creates a unique index on the combination of owner, repo, targetRole, and repoHeadSha for fast lookups and to ensure uniqueness of cache entries for specific analysis scenarios.
 * @constant {Schema} repoAnalysisCacheSchema - Mongoose schema for repository analysis cache
 * @collection repo_analysis_cache
 */
repoAnalysisCacheSchema.index({ owner: 1, repo: 1, targetRole: 1, repoHeadSha: 1 }, { unique: true });

export const RepoAnalysisCacheModel: Model<RepoAnalysisCacheDocument> =
    (mongoose.models.RepoAnalysisCache as Model<RepoAnalysisCacheDocument>) ||
    mongoose.model<RepoAnalysisCacheDocument>("RepoAnalysisCache", repoAnalysisCacheSchema);
