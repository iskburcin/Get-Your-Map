# 🗺️ Get-Your-Map (GitHub Info UI)

Welcome to **Get-Your-Map**! This project provides an intuitive, modern, and interactive user interface to explore GitHub users, view their repositories, and perform in-depth code quality analysis powered by Native Tree-sitter bindings and AI. 

> **✨ Live Deployments Available!**
> 
> We have successfully deployed the application into separate highly-scalable environments on Vercel. 
> 
> - **🌐 Client Web App**: [https://get-your-map.vercel.app/](https://get-your-map.vercel.app/) — *Visit here to use the app!*
> - **⚙️ Backend API**: [https://get-your-mapp.vercel.app/](https://get-your-mapp.vercel.app/) — *Our high-speed Node.js analysis engine.*

---

## 📰 Latest News & Updates

- **Native Tree-Sitter Integration:** We completely removed the WASM-based code parsers. The backend now dynamically compiles and uses blazing fast, native `C/C++` Tree-Sitter binaries for almost a dozen languages (including TypeScript, Python, Dart, Rust, Go, C++, etc.). 
- **Advanced Flow-Control Metrics:** The code analysis engine has been upgraded to track complex logic elements deeply. We now accurately count application loops (`for`, `while`) and branching conditionals (`if`, `switch`).
- **AI-Powered Code Review Context:** Ollama AI integrations now get fed the exact loop and condition ratios of a codebase to give extremely accurate feedback regarding "Heavily Nested Logic" versus "Clean Logic," affecting your final repo quality score!
- **Strict Typing:** Completely refactored our frontend to use strict interfaces mapped directly to our GitHub endpoint returns.

## 🚀 Key Features

- **GitHub Profile Search**: Enter any GitHub username to fetch their profile details, top languages, and repositories in a stunning interface.
- **Repository Listing**: View a sortable list of repositories with stats like stars, forks, and last updated times.
- **Code Quality Analysis**: Analyze individual repositories with a single click.
  - Generates a **Quality Score** (0-100).
  - Determines the **Development Level** (Beginner, Intermediate, Advanced).
  - Calculates **Complexity Metrics** (Cyclomatic Complexity, Functions, Classes, **Loops**, **Conditions**).
  - Displays **Line Counts** (Code, Comments, Blank).
  - Verifies presence of **Tests, CI/CD, TypeScript, and Docker**.
- **AI-Powered Insights**: Uses a local Ollama model to generate customized, text-based insights and recommendations based on the repo's structure and complexity.
- **GitHub Rate Limit Tracking**: Live component to track your GitHub API limits and usage in real time.

## 🔮 Future / Next Steps

1. **AI Career Roadmap Generation**: We will use the parsed code quality metrics not just to score a repository, but to automatically generate a multi-week *Learning Roadmap* customized to a user's specific target job role!
2. **Text / Markdown AI Parsing**: Currently, we exclude `.md` and `.txt` files from standard code quality checks. Next, we will pipe these directly into the LLMs to analyze code documentation quality.
3. **Repository Caching**: Implement aggressive Redis caching on the backend so popular repositories like `react` or `linux` load their Tree-Sitter AST results instantly.

## 🛠️ Tech Stack

- **Frontend**: [Next.js](https://nextjs.org) (App Router), Tailwind CSS, React Hooks, TypeScript, Geist Fonts
- **Backend**: Express.js, TypeScript, Native C++ `tree-sitter` bindings
- **AI Integration**: Custom prompt engineering via Ollama

## 🏃 Running Locally

### Prerequisites

You need to have the backend server running concurrently on port `4000`. Ensure you have Node.js and npm installed. Check the `server/` directory for backend instructions.

### Installation

1. Navigate to the client directory and install dependencies:

```bash
cd client
npm install
```

### Running the Development Server

Start the React development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the running application!

## 📁 Project Structure

- `src/app`: Contains Next.js routes and layouts.
- `src/components`: Contains reusable UI components like `ProfileCard`, `RepoList`, `RepoItem`, `SearchForm`, and `RateLimitDisplay`.
- `src/types`: Contains modular TypeScript definitions cleanly separated into domain representations (`github.ts`, `api.ts`, `analysis.ts`).
- `src/app/api/...`: Next.js Route Handlers to securely communicate with the main backend.
