# Free Deployment Guide (Next.js + Express + Ollama)

This guide explains what is possible for **$0** hosting and how to avoid breaking your app.

## Reality Check for Ollama in Cloud

- Ollama is designed for local/self-hosted machines.
- Most free cloud hosts (Vercel, Render free tier, GitHub Pages) do **not** provide enough persistent CPU/RAM/GPU for reliable Ollama inference.
- So the practical free architecture is:
  - Frontend on Vercel (free)
  - Backend on Render/Railway/Fly free tier (if available)
  - Ollama on your own always-on machine (or cheap VPS, not free)

## Recommended Free Architecture

1. Deploy `client` to Vercel.
2. Deploy `server` to Render (or another free Node host).
3. Run Ollama on your own machine (home PC or old laptop).
4. Expose Ollama securely to internet using a tunnel (Cloudflare Tunnel or Tailscale Funnel).
5. Set backend env `OLLAMA_URL` to your tunnel URL.

## Docker: Run Full Stack Locally

From project root:

```bash
# 1) Create env file
cp .env.docker.example .env.docker

# 2) Start everything
docker compose --env-file .env.docker up --build
```

App URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000/health`
- Ollama: `http://localhost:11434`

## Remote Ollama Connection

If backend is in cloud and Ollama is at home:

1. Keep Ollama running on your machine:
   ```bash
   ollama serve
   ```
2. Expose `11434` with a secure tunnel provider.
3. Copy the public HTTPS URL from tunnel.
4. In backend host environment variables set:
   - `OLLAMA_URL=https://your-ollama-tunnel-url`
   - `OLLAMA_MODEL=qwen2.5:1.5b` (or your model)
5. Restart backend service.

## Production Env Checklist

### Backend (`server`)

- `PORT=4000` (host usually injects this)
- `GITHUB_TOKEN=...`
- `MONGODB_URI=...` (MongoDB Atlas free tier)
- `MONGODB_DB_NAME=github_info_ui`
- `OLLAMA_URL=https://<your-tunnel-url>`
- `OLLAMA_MODEL=qwen2.5:1.5b`

### Frontend (`client` on Vercel)

- `BACKEND_BASE_URL=https://<your-backend-domain>`

## Reliability Notes (Free Tier)

- Free backends may sleep after inactivity (cold starts).
- Home-hosted Ollama must stay online and connected.
- Large models may be too slow on low-end hardware; prefer smaller models like `qwen2.5:1.5b`.

## Optional Upgrade Path

If you need 24/7 stable speed:

- Move Ollama to a paid GPU server/VPS.
- Or swap Ollama calls with a managed LLM API while keeping your app architecture.
