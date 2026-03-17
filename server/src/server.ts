import "dotenv/config";
import express from "express";
import analysisRoutes from "./routes/analysis.routes";

/**
 * Express application
 */
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 4000;
const backend = process.env.BACKEND_BASE_URL || "http://localhost";

app.get("/", (_req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Info Backend Server</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background-color: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem;}
        .card { background: white; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); max-width: 500px; width: 100%; text-align: center; border: 1px solid #f1f5f9; }
        h1 { margin-top: 0; color: #ea580c; font-size: 2rem; font-weight: 800; letter-spacing: -0.025em; }
        p { color: #64748b; line-height: 1.6; font-size: 1.05rem; }
        a { color: #ea580c; font-weight: 700; text-decoration: none; transition: color 0.15s ease-in-out; }
        a:hover { color: #c2410c; text-decoration: underline; }
        .status { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.375rem 1rem; background-color: #dcfce7; color: #166534; border-radius: 9999px; font-weight: 700; font-size: 0.875rem; margin-top: 1.5rem; margin-bottom: 2rem; border: 1px solid #bbf7d0; }
        .status::before { content: ""; display: block; width: 8px; height: 8px; background-color: #22c55e; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
        .footer { margin-top: 2rem; text-align: left; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; }
        .footer-item { margin: 0.75rem 0; font-size: 0.95rem; display: flex; align-items: center; justify-content: space-between; }
        .footer-label { font-weight: 600; color: #334155; }
        .btn { display: inline-block; padding: 0.5rem 1rem; background: #ea580c; color: white !important; border-radius: 0.5rem; text-decoration: none; font-weight: 600; transition: background 0.2s; }
        .btn:hover { background: #c2410c; text-decoration: none; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🚀 Backend Online</h1>
        <p>The <strong>GitHub Info API</strong> server is actively running and ready to process incoming requests.</p>
        
        <div class="status">All Systems Operational</div>
        
        <div class="footer">
            <div class="footer-item">
                <span class="footer-label">Client UI:</span>
                <a href="https://get-your-map.vercel.app/" target="_blank" class="btn">Launch App &rarr;</a>
            </div>
            <div class="footer-item">
                <span class="footer-label">Health Check:</span>
                <a href="/health">/health</a>
            </div>
            <div class="footer-item">
                <span class="footer-label">GitHub Source:</span>
                <a href="https://github.com/iskburcin/Get-Your-Map" target="_blank">View Repo</a>
            </div>
        </div>
    </div>
</body>
</html>
    `);
});

app.use("/", analysisRoutes);

/**
 * Start server (only locally, not on Vercel)
 */
// For Render or other standard cloud hosting, always start the server
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Health check: /health`);
    });
}

// Export the Express app for Vercel serverless functions
export default app;