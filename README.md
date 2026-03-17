# 🗺️ Get-Your-Map

**Get-Your-Map** is a modern, AI-powered GitHub exploration and code quality analysis platform. It allows users to search for GitHub profiles, explore repositories, and perform deep code analysis using native Tree-sitter bindings and local LLMs (Ollama).

## 🚀 Overview

This project is split into two main parts:
- **Frontend**: A sleek, responsive Next.js application.
- **Backend**: A high-performance Express.js server with a native code analysis engine.

## 📁 Repository Structure

| Directory | Description |
| :--- | :--- |
| [`/client`](./client) | Next.js Frontend (React, Tailwind CSS, TypeScript) |
| [`/server`](./server) | Node.js Backend (Express, Native Tree-sitter, Ollama API) |

## ✨ Key Features

- **GitHub Profile Search**: Beautifully formatted profile data and repository lists.
- **Deep Code Analysis**: Native C++ bindings for Tree-sitter provide blazing-fast AST parsing for a dozen languages.
- **Complexity Metrics**: Tracks loops, branching, functions, and classes to calculate a cyclomatic-style complexity score.
- **AI Insights**: Integrated with local Ollama models (like `llama3.1` or `qwen2.5`) to provide human-readable code reviews.
- **Real-time Monitoring**: Track GitHub API rate limits directly from the UI.

## 🛠️ Quick Start (Local Setup)

To run the full application locally, you need to start both the server and the client.

### 1. Backend Setup
```bash
cd server
npm install
# Configure your .env (see server/README.md)
npm run dev
```

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app!

## 🌐 Live Deployments

- **🌐 Live App**: [https://get-your-map.vercel.app/](https://get-your-map.vercel.app/)
- **⚙️ Backend API**: [https://get-your-map.onrender.com/](https://get-your-map.onrender.com/)

---
For detailed documentation, please refer to the README files in the respective directories.
