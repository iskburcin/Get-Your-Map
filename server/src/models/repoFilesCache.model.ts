import mongoose, { Schema, Model } from "mongoose";

/**
 * Interface representing a file in the repository cache.
 * @interface RepoFile
 * @property {string} path - The file path
 * @property {string} content - The file content
 * @property {number} size - The file size
 * @property {string} lastModified - The last modified date (optional)
 */
export interface RepoFile {
    path: string;
    content: string;
    size: number;
    lastModified?: string;
}

/**
 * This model defines the schema for caching GitHub repository files and their metadata.
 * It stores the repository owner, name, commit SHA, branch, a tree of files with their content and size,
 * and timestamps for when the data was last synced and served. The cache is used to minimize redundant
 * API calls to GitHub and improve response times for requests that require repository file data.
 * @interface RepoFilesCacheDocument
 * @property {string} owner - GitHub repository owner (username)
 * @property {string} repo - GitHub repository name
 * @property {string} commitSha - The commit SHA that this cache corresponds to
 * @property {string} branch - The branch name (default "main")
 * @property {Array<{ path: string; content: string; size: number; lastModified?: string }>} filesTree - An array representing the file tree of the repository, where each file has its path, content, size, and optional last modified date.
 */
export interface RepoFilesCacheDocument {
    owner: string;
    repo: string;
    commitSha: string;
    branch: string;
    filesTree: RepoFile[];
    totalFiles: number;
    lastSourceSyncAt: Date;
    lastServedAt: Date;
}

/**
 * Mongoose schema for the repository files cache. It defines the structure of the documents stored in the "repo_files_cache" collection.
 * Indexes are created on the combination of owner, repo, and commitSha for fast lookups and to ensure uniqueness of cache entries for specific commits.
 * An additional index is created on the combination of owner, repo, and branch to allow efficient retrieval of the latest cache for a branch.
 * The schema also includes timestamps for when the document was created and last updated.
 * @constant {Schema} repoFilesCacheSchema - Mongoose schema for repository files cache
 * @collection repo_files_cache
 */
const repoFilesCacheSchema = new Schema(
    {
        owner: { type: String, required: true, index: true },
        repo: { type: String, required: true, index: true },
        commitSha: { type: String, required: true, index: true },
        branch: { type: String, required: true, default: "main" },
        filesTree: [
            {
                path: { type: String, required: true },
                content: { type: String, required: true },
                size: { type: Number, required: true },
                lastModified: { type: String }
            }
        ],
        totalFiles: { type: Number, required: true },
        lastSourceSyncAt: { type: Date, required: true },
        lastServedAt: { type: Date, required: true }
    },
    {
        timestamps: true,
        collection: "repo_files_cache"
    }
);

/**
 * Indexes for the repository files cache schema. A unique index is created on the combination of owner, repo, and commitSha to ensure that there is only one cache entry per specific commit. An additional index is created on the combination of owner, repo, and branch to allow efficient retrieval of the latest cache for a branch.
 */
repoFilesCacheSchema.index({ owner: 1, repo: 1, commitSha: 1 }, { unique: true });
repoFilesCacheSchema.index({ owner: 1, repo: 1, branch: 1 });

export const RepoFilesCacheModel: Model<RepoFilesCacheDocument> =
    (mongoose.models.RepoFilesCache as Model<RepoFilesCacheDocument>) ||
    mongoose.model<RepoFilesCacheDocument>("RepoFilesCache", repoFilesCacheSchema);
