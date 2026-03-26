import { fetchRepoFiles, fetchFileContent, filterSourceFiles } from "./githubFileServices";
import { RepoFile } from "../../models/repoFilesCache.model";

/**
 * Fetch specific files from repository
 * @param owner - GitHub username
 * @param repo - Repository name
 * @param filePaths - Array of file paths to fetch
 * @param ref - Branch or commit SHA
 * @returns Array of fetched files with content
 */
export async function fetchSpecificFiles(
    owner: string,
    repo: string,
    filePaths: string[],
    ref: string = "main"
): Promise<RepoFile[]> {
    const files: RepoFile[] = [];

    for (const filePath of filePaths) {
        const content = await fetchFileContent(owner, repo, filePath, ref);
        if (content) {
            files.push({
                path: filePath,
                content,
                size: content.length
            });
        }
    }

    return files;
}

/**
 * Fetch all source files from repository (initial fetch)
 * @param owner - GitHub username
 * @param repo - Repository name
 * @param maxFiles - Maximum number of files to fetch (default 100)
 * @param ref - Branch or commit SHA
 * @returns Array of fetched files preserving directory structure
 */
export async function fetchAllSourceFiles(
    owner: string,
    repo: string,
    maxFiles: number = 100,
    ref: string = "main"
): Promise<RepoFile[]> {
    const allFiles = await fetchRepoFiles(owner, repo, ref);
    const sourceFiles = filterSourceFiles(allFiles);

    const files: RepoFile[] = [];

    for (const file of sourceFiles.slice(0, maxFiles)) {
        const content = await fetchFileContent(owner, repo, file.path, ref);
        if (content) {
            files.push({
                path: file.path,
                content,
                size: content.length
            });
        }
    }

    return files;
}

/**
 * Merge changed files with existing cached files
 * Removes deleted files, updates changed/added files, keeps untouched files
 * @param existingFiles - Previously cached files
 * @param changedFiles - Files to update (with new content)
 * @param addedFiles - Names of files to add
 * @param removedFiles - Names of files to remove
 * @returns Merged file tree
 */
export function mergeFileChanges(
    existingFiles: RepoFile[],
    changedFiles: RepoFile[],
    addedFiles: RepoFile[],
    removedFiles: string[]
): RepoFile[] {
    /**
     *  Create map of existing files for easy lookup and merging.
     * existingFiles is the source of truth for files that haven't changed.
     * We will remove deleted files, update changed files, and add new files based on the provided lists. 
     * */
    const fileMap = new Map(existingFiles.map(f => [f.path, f]));

    // Remove deleted files
    for (const removedPath of removedFiles) {
        fileMap.delete(removedPath);
    }

    // Update changed files
    for (const changedFile of changedFiles) {
        fileMap.set(changedFile.path, changedFile);
    }

    // Add new files
    for (const addedFile of addedFiles) {
        fileMap.set(addedFile.path, addedFile);
    }

    return Array.from(fileMap.values());
}
