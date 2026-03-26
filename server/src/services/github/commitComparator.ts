import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

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
