# ⚙️ Get-Your-Map Backend API

The **Get-Your-Map Backend** is a high-performance Express.js server that powers the core code analysis and GitHub data integration. It uses **native C++ Tree-sitter bindings** to parse source code and uses **Ollama** for AI-driven insights.

## 🚀 Key Features

- **Native Tree-sitter Integration**: Bypasses WASM-based parsers for blazing-fast AST analysis.
- **Complex Code Metrics**: Analyzes loops (`for`, `while`), branching (`if`, `switch`), functions, and classes to calculate a 0-100 logic quality score.
- **Ollama AI Hooks**: Seamlessly pipes complexity metrics to local LLMs (like `llama3.1` or `qwen2.5:1.5b`) for human-readable code reviews.
- **GitHub GraphQL/REST Wrapper**: Efficiently fetches profile, repository, and rate-limit data from GitHub.

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
```

### 4. Running the Server
```bash
# Start in development mode (with watch)
npm run dev

# Start in production mode
npm start
```

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check |
| `GET` | `/api/github/:username` | Fetches GitHub profile and repo list |
| `GET` | `/api/github/rate-limit` | Gets current GitHub API usage status |
| `POST` | `/api/analysis/:user/:repo` | Analyzes a repository + generates AI insights |

---
For client-side information, please check the [`/client`](../client) directory.
