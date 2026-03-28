# 🚀 Quick Start: MongoDB + File Caching

## Prerequisites

- Node.js 20+
- GitHub Personal Access Token
- MongoDB Atlas account (free tier OK) OR local MongoDB

---

## Step 1: MongoDB Setup (Choose One)

### Option A: MongoDB Atlas (Recommended - Free Tier)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create account → Create organization → Create project
3. Click **"Create Deployment"** → Select **M0 (Free)** tier
4. Choose region (closest to you)
5. **Security > Quick Start**:
   - Create username/password (save these!)
   - Add your IP (or `0.0.0.0/0` for development)
6. **Deployment > Connect**:
   - Select "Drivers"
   - Copy connection string: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`

### Option B: Local MongoDB

```bash
# macOS (via Homebrew)
brew install mongodb-community
brew services start mongodb-community

# Windows (via Chocolatey)
choco install mongodb

# Linux (Ubuntu/Debian)
sudo apt-get install -y mongodb-org
sudo systemctl start mongod

# Connection string
mongodb://127.0.0.1:27017
```

---

## Step 2: Configure Server Environment

Create or update `server/.env`:

```env
# GitHub API
GITHUB_TOKEN=ghp_your_token_here

# Server
PORT=4000
BACKEND_BASE_URL=http://localhost

# MongoDB - Pick one:

# Atlas (Cloud)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=github_info_ui

# OR Local
# MONGODB_URI=mongodb://127.0.0.1:27017
# MONGODB_DB_NAME=github_info_ui

# Ollama (Optional, for AI insights)
OLLAMA_MODEL=qwen2.5:1.5b
```

---

## Step 3: Install & Run Server

```bash
cd server

# Install dependencies
npm install

# Start development server
npm run dev
```

**Expected console output**:

```
MongoDB connection established.
Server listening on port 4000
Health check: /health
```

---

## Step 4: Test File Caching

### Test 1: First Request (Creates Cache)

```bash
curl -X POST http://localhost:4000/api/analysis/torvalds/linux \
  -H "Content-Type: application/json" \
  -d '{"targetRole": "systems engineer"}'
```

**Expected**:

- Takes ~15-30 seconds
- Response includes `"cache": {"status": "miss"}`
- Console shows file fetch and analysis

### Test 2: Second Request (Same Commit = Cache Hit)

```bash
curl -X POST http://localhost:4000/api/analysis/torvalds/linux \
  -H "Content-Type: application/json" \
  -d '{"targetRole": "systems engineer"}'
```

**Expected**:

- Returns instantly (~100ms)
- Response includes `"cache": {"status": "hit"}`
- No file fetch in console

### Test 3: Check MongoDB

```bash
# Install MongoDB CLI (optional)
# brew install mongosh  (macOS)
# choco install mongosh (Windows)

mongosh "mongodb+srv://username:password@cluster.mongodb.net/github_info_ui"

# Then:
db.repo_files_cache.findOne({ owner: "torvalds", repo: "linux" })
# Should show filesTree array with 100 files

db.repo_analysis_cache.findOne()
# Should show cached analysis result
```

---

## Step 5: Run Client

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## What Gets Cached

### ✅ Automatically Cached

- **GitHub Profile**: Username → cached 1st fetch
- **Repo Files**: Full tree (100 source files max)
- **Commit SHAs**: Used as cache keys
- **Analysis Results**: Full code analysis + Ollama response

### ❌ Not Cached (Always Fresh)

- Rate limit checks
- User searches (profiling data)
- Ollama health checks

---

## Monitoring Cache

### View Cache Size (MongoDB)

```javascript
// In mongosh
use github_info_ui

// Count cached repos
db.repo_files_cache.countDocuments()

// Total files cached
db.repo_files_cache.aggregate([
  { $group: { _id: null, total: { $sum: "$totalFiles" } } }
])

// Last sync time per repo
db.repo_files_cache.find({ owner: "torvalds" }, { repo: 1, lastSourceSyncAt: 1 })
```

### Clear Cache (if needed)

```javascript
// Clear one repo
db.repo_files_cache.deleteOne({ owner: "torvalds", repo: "linux" });

// Clear all analysis for user
db.repo_analysis_cache.deleteMany({ owner: "torvalds" });

// Clear everything
db.repo_files_cache.deleteMany({});
db.repo_analysis_cache.deleteMany({});
```

---

## Expected Performance

| Scenario                            | Time      |
| :---------------------------------- | :-------- |
| 1st request (new repo)              | 15-30s    |
| 2nd request (same commit)           | ~100ms ⚡ |
| Changed commit (few files modified) | 8-20s     |

---

## Troubleshooting

### "MongoDB connection failed"

**Check**:

- ✅ Is MongoDB running? (`mongosh` should connect)
- ✅ Is connection string correct? (No typos, password special chars encoded)
- ✅ Is IP whitelisted? (Atlas: Network Access)
- ✅ Is `MONGODB_URI` set in `.env`?

### "Mongoose: illegal use of [Map]" Error

**Fix**: Restart server - mongoose model caching issue

```bash
npm run dev  # Should auto-reload via tsx watch
```

### "Rate limit exceeded from GitHub API"

**Cause**: Too many requests without caching
**Fix**:

- Cache is working! (status should be "hit")
- Increase `GITHUB_TOKEN` scope if needed

### Cache always shows "miss"

**Cause**: Commits keep changing (pushing every request!)
**Check**:

```bash
# Verify commit SHA is stable
curl https://api.github.com/repos/torvalds/linux/branches/main \
  -H "Authorization: token YOUR_GITHUB_TOKEN" | grep '"sha"'

# If different each time = clock skew/API issue
```

---

## Next: Decision Time 🤔

**After testing, decide on analysis strategy**:

### Strategy A: Full Re-analysis (Current - Recommended)

```
When commit changes:
  → Fetch changed files
  → Re-analyze entire repo
  → Cache result
```

**Pros**: Complete accuracy  
**Cons**: Slower for large repos (10-30s)

### Strategy B: Delta Analysis (Advanced - Future)

```
When commit changes:
  → Fetch changed files
  → Analyze ONLY changed files
  → Merge metrics with cached baseline
  → Cache updated metrics
```

**Pros**: Fast (5-10s per change)  
**Cons**: Complex, metric merging logic needed

**Choose A for now**, switch to B if performance becomes issue.

---

## File Structure Reference

After first request, your MongoDB should have:

```
github_info_ui/
├── repo_files_cache
│   └── {
│       owner, repo, commitSha, branch,
│       filesTree: [{ path, content, size }...],
│       totalFiles, lastSourceSyncAt, lastServedAt
│     }
├── repo_analysis_cache
│   └── {
│       owner, repo, targetRole, repoHeadSha,
│       responsePayload: { analysis result },
│       lastSourceSyncAt, lastServedAt
│     }
└── github_profile_cache
    └── {
        username, profile, repos,
        profileHash, reposHash,
        lastSourceSyncAt, lastServedAt
      }
```

---

## Success Criteria ✅

- [ ] Server starts without MongoDB errors
- [ ] First request returns analysis + cache.status="miss"
- [ ] Second request returns cached result + cache.status="hit"
- [ ] MongoDB collections have documents
- [ ] Response time improves dramatically on 2nd request
- [ ] Client UI displays analysis results

---

## Questions?

Refer to:

- [server/README.md](./server/README.md) - API documentation
