import { Octokit } from "@octokit/rest";

/**
 * Service for comparing two commits in a GitHub repository. It uses the GitHub API to fetch the differences between two commits and categorizes the changed files into added, removed, and modified/renamed. If the commits are the same, it returns empty lists for changed, added, and removed files.
 * @module commitComparator
 * @requires @octokit/rest
 */
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Interface representing the result of comparing two commits. It includes the base and head commit SHAs, lists of changed, added, and removed files, and a boolean indicating if the commits are the same.
 * @interface CommitComparison
 * @property {string} baseCommitSha - The SHA of the base commit
 * @property {string} headCommitSha - The SHA of the head commit
 * @property {string[]} changedFiles - List of files that have been changed
 * @property {string[]} addedFiles - List of files that have been added
 * @property {string[]} removedFiles - List of files that have been removed
 * @property {boolean} sameCommit - Boolean indicating if the commits are the same
 */
export interface CommitComparison {
    baseCommitSha: string;
    headCommitSha: string;
    changedFiles: string[];
    addedFiles: string[];
    removedFiles: string[];
    sameCommit: boolean;
}

/**
 * Compare two commits and return which files changed
 * If commits are the same, returns empty changed/added/removed arrays.
 * @param owner - GitHub user
 * @param repo - Repository name
 * @param baseCommitSha - Base commit SHA (or null for first fetch)
 * @param headCommitSha - New commit SHA
 * @returns Commit comparison details
 */
export async function compareCommits(
    owner: string,
    repo: string,
    baseCommitSha: string | null,
    headCommitSha: string
): Promise<CommitComparison> {
    if (baseCommitSha === headCommitSha) {
        return {
            baseCommitSha: baseCommitSha || "",
            headCommitSha,
            changedFiles: [],
            addedFiles: [],
            removedFiles: [],
            sameCommit: true
        };
    }

    /**
     * If there's no base commit (first time fetching), we can't compare - treat all files as new.
     */
    if (!baseCommitSha) {
        // First fetch - treat all files as "added"
        return {
            baseCommitSha: "",
            headCommitSha,
            changedFiles: [],
            addedFiles: [],
            removedFiles: [],
            sameCommit: false
        };
    }

    try {
        const comparison = await octokit.repos.compareCommits({
            owner,
            repo,
            base: baseCommitSha,
            head: headCommitSha
        });

        /**
         * The API returns a list of files with their status (added/removed/modified/renamed).
         * We categorize them into changedFiles (modified/renamed), addedFiles, and removedFiles.
         * If the API call succeeds but returns no files, it means there are no changes between the commits.
         * In that case, we return empty arrays for changed/added/removed files.
         */
        const changedFiles: string[] = [];
        const addedFiles: string[] = [];
        const removedFiles: string[] = [];

        for (const file of comparison.data.files || []) {
            if (file.status === "removed") {
                removedFiles.push(file.filename);
            } else if (file.status === "added") {
                addedFiles.push(file.filename);
            } else if (file.status === "modified" || file.status === "renamed") {
                changedFiles.push(file.filename);
            }
        }

        return {
            baseCommitSha,
            headCommitSha,
            changedFiles,
            addedFiles,
            removedFiles,
            sameCommit: false
        };
    } catch (err) {
        console.error(`Error comparing commits ${baseCommitSha}..${headCommitSha}:`, err);
        throw err;
    }
}
