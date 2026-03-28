import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { analyzeRepository, type CodeAnalysisResult } from "../services/codeAnalysis/codeAnalysisEngine";
import { callOllama, checkOllamaHealth, listOllamaModels } from "../services/ollama/ollamaClient";
import { generateCodeAnalysisPrompt, generateRoadmapPrompt } from "../services/ollama/prompts";
import { createHashFromObject } from "../utils/hash";
import { connectMongoDB, isMongoConnected } from "../db/mongo";
import { GithubProfileCacheModel } from "../models/githubProfileCache.model";
import { RepoAnalysisCacheModel } from "../models/repoAnalysisCache.model";
import { fetchRepoMetadata } from "../services/github/repoMetadataService";
import { compareCommits } from "../services/github/commitComparator";
import { fetchAllSourceFiles, fetchSpecificFiles, mergeFileChanges } from "../services/github/fileStreamService";
import { RepoFilesCacheModel } from "../models/repoFilesCache.model";

const router = Router();
const profilePaceByUsername = new Map<string, number>();
const analysisPaceByKey = new Map<string, number>();

type PaceMeta = {
    current: number;
    previous?: number;
    diff?: number;
};

type AnalysisJobStep = "queued" | "metrics" | "ollama" | "roadmap" | "completed";
type AnalysisJobStatus = "queued" | "running" | "completed" | "failed";

type AnalysisJob = {
    id: string;
    username: string;
    repo: string;
    model: string;
    targetRole: string;
    createdAt: number;
    updatedAt: number;
    startedAtMs: number;
    status: AnalysisJobStatus;
    step: AnalysisJobStep;
    stepLabel: string;
    progress: number;
    partial: {
        repository: { owner: string; name: string };
        codeAnalysis?: unknown;
        ollamaAnalysis?: string;
        roadmap?: string | null;
        timestamp?: string;
    };
    backendPaceMs?: PaceMeta;
    cache?: { status: "hit" | "miss"; key?: string | null };
    error?: string;
};

const analysisJobs = new Map<string, AnalysisJob>();
const ANALYSIS_JOB_TTL_MS = 1000 * 60 * 30;
const REPO_ANALYSIS_MODEL = process.env.OLLAMA_REPO_MODEL || process.env.OLLAMA_MODEL || "qwen2.5:1.5b";
const CODER_ANALYSIS_MODEL = process.env.OLLAMA_CODER_MODEL || "deepseek-coder-v2:16b";
const METRICS_CACHE_TARGET_ROLE = "__metrics_only__";

function normalizeModelName(model: string): string {
    const normalized = (model || REPO_ANALYSIS_MODEL).trim();
    return normalized || "qwen2.5:1.5b";
}

function buildAnalysisCacheTargetRole(targetRole: string, model: string): string {
    const normalizedRole = (targetRole || "").trim().toLowerCase();
    const normalizedModel = normalizeModelName(model).toLowerCase();
    return `${normalizedRole}::model:${normalizedModel}`;
}

async function findCachedMetricsByCommit(owner: string, repo: string, repoHeadSha: string) {
    const cachedMetrics = await RepoAnalysisCacheModel.findOne(
        {
            owner,
            repo,
            targetRole: METRICS_CACHE_TARGET_ROLE,
            repoHeadSha
        },
        { responsePayload: 1 }
    ).lean();

    if (!cachedMetrics?.responsePayload) return null;
    const payload = cachedMetrics.responsePayload as Record<string, unknown>;
    return (payload.codeAnalysis as CodeAnalysisResult | undefined) ?? null;
}

async function findCachedAnalysisCodeAnyModel(owner: string, repo: string, repoHeadSha: string) {
    const cachedAnyModel = await RepoAnalysisCacheModel.findOne(
        {
            owner,
            repo,
            repoHeadSha,
            targetRole: { $ne: METRICS_CACHE_TARGET_ROLE }
        },
        { responsePayload: 1 }
    )
        .sort({ lastServedAt: -1, updatedAt: -1 })
        .lean();

    if (!cachedAnyModel?.responsePayload) return null;
    const payload = cachedAnyModel.responsePayload as Record<string, unknown>;
    return (payload.codeAnalysis as CodeAnalysisResult | undefined) ?? null;
}

async function storeMetricsByCommit(owner: string, repo: string, repoHeadSha: string, codeAnalysis: CodeAnalysisResult) {
    await RepoAnalysisCacheModel.findOneAndUpdate(
        {
            owner,
            repo,
            targetRole: METRICS_CACHE_TARGET_ROLE,
            repoHeadSha
        },
        {
            owner,
            repo,
            targetRole: METRICS_CACHE_TARGET_ROLE,
            repoHeadSha,
            responsePayload: {
                codeAnalysis,
                timestamp: new Date().toISOString()
            },
            lastSourceSyncAt: new Date(),
            lastServedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

async function ensureMongoReady(maxRetries = 2): Promise<boolean> {
    if (isMongoConnected()) return true;

    for (let i = 0; i < maxRetries; i++) {
        const ok = await connectMongoDB();
        if (ok && isMongoConnected()) return true;
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return isMongoConnected();
}

function pruneOldAnalysisJobs() {
    const now = Date.now();
    for (const [jobId, job] of analysisJobs.entries()) {
        if (now - job.updatedAt > ANALYSIS_JOB_TTL_MS) {
            analysisJobs.delete(jobId);
        }
    }
}

function jobStepLabel(step: AnalysisJobStep): string {
    switch (step) {
        case "queued":
            return "Queued";
        case "metrics":
            return "Running repository metrics";
        case "ollama":
            return "Generating AI analysis";
        case "roadmap":
            return "Generating roadmap";
        case "completed":
            return "Completed";
        default:
            return "Queued";
    }
}

function setJobStep(job: AnalysisJob, step: AnalysisJobStep, progress: number) {
    job.step = step;
    job.stepLabel = jobStepLabel(step);
    job.progress = progress;
    job.updatedAt = Date.now();
}

function cacheLog(scope: "profile" | "repo-files" | "analysis", message: string) {
    console.log(`[cache:${scope}] ${message}`);
}

function trackPace(
    scope: "profile" | "analysis",
    key: string,
    startedAtMs: number
): PaceMeta {
    const map = scope === "profile" ? profilePaceByUsername : analysisPaceByKey;
    const current = Date.now() - startedAtMs;
    const previous = map.get(key);
    const diff = previous == null ? undefined : current - previous;

    map.set(key, current);

    console.log(
        `[pace:${scope}] key=${key} current=${current}ms previous=${previous ?? "none"}${
            diff == null ? "" : ` diff=${diff > 0 ? "+" : ""}${diff}ms`
        }`
    );

    if (previous == null) {
        return { current };
    }

    return { current, previous, diff };
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
 * GET /api/analysis/models
 * List available Ollama models for repo analysis settings
 */
router.get("/api/analysis/models", async (_req: Request, res: Response) => {
    const models = await listOllamaModels();

    res.json({
        models,
        selectedRepoModel: REPO_ANALYSIS_MODEL,
        selectedCoderModel: CODER_ANALYSIS_MODEL
    });
});

async function runAnalysisJob(jobId: string) {
    const job = analysisJobs.get(jobId);
    if (!job) return;

    const analysisPaceKey = `${job.username}/${job.repo}:${job.targetRole || "none"}`;
    const cacheTargetRole = buildAnalysisCacheTargetRole(job.targetRole, job.model);

    try {
        job.status = "running";
        setJobStep(job, "metrics", 25);

        const mongoReady = await ensureMongoReady();
        let repoHeadSha: string | null = null;
        let analysis: CodeAnalysisResult | null = null;

        try {
            const metadata = await fetchRepoMetadata(job.username, job.repo);
            repoHeadSha = metadata.headSha;
            const defaultBranch = metadata.defaultBranch;

            if (mongoReady) {
                const cachedFiles = await RepoFilesCacheModel.findOne(
                    { owner: job.username, repo: job.repo, branch: defaultBranch },
                    { commitSha: 1, filesTree: 1 }
                ).lean();

                const previousSha = cachedFiles?.commitSha || null;
                const commitComparison = await compareCommits(job.username, job.repo, previousSha, repoHeadSha);

                if (!commitComparison.sameCommit) {
                    cacheLog(
                        "repo-files",
                        `miss ${job.username}/${job.repo} ${previousSha?.slice(0, 7) || "initial"}->${repoHeadSha.slice(0, 7)} (c:${commitComparison.changedFiles.length},a:${commitComparison.addedFiles.length},r:${commitComparison.removedFiles.length})`
                    );

                    let updatedFiles = cachedFiles?.filesTree || [];

                    if (cachedFiles && cachedFiles.filesTree.length > 0) {
                        const changedFileContents = await fetchSpecificFiles(
                            job.username,
                            job.repo,
                            commitComparison.changedFiles,
                            repoHeadSha
                        );
                        const addedFileContents = await fetchSpecificFiles(
                            job.username,
                            job.repo,
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
                        updatedFiles = await fetchAllSourceFiles(job.username, job.repo, 100, repoHeadSha);
                    }

                    await RepoFilesCacheModel.findOneAndUpdate(
                        { owner: job.username, repo: job.repo, branch: defaultBranch },
                        {
                            owner: job.username,
                            repo: job.repo,
                            commitSha: repoHeadSha,
                            branch: defaultBranch,
                            filesTree: updatedFiles,
                            totalFiles: updatedFiles.length,
                            lastSourceSyncAt: new Date(),
                            lastServedAt: new Date()
                        },
                        { upsert: true, new: true, setDefaultsOnInsert: true }
                    );

                    cacheLog("repo-files", `stored ${job.username}/${job.repo} files=${updatedFiles.length}`);
                } else {
                    cacheLog("repo-files", `hit ${job.username}/${job.repo} sha=${repoHeadSha.slice(0, 7)}`);
                }

                const cachedAnalysis = await RepoAnalysisCacheModel.findOne({
                    owner: job.username,
                    repo: job.repo,
                    targetRole: cacheTargetRole,
                    repoHeadSha
                }).lean();

                if (cachedAnalysis?.responsePayload) {
                    await RepoAnalysisCacheModel.updateOne(
                        { _id: cachedAnalysis._id },
                        { $set: { lastServedAt: new Date() } }
                    );

                    const payload = cachedAnalysis.responsePayload as Record<string, unknown>;
                    job.partial = {
                        repository: {
                            owner: job.username,
                            name: job.repo
                        },
                        codeAnalysis: payload.codeAnalysis,
                        ollamaAnalysis: payload.ollamaAnalysis as string | undefined,
                        roadmap: (payload.roadmap as string | null | undefined) ?? null,
                        timestamp: String(payload.timestamp || new Date().toISOString())
                    };
                    job.cache = { status: "hit", key: `${job.username}/${job.repo}@${repoHeadSha}` };
                    job.backendPaceMs = trackPace("analysis", analysisPaceKey, job.startedAtMs);
                    job.status = "completed";
                    setJobStep(job, "completed", 100);
                    cacheLog("analysis", `job hit ${job.username}/${job.repo} sha=${repoHeadSha.slice(0, 7)} role=${cacheTargetRole}`);
                    return;
                }

                cacheLog("analysis", `job miss ${job.username}/${job.repo} sha=${repoHeadSha?.slice(0, 7)} role=${cacheTargetRole}`);

                const cachedMetrics = await findCachedMetricsByCommit(job.username, job.repo, repoHeadSha);
                if (cachedMetrics) {
                    analysis = cachedMetrics;
                    job.partial.codeAnalysis = cachedMetrics;
                    job.partial.timestamp = new Date().toISOString();
                    cacheLog("analysis", `job metrics hit ${job.username}/${job.repo} sha=${repoHeadSha.slice(0, 7)} (reuse for model switch)`);
                } else {
                    const cachedAnalysisCode = await findCachedAnalysisCodeAnyModel(job.username, job.repo, repoHeadSha);
                    if (cachedAnalysisCode) {
                        analysis = cachedAnalysisCode;
                        job.partial.codeAnalysis = cachedAnalysisCode;
                        job.partial.timestamp = new Date().toISOString();
                        cacheLog("analysis", `job metrics reused from other model ${job.username}/${job.repo} sha=${repoHeadSha.slice(0, 7)}`);
                        await storeMetricsByCommit(job.username, job.repo, repoHeadSha, cachedAnalysisCode);
                    }
                }
            }
        } catch (metadataError) {
            console.warn(`Could not fetch repository metadata/files for job ${job.username}/${job.repo}:`, metadataError);
        }

        if (!analysis) {
            console.log(`[analysis-job] running fresh metrics analysis for ${job.username}/${job.repo}`);
            const analysisResults = await analyzeRepository(job.username, job.repo);
            if (analysisResults.length === 0) {
                throw new Error("Could not analyze repository");
            }
            analysis = analysisResults[0];

            if (mongoReady && repoHeadSha) {
                await storeMetricsByCommit(job.username, job.repo, repoHeadSha, analysis);
                cacheLog("analysis", `job metrics stored ${job.username}/${job.repo} sha=${repoHeadSha.slice(0, 7)}`);
            }
        } else {
            console.log(`[analysis-job] reusing cached metrics for ${job.username}/${job.repo}`);
        }

        job.partial.codeAnalysis = analysis;
        job.partial.timestamp = new Date().toISOString();
        setJobStep(job, "ollama", 55);

        const ollamaHealthy = await checkOllamaHealth();
        if (!ollamaHealthy) {
            throw new Error(`Ollama server is not running on ${process.env.OLLAMA_URL || "http://localhost:11434"}`);
        }

        const analysisPrompt = generateCodeAnalysisPrompt(analysis);
        const ollamaAnalysis = await callOllama({
            model: job.model,
            prompt: analysisPrompt,
            temperature: 0.6
        });

        job.partial.ollamaAnalysis = ollamaAnalysis;
        setJobStep(job, "roadmap", 80);

        let roadmap: string | null = null;
        if (job.targetRole) {
            const roadmapPrompt = generateRoadmapPrompt(analysis, job.targetRole);
            roadmap = await callOllama({
                model: job.model,
                prompt: roadmapPrompt,
                temperature: 0.7
            });
        }

        job.partial.roadmap = roadmap;
        job.partial.timestamp = new Date().toISOString();
        job.cache = { status: "miss" };

        if (mongoReady && repoHeadSha) {
            const responsePayload = {
                repository: {
                    owner: job.username,
                    name: job.repo
                },
                codeAnalysis: analysis,
                ollamaAnalysis,
                roadmap: roadmap || null,
                timestamp: job.partial.timestamp
            };

            await RepoAnalysisCacheModel.findOneAndUpdate(
                {
                    owner: job.username,
                    repo: job.repo,
                    targetRole: cacheTargetRole,
                    repoHeadSha
                },
                {
                    owner: job.username,
                    repo: job.repo,
                    targetRole: cacheTargetRole,
                    repoHeadSha,
                    responsePayload,
                    lastSourceSyncAt: new Date(),
                    lastServedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            cacheLog("analysis", `job stored ${job.username}/${job.repo} sha=${repoHeadSha.slice(0, 7)} role=${cacheTargetRole}`);
        }

        job.backendPaceMs = trackPace("analysis", analysisPaceKey, job.startedAtMs);
        job.status = "completed";
        setJobStep(job, "completed", 100);
    } catch (err) {
        job.status = "failed";
        job.error = String(err);
        job.updatedAt = Date.now();
        console.error(`[analysis-job:${jobId}] failed`, err);
    }
}

/**
 * POST /api/analysis/:username/:repo/jobs
 * Start analysis job and return job id
 */
router.post("/api/analysis/:username/:repo/jobs", (req: Request, res: Response) => {
    pruneOldAnalysisJobs();

    const username = (req.params.username as string || "").trim();
    const repo = (req.params.repo as string || "").trim();
    const requestedModelRaw = req.body?.model;
    const selectedModel = normalizeModelName(
        typeof requestedModelRaw === "string" && requestedModelRaw.trim()
            ? requestedModelRaw
            : REPO_ANALYSIS_MODEL
    );
    const targetRoleRaw = req.body?.targetRole;
    const targetRole = typeof targetRoleRaw === "string" ? targetRoleRaw.trim() : "";

    if (!username || !repo) {
        return res.status(400).json({ error: "Username and repo are required." });
    }

    const id = randomUUID();
    const now = Date.now();

    const job: AnalysisJob = {
        id,
        username,
        repo,
        model: selectedModel,
        targetRole,
        createdAt: now,
        updatedAt: now,
        startedAtMs: now,
        status: "queued",
        step: "queued",
        stepLabel: jobStepLabel("queued"),
        progress: 5,
        partial: {
            repository: { owner: username, name: repo }
        }
    };

    analysisJobs.set(id, job);
    void runAnalysisJob(id);

    return res.status(202).json({
        jobId: id,
        model: selectedModel,
        status: job.status,
        step: job.step,
        stepLabel: job.stepLabel,
        progress: job.progress
    });
});

/**
 * GET /api/analysis/jobs/:jobId
 * Poll analysis job status and partial/final result
 */
router.get("/api/analysis/jobs/:jobId", (req: Request, res: Response) => {
    pruneOldAnalysisJobs();

    const jobId = req.params.jobId as string;
    const job = analysisJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: "Analysis job not found or expired." });
    }

    return res.json({
        jobId: job.id,
        status: job.status,
        step: job.step,
        stepLabel: job.stepLabel,
        progress: job.progress,
        data: {
            ...job.partial,
            backendPaceMs: job.backendPaceMs,
            cache: job.cache
        },
        error: job.error
    });
});

/**
 * POST /api/analysis/:username/:repo
 * Analyze a repository and generate a roadmap for a target role
 */
router.post("/api/analysis/:username/:repo", async (req: Request, res: Response) => {
    const analysisStartedAtMs = Date.now();
    const username = req.params.username as string;
    const repo = req.params.repo as string;
    const { targetRole } = req.body;
    const requestedModelRaw = req.body?.model;
    const selectedModel = normalizeModelName(
        typeof requestedModelRaw === "string" && requestedModelRaw.trim()
            ? requestedModelRaw
            : REPO_ANALYSIS_MODEL
    );
    const normalizedTargetRole = typeof targetRole === "string" ? targetRole.trim().toLowerCase() : "";
    const cacheTargetRole = buildAnalysisCacheTargetRole(normalizedTargetRole, selectedModel);
    const analysisPaceKey = `${username}/${repo}:${normalizedTargetRole || "none"}`;
    const mongoReady = await ensureMongoReady();

    if (!mongoReady) {
        cacheLog("repo-files", `skip (mongo disconnected) for ${username}/${repo}`);
        cacheLog("analysis", `skip (mongo disconnected) for ${username}/${repo}`);
    }

    try {
        let repoHeadSha: string | null = null;
        let analysis: CodeAnalysisResult | null = null;

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
                    targetRole: cacheTargetRole,
                    repoHeadSha
                }).lean();

                if (cached?.responsePayload) {
                    await RepoAnalysisCacheModel.updateOne(
                        { _id: cached._id },
                        { $set: { lastServedAt: new Date() } }
                    );

                    cacheLog("analysis", `hit ${username}/${repo} sha=${repoHeadSha?.slice(0, 7)} role=${cacheTargetRole}`);
                    const backendPaceMs = trackPace("analysis", analysisPaceKey, analysisStartedAtMs);

                    return res.json({
                        ...cached.responsePayload,
                        backendPaceMs,
                        cache: {
                            status: "hit",
                            key: `${username}/${repo}@${repoHeadSha}`
                        }
                    });
                }

                cacheLog("analysis", `miss ${username}/${repo} sha=${repoHeadSha?.slice(0, 7)} role=${cacheTargetRole}`);

                const cachedMetrics = await findCachedMetricsByCommit(username, repo, repoHeadSha);
                if (cachedMetrics) {
                    analysis = cachedMetrics;
                    cacheLog("analysis", `metrics hit ${username}/${repo} sha=${repoHeadSha.slice(0, 7)} (reuse for model switch)`);
                } else {
                    const cachedAnalysisCode = await findCachedAnalysisCodeAnyModel(username, repo, repoHeadSha);
                    if (cachedAnalysisCode) {
                        analysis = cachedAnalysisCode;
                        cacheLog("analysis", `metrics reused from other model ${username}/${repo} sha=${repoHeadSha.slice(0, 7)}`);
                        await storeMetricsByCommit(username, repo, repoHeadSha, cachedAnalysisCode);
                    }
                }
            }
        } catch (metadataError) {
            console.warn(`Could not fetch repository metadata or files for ${username}/${repo}:`, metadataError);
        }

        // 1) Code analysis (or reuse metrics cache)
        if (!analysis) {
            console.log(`Analyzing ${username}/${repo}...`);
            const analysisResults = await analyzeRepository(username, repo);

            if (analysisResults.length === 0) {
                return res.status(404).json({ error: "Could not analyze repository" });
            }

            analysis = analysisResults[0];

            if (mongoReady && repoHeadSha) {
                await storeMetricsByCommit(username, repo, repoHeadSha, analysis);
                cacheLog("analysis", `metrics stored ${username}/${repo} sha=${repoHeadSha.slice(0, 7)}`);
            }
        }

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
                model: selectedModel,
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
                    model: selectedModel,
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
                    targetRole: cacheTargetRole,
                    repoHeadSha
                },
                {
                    owner: username,
                    repo,
                    targetRole: cacheTargetRole,
                    repoHeadSha,
                    responsePayload,
                    lastSourceSyncAt: new Date(),
                    lastServedAt: new Date()
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            cacheLog("analysis", `stored ${username}/${repo} sha=${repoHeadSha.slice(0, 7)} role=${cacheTargetRole}`);
        } else if (mongoReady && !repoHeadSha) {
            cacheLog("analysis", `skip store ${username}/${repo} (missing repo head sha)`);
        }

        const backendPaceMs = trackPace("analysis", analysisPaceKey, analysisStartedAtMs);
        res.json({
            ...responsePayload,
            backendPaceMs,
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
    const profileStartedAtMs = Date.now();
    const username = (req.params.username as string || "").trim();
    if (!username) return res.status(400).json({ error: "Username is required." });
    const mongoReady = await ensureMongoReady();

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
                const backendPaceMs = trackPace("profile", username, profileStartedAtMs);

                res.setHeader("Cache-Control", "no-store");
                return res.json({
                    profile: cached.profile,
                    repos: cached.repos,
                    backendPaceMs,
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

        const backendPaceMs = trackPace("profile", username, profileStartedAtMs);
        res.setHeader("Cache-Control", "no-store");
        res.json({
            ...payload,
            backendPaceMs,
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