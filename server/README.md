# ⚙️ Get-Your-Map Backend API

The **Get-Your-Map Backend** is a high-performance Express.js server that powers the core code analysis and GitHub data integration. It uses **native C++ Tree-sitter bindings** to parse source code and uses **Ollama** for AI-driven insights.

## 🚀 Key Features

- **GitHub GraphQL/REST Wrapper**: Efficiently fetches profile, repository, and rate-limit data from GitHub.
- **Native Tree-sitter Integration**: Bypasses WASM-based parsers for blazing-fast AST analysis.
- **Language Detection**: Uses GitHub Linguist for accurate language detection.
- **Line Counting**: Uses CLOC for accurate line counting.
- **Complex Code Metrics**: Analyzes loops (`for`, `while`), branching (`if`, `switch`), functions, and classes to calculate a 0-100 logic quality score.
- **Ollama AI Hooks**: Seamlessly pipes complexity metrics to local LLMs (like `llama3.1` or `qwen2.5:1.5b`) for human-readable code reviews.

## 🛠️ Technology Stack

- **Framework**: [Express.js](https://expressjs.com/)
- **Language**: TypeScript
- **Analysis**: [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) (Native Node bindings)
- **AI Integration**: [Ollama](https://ollama.com/) (Local AI service)

## 🏃 Local Setup

### 1. Prerequisites

- **Node.js 20+**
- **Ollama** (optional, for AI features)
- **GitHub Personal Access Token**
- **MongoDB** (Atlas or local instance, optional but required for persistent caching)

### 2. Installation

```bash
cd server
npm install
```

### 3. Environment Variables

Create a `.env` file in the root of the `server/` directory:

```env
# GitHub API Token (Required for higher rate limits)
GITHUB_TOKEN=your_github_pat_...

# Server Configuration
PORT=4000
BACKEND_BASE_URL=http://localhost

# Ollama Configuration (Local AI)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b

# MongoDB Cache (Optional, enables persistent cache)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority
MONGODB_DB_NAME=github_info_ui
```

### 3.1 MongoDB Setup (Atlas)

1. Create a free cluster from [MongoDB Atlas](https://www.mongodb.com/atlas/database).
2. Create a database user (Database Access).
3. Add your IP in Network Access (or allow `0.0.0.0/0` during development).
4. Copy your connection string and set `MONGODB_URI`.
5. Set `MONGODB_DB_NAME` (default in code is `github_info_ui`).

### 3.2 MongoDB Setup (Local)

If you run MongoDB locally, use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB_NAME=github_info_ui
```

### 4. Running the Server

```bash
# Start in development mode
npm run dev

# Start in production mode
npm start
```

## 📡 API Endpoints

| Method | Endpoint                    | Description                                   |
| :----- | :-------------------------- | :-------------------------------------------- |
| `GET`  | `/health`                   | Server health check                           |
| `GET`  | `/api/github/:username`     | Fetches GitHub profile and repo list          |
| `GET`  | `/api/github/rate-limit`    | Gets current GitHub API usage status          |
| `POST` | `/api/analysis/:user/:repo` | Analyzes a repository + generates AI insights |

## 💾 Cache Behavior (MongoDB)

### 3-Layer Caching System

**Layer 1: Profile Cache** (Hash-based)

- Detects changes in GitHub profile/repos via SHA-256 hashing
- If unchanged → returns cached data instantly
- If changed → fetches fresh data and updates cache

**Layer 2: Repository Files Cache** (Commit-based) ⭐ NEW

- Stores complete source file tree (100 files max per repo)
- Keyed by repository default branch commit SHA
- Detects file changes by comparing commits
- On change: fetches only modified/added files, merges with cached tree
- Preserves directory structure (flat array with full file paths)

**Layer 3: Analysis Results Cache** (Commit-based)

- Caches full code analysis + Ollama AI insights
- Keyed by commit SHA + targetRole
- Returns cached result if commit is unchanged
- Re-analyzes only if files have changed at Layer 2

### Request Flow

```
POST /api/analysis/:owner/:repo
  ├─ Get current commit SHA from GitHub
  ├─ Compare with cached commit SHA
  │   ├─ SAME: Use cached file tree → Skip file fetch
  │   └─ DIFFERENT: Fetch changed files → Merge with cached tree
  ├─ Run analysis (or return cached result if commit unchanged)
  └─ Response includes cache metadata
```

### Response Format

All responses include cache status:

```json
{
  "repository": { "owner": "...", "name": "..." },
  "codeAnalysis": { "complexity": {...}, "languages": [...] },
  "ollamaAnalysis": "...",
  "roadmap": "...",
  "timestamp": "2026-03-26T10:00:00Z",
  "cache": {
    "status": "hit",          // or "miss"
    "key": "owner/repo@commitSHA"
  }
}
```

- `status: "hit"` = Cached result returned (same commit)
- `status: "miss"` = Fresh analysis performed (new commit or first request)

### Performance

| Scenario                   | Time    | Improvement        |
| :------------------------- | :------ | :----------------- |
| Same commit (2nd request)  | ~100ms  | ⚡ 200-300x faster |
| Changed commit (few files) | ~12-20s | ✅ 33% faster      |
| First request              | ~20-30s | —                  |

---

For client-side information, please check the [`/client`](../client) directory.
