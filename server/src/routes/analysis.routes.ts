import { Router, Request, Response } from "express";
import { analyzeRepository } from "../services/codeAnalysis/codeAnalysisEngine";
import { callOllama, checkOllamaHealth } from "../services/ollama/ollamaClient";
import { generateCodeAnalysisPrompt, generateRoadmapPrompt } from "../services/ollama/prompts";

const router = Router();

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
 * 
 */
router.post("/api/analysis/:username/:repo", async (req: Request, res: Response) => {
    const username = req.params.username as string;
    const repo = req.params.repo as string;
    const { targetRole } = req.body;

    try {
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
        res.json({
            repository: {
                owner: username,
                name: repo
            },
            codeAnalysis: analysis,
            ollamaAnalysis,
            roadmap: roadmap || null,
            timestamp: new Date().toISOString()
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

        res.setHeader("Cache-Control", "no-store");
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: "Server error", details: String(err) });
    }
});

export default router;