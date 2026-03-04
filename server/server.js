import express from "express";

const app = express();
const PORT = process.env.PORT || 4000;

// Put a GitHub token in env to avoid rate limits.
// Example: export GITHUB_TOKEN=ghp_xxx (mac/linux)
// Example: $env:GITHUB_TOKEN="ghp_xxx" (powershell)
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

function githubHeaders() {
    const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "github-career-assistant"
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    return headers;
}

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.get("/api/github/:username", async (req, res) => {
    const username = (req.params.username || "").trim();
    if (!username) return res.status(400).json({ error: "Username is required." });

    try {
        // 1) Profile
        const userResp = await fetch(
            `https://api.github.com/users/${encodeURIComponent(username)}`,
            { headers: githubHeaders() }
        );

        if (!userResp.ok) {
            const text = await userResp.text();
            return res.status(userResp.status).json({
                error: "Failed to fetch user",
                details: text
            });
        }

        const user = await userResp.json();

        // 2) Repos
        const reposResp = await fetch(
            `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=50&sort=updated`,
            { headers: githubHeaders() }
        );

        if (!reposResp.ok) {
            const text = await reposResp.text();
            return res.status(reposResp.status).json({
                error: "Failed to fetch repos",
                details: text
            });
        }

        const repos = await reposResp.json();

        // Normalize payload to the shape you posted
        const payload = {
            profile: {
                login: user.login,
                name: user.name,
                avatar_url: user.avatar_url,
                html_url: user.html_url,
                bio: user.bio,
                location: user.location,
                followers: user.followers,
                following: user.following,
                public_repos: user.public_repos
            },
            repos: Array.isArray(repos)
                ? repos.map((r) => ({
                    name: r.name,
                    html_url: r.html_url,
                    description: r.description,
                    language: r.language,
                    stargazers_count: r.stargazers_count,
                    forks_count: r.forks_count,
                    updated_at: r.updated_at
                }))
                : []
        };

        res.setHeader("Cache-Control", "no-store");
        res.json(payload);
    } catch (err) {
        res.status(500).json({ error: "Server error", details: String(err) });
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Example API:  http://localhost:${PORT}/api/github/torvalds`);
});