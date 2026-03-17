import { Octokit } from "@octokit/rest";

/**
 * Octokit instance for GitHub API
 */
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * Get all files in the repository recursively
 * (using tree endpoint)
 * used Promise <Array> for async operations 
 * @param owner - GitHub username
 * @param repo - Repository name
 * @param ref - Branch name
 * @returns Promise<Array<{ path: string; type: "file" | "dir"; size?: number }>>
 */
export async function fetchRepoFiles(
  owner: string,
  repo: string,
  ref: string = "main"
): Promise<Array<{ path: string; type: "file" | "dir"; size?: number }>> {
  try {
    const response = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref,
      recursive: "1"
    });

    return response.data.tree
      .filter((item) => item.type === "blob") // only files
      .map((item) => ({
        path: item.path,
        type: "file",
        size: item.size || 0
      }));
  } catch (err) {
    console.error(`Error fetching tree for ${owner}/${repo}:`, err);
    return [];
  }
}

/**
 * GET specific file content from GitHub raw content endpoint
 * @param owner - GitHub username
 * @param repo - Repository name
 * @param path - File path
 * @param ref - Branch name
 * @returns Promise<string | null>
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string = "main"
): Promise<string | null> {
  try {
    // raw.githubusercontent.com/owner/repo/branch/path/to/file
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
    const headers: Record<string, string> = {};
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`${path} is possibly a directory or not found, skipping`);
      } else {
        console.error(`Error fetching raw content from ${path}, status: ${response.status}`);
      }
      return null;
    }

    return await response.text();
  } catch (err) {
    console.error(`Error fetching content from ${path}:`, err);
    return null;
  }
}

/**
 * Filter source code files from the repository
 * (exclude test, node_modules, dist, etc.)
 * @param files - Array of files to filter
 * @returns Array of filtered files
 */
export function filterSourceFiles(
  files: Array<{ path: string; type: "file" | "dir"; size?: number }>
): Array<{ path: string; type: "file" | "dir"; size?: number }> {
  // Exclude patterns for filtering source code files
  const excludePatterns = [
    /node_modules/,
    /\.git\//,
    /dist\//,
    /build\//,
    /coverage\//,
    /\.next\//,
    /\.(png|jpg|gif|svg|ico)$/,
    /\.(pdf|doc|docx)$/,
    /\.env/,
    /\.gitignore/,
    /\.tflite/,
    /\.onnx/,
    /\.pb/,
    /\.onnx/,
    //these are the text, md files they are exclueded for now, but later, we will use them to analyze with llms
    /\.txt/,
    /\.md/,
    /\.log/,
    /\.json/,
    /\.xml/,
    /\.yml/,
    /\.yaml/,
    /\.toml/,
    /\.ini/,
    /\.cfg/,
    /\.conf/,
    /\.config/,
    /\.settings/,
    /\.vscode/,
    /\.idea/,
    /\.DS_Store/,
    /\.git/,
    /\.svn/,
    /\.hg/,
    /\.DS_Store/
  ];

  return files.filter((file) => {
    return !excludePatterns.some((pattern) => pattern.test(file.path));
  });
}