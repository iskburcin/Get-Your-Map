# 🌐 Get-Your-Map Frontend UI

The **Get-Your-Map Frontend** is a modern, responsive user interface built with the latest **Next.js** App Router and **Tailwind CSS**. It provides a smooth and interactive experience for exploring GitHub users and their repositories.

## ✨ Key Features

- **GitHub Profile Explorer**: Search for any GitHub username to fetch profile details, top languages, and public repositories with a clean, centered interface.
- **Repository List**: Detailed repository listing with star counts, forks, and last update times.
- **Code Quality Dashboard**: Visualize the complexity of any repository with a single click.
  - Interactive quality scores (0-100).
  - Metrics for classes, functions, **loops**, and **conditionals**.
  - AI-powered code reviews and insights.
- **Dark Mode Support**: Beautifully themed for both day and night use.
- **Next.js API Routes**: Acts as a secure proxy to the main backend server for GitHub and AI analysis.

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Version 4.0)
- **Language**: TypeScript
- **State Management**: React Hooks & Context API

## 🏃 Local Setup

### 1. Prerequisites
- **Node.js 18+**
- **npm** (Standard package manager)
- **Backend Running**: Ensure you have the [backend](../server) running on `http://localhost:4000`.

### 2. Installation
```bash
cd client
npm install
```

### 3. Running the App
```bash
# Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to start using the application!

## 📁 Directory Structure

- `src/app`: Next.js routes and application layouts.
- `src/components`: Modular UI components (ProfileCard, RepoList, SearchForm, etc.).
- `src/types`: Domain-specific TypeScript interfaces.
- `src/styles`: Tailwind configuration and global styles.

---
For backend/API details, please refer to the [`/server`](../server) documentation.
