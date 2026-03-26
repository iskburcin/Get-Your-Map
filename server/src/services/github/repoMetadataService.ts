import { Octokit } from "@octokit/rest";

/**
 * Service for comparing two commits in a GitHub repository. It uses the GitHub API to fetch the differences between two commits and categorizes the changed files into added, removed, and modified/renamed. If the commits are the same, it returns empty lists for changed, added, and removed files.
 * @module commitComparator
 * @requires @octokit/rest
 */
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

/**
 * Interface representing repository metadata fetched from GitHub. It includes the repository owner, name, default branch, head commit SHA, and timestamps for when the repository was last pushed to and updated.
 * @interface RepoMetadata
 * @property {string} owner - GitHub repository owner (username)
 * @property {string} repo - GitHub repository name
 * @property {string} defaultBranch - The default branch of the repository
 * @property {string} headSha - The SHA of the head commit
 * @property {string | null} pushedAt - The timestamp when the repository was last pushed to
 * @property {string | null} updatedAt - The timestamp when the repository was last updated
 */
export interface RepoMetadata {
    owner: string;
    repo: string;
    defaultBranch: string;
    headSha: string;
    pushedAt: string | null;
    updatedAt: string | null;
}

/**
 * Fetch metadata for a GitHub repository. It retrieves the repository information and the default branch's head commit SHA using the GitHub API. The metadata includes the repository owner, name, default branch, head commit SHA, and timestamps for when the repository was last pushed to and updated.
 * @param owner - GitHub repository owner (username)
 * @param repo - GitHub repository name
 * @returns Repository metadata
 */
export async function fetchRepoMetadata(owner: string, repo: string): Promise<RepoMetadata> {
    const repoResponse = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoResponse.data.default_branch;

    const branchResponse = await octokit.repos.getBranch({
        owner,
        repo,
        branch: defaultBranch
    });

    return {
        owner,
        repo,
        defaultBranch,
        headSha: branchResponse.data.commit.sha,
        pushedAt: repoResponse.data.pushed_at,
        updatedAt: repoResponse.data.updated_at
    };
}
