import { Router, Request, Response } from "express";
import { analyzeRepository } from "../services/codeAnalysis/codeAnalysisEngine";
import { callOllama, checkOllamaHealth } from "../services/ollama/ollamaClient";
import { generateCodeAnalysisPrompt, generateRoadmapPrompt } from "../services/ollama/prompts";
import { createHashFromObject } from "../utils/hash";
import { isMongoConnected } from "../db/mongo";
import { GithubProfileCacheModel } from "../models/githubProfileCache.model";
import { RepoAnalysisCacheModel } from "../models/repoAnalysisCache.model";
import { fetchRepoMetadata } from "../services/github/repoMetadataService";
import { compareCommits } from "../services/github/commitComparator";
import { fetchAllSourceFiles, fetchSpecificFiles, mergeFileChanges } from "../services/github/fileStreamService";
import { RepoFilesCacheModel } from "../models/repoFilesCache.model";

const router = Router();

function cacheLog(scope: "profile" | "repo-files" | "analysis", message: string) {
    console.log(`[cache:${scope}] ${message}`);
}

/**
 * Get GitHub API headers
 * @returns Headers for GitHub API
 */
function githubHeaders() {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
        console.warn("WARNING: GITHUB_TOKEN is not defined in environment variables. API calls may fail.");
    }
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "github-career-assistant"
    };
    if (GITHUB_TOKEN) headers.Authorization = `token ${GITHUB_TOKEN}`;
    return headers;
}

/**
 * GET /health
 * Check server health
 */
router.get("/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
});

/**
 * GET /api/analysis/health
 * Check Ollama server status
 */
router.get("/api/analysis/health", async (_req: Request, res: Response) => {
    const ollamaHealthy = await checkOllamaHealth();

    res.json({
        ollama: {
            status: ollamaHealthy ? "healthy" : "unavailable",
            url: process.env.OLLAMA_URL || "http://localhost:11434"
        }
    });
});

/**
 * POST /api/analysis/:username/:repo
 * Analyze a repository and generate a roadmap for a target role
 */
router.post("/api/analysis/:username/:repo", async (req: Request, res: Response) => {
    const username = req.params.username as string;
    const repo = req.params.repo as string;
    const { targetRole } = req.body;
    const normalizedTargetRole = typeof targetRole === "string" ? targetRole.trim().toLowerCase() : "";
    const mongoReady = isMongoConnected();

    if (!mongoReady) {
        cacheLog("repo-files", `skip (mongo disconnected) for ${username}/${repo}`);
        cacheLog("analysis", `skip (mongo disconnected) for ${username}/${repo}`);
    }

    try {
        let repoHeadSha: string | null = null;

        try {
            const metadata = await fetchRepoMetadata(username, repo);
            repoHeadSha = metadata.headSha;
            const defaultBranch = metadata.defaultBranch;

            // Step 1: Check for file changes and update file cache
            if (mongoReady) {
                const cachedFiles = await RepoFilesCacheModel.findOne(
                    { owner: username, repo, branch: defaultBranch },
                    { commitSha: 1, filesTree: 1 }
                ).lean();

                const previousSha = cachedFiles?.commitSha || null;
                const commitComparison = await compareCommits(username, repo, previousSha, repoHeadSha);

                if (!commitComparison.sameCommit) {
                    cacheLog(
                        "repo-files",
                        `miss ${username}/${repo} ${previousSha?.slice(0, 7) || "initial"}->${repoHeadSha.slice(0, 7)} (c:${commitComparison.changedFiles.length},a:${commitComparison.addedFiles.length},r:${commitComparison.removedFiles.length})`
                    );

                    let updatedFiles = cachedFiles?.filesTree || [];

                    if (cachedFiles && cachedFiles.filesTree.length > 0) {
                        const changedFileContents = await fetchSpecificFiles(
                            username,
                            repo,
                            commitComparison.changedFiles,
                            repoHeadSha
                        );
                        const addedFileContents = await fetchSpecificFiles(
                            username,
                            repo,
                            commitComparison.addedFiles,
                            repoHeadSha
                        );

                        updatedFiles = mergeFileChanges(
                            cachedFiles.filesTree,
                            changedFileContents,
                            addedFileContents,
                            commitComparison.removedFiles
                        );
                    } else {
                        updatedFiles = await fetchAllSourceFiles(username, repo, 100, repoHeadSha);
                    }

                    await RepoFilesCacheModel.findOneAndUpdate(
                        { owner: username, repo, branch: defaultBranch },
                        {
                            owner: username,
                            repo,
                            commitSha: repoHeadSha,
                            branch: defaultBranch,
                            filesTree: updatedFiles,
                            totalFiles: updatedFiles.length,
                            lastSourceSyncAt: new Date(),
                            lastServedAt: new Date()
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );

                    cacheLog("repo-files", `stored ${username}/${repo} files=${updatedFiles.length}`);
                } else {
                    cacheLog("repo-files", `hit ${username}/${repo} sha=${repoHeadSha.slice(0, 7)}`);
                }
            }

            // Step 2: Check for cached analysis result (if commit unchanged)
            if (mongoReady) {
                const cached = await RepoAnalysisCacheModel.findOne({
                    owner: username,
                    repo,
                    targetRole: normalizedTargetRole,
                    repoHeadSha
                }).lean();

                if (cached?.responsePayload) {
                    await RepoAnalysisCacheModel.updateOne(
                        { _id: cached._id },
                        { $set: { lastServedAt: new Date() } }
                    );

                    cacheLog("analysis", `hit ${username}/${repo} sha=${repoHeadSha?.slice(0, 7)} role=${normalizedTargetRole || "none"}`);

                    return res.json({
                        ...cached.responsePayload,
                        cache: {
                            status: "hit",
                            key: `${username}/${repo}@${repoHeadSha}`
                        }
                    });
                }

                cacheLog("analysis", `miss ${username}/${repo} sha=${repoHeadSha?.slice(0, 7)} role=${normalizedTargetRole || "none"}`);
            }
        } catch (metadataError) {
            console.warn(`Could not fetch repository metadata or files for ${username}/${repo}:`, metadataError);
        }

        // 1) Code analysis
        console.log(`Analyzing ${username}/${repo}...`);
        const analysisResults = await analyzeRepository(username, repo);

        if (analysisResults.length === 0) {
            return res.status(404).json({ error: "Could not analyze repository" });
        }

        const analysis = analysisResults[0];

        // 2) Ollama health check
        const ollamaHealthy = await checkOllamaHealth();

        if (!ollamaHealthy) {
            return res.status(503).json({
                error: "Ollama server is not running",
                details: "Make sure Ollama is running on http://localhost:11434",
                analysis // Analiz sonuçlarını yine gönder
            });
        }

        // 3) Call Ollama for analysis
        console.log("Calling Ollama for analysis...");
        const analysisPrompt = generateCodeAnalysisPrompt(analysis);

        let ollamaAnalysis: string;
        try {
            ollamaAnalysis = await callOllama({
                model: process.env.OLLAMA_MODEL || "qwen2.5:1.5b",
                prompt: analysisPrompt,
                temperature: 0.6
            });
        } catch (err) {
            console.error("Ollama error:", err);
            return res.status(500).json({
                error: "Ollama analysis failed",
                details: String(err),
                analysis
            });
        }

        // 4) If targetRole exists, generate roadmap
        // Target Role will be predicted by the ai model in the future based on the analysis
        let roadmap: string | null = null;

        if (targetRole) {
            try {
                console.log(`Generating roadmap for ${targetRole}...`);
                const roadmapPrompt = generateRoadmapPrompt(analysis, targetRole);

                roadmap = await callOllama({
                    model: process.env.OLLAMA_MODEL || "qwen2.5:1.5b",
                    prompt: roadmapPrompt,
                    temperature: 0.7
                });
            } catch (err) {
                console.error("Roadmap generation error:", err);
                // Roadmap hata alsa bile analysis'i gönder
            }
        }

        // 5) Response gönder
        const responsePayload = {
            repository: {
                owner: username,
                name: repo
            },
            codeAnalysis: analysis,
            ollamaAnalysis,
            roadmap: roadmap || null,
            timestamp: new Date().toISOString()
        };

        if (mongoReady && repoHeadSha) {
            await RepoAnalysisCacheModel.findOneAndUpdate(
                {
                    owner: username,
                    repo,
                    targetRole: normalizedTargetRole,
                    repoHeadSha
                },
                {
                    owner: username,
                    repo,
                    targetRole: normalizedTargetRole,
                    repoHeadSha,
                    responsePayload,
                    lastSourceSyncAt: new Date(),
                    lastServedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            cacheLog("analysis", `stored ${username}/${repo} sha=${repoHeadSha.slice(0, 7)} role=${normalizedTargetRole || "none"}`);
        } else if (mongoReady && !repoHeadSha) {
            cacheLog("analysis", `skip store ${username}/${repo} (missing repo head sha)`);
        }

        res.json({
            ...responsePayload,
            cache: {
                status: "miss",
                key: repoHeadSha ? `${username}/${repo}@${repoHeadSha}` : null
            }
        });
    } catch (err) {
        console.error("Analysis error:", err);
        res.status(500).json({ error: String(err) });
    }
});



/**
 * GET /api/github/rate-limit
 * Get GitHub API rate limit
 */
router.get("/api/github/rate-limit", async (_req: Request, res: Response) => {
    try {
        const resp = await fetch("https://api.github.com/rate_limit", { headers: githubHeaders() });
        if (!resp.ok) {
            return res.status(resp.status).json({ error: "Failed to fetch rate limit" });
        }
        const data = await resp.json();
        res.setHeader("Cache-Control", "no-store");
        res.json(data.rate);
    } catch (err) {
        res.status(500).json({ error: "Server error", details: String(err) });
    }
});

/**
 * GET /api/github/:username
 * Get user data from GitHub API
 */
router.get("/api/github/:username", async (req: Request, res: Response) => {
    const username = (req.params.username as string || "").trim();
    if (!username) return res.status(400).json({ error: "Username is required." });
    const mongoReady = isMongoConnected();

    if (!mongoReady) {
        cacheLog("profile", `skip (mongo disconnected) for ${username}`);
    }

    try {
        const query = `
          query($username: String!) {
            user(login: $username) {
              login
              name
              avatarUrl
              url
              bio
              location
              followers { totalCount }
              following { totalCount }
              repositories(first: 50, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
                totalCount
                nodes {
                  name
                  url
                  description
                  primaryLanguage { name }
                  stargazerCount
                  forkCount
                  updatedAt
                }
              }
            }
          }
        `;

        const resp = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
                ...githubHeaders(),
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                query,
                variables: { username }
            })
        });

        if (!resp.ok) {
            const text = await resp.text();
            return res.status(resp.status).json({
                error: "Failed to fetch data from GitHub GraphQL",
                details: text
            });
        }

        const data = await resp.json();
        if (data.errors) {
            return res.status(400).json({
                error: "GraphQL Error",
                details: data.errors
            });
        }

        const user = data.data.user;
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const payload = {
            profile: {
                login: user.login,
                name: user.name,
                avatar_url: user.avatarUrl,
                html_url: user.url,
                bio: user.bio,
                location: user.location,
                followers: user.followers.totalCount,
                following: user.following.totalCount,
                public_repos: user.repositories.totalCount
            },
            repos: user.repositories.nodes.map((r: any) => ({
                name: r.name,
                html_url: r.url,
                description: r.description,
                language: r.primaryLanguage?.name || null,
                stargazers_count: r.stargazerCount,
                forks_count: r.forkCount,
                updated_at: r.updatedAt
            }))
        };

        const profileHash = createHashFromObject(payload.profile);
        const reposHash = createHashFromObject(payload.repos);

        if (mongoReady) {
            const cached = await GithubProfileCacheModel.findOne({ username }).lean();

            if (cached && cached.profileHash === profileHash && cached.reposHash === reposHash) {
                await GithubProfileCacheModel.updateOne(
                    { _id: cached._id },
                    { $set: { lastServedAt: new Date() } }
                );

                cacheLog("profile", `hit ${username} (unchanged snapshot)`);

                res.setHeader("Cache-Control", "no-store");
                return res.json({
                    profile: cached.profile,
                    repos: cached.repos,
                    cache: {
                        status: "hit",
                        changed: false
                    }
                });
            }

            cacheLog("profile", `miss ${username} (changed snapshot)`);

            await GithubProfileCacheModel.findOneAndUpdate(
                { username },
                {
                    username,
                    profile: payload.profile,
                    repos: payload.repos,
                    profileHash,
                    reposHash,
                    lastSourceSyncAt: new Date(),
                    lastServedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            cacheLog("profile", `stored ${username}`);
        }

        res.setHeader("Cache-Control", "no-store");
        res.json({
            ...payload,
            cache: {
                status: "miss",
                changed: true
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Server error", details: String(err) });
    }
});

export default router;