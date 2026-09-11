import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import dbHandler from './api/db.js';
import proxyHandler from './api/proxy.js';
import checkoHandler from './api/checko.js';
import checkoDeepHandler from './api/checko-deep.js';
import tendersHandler from './api/tenders.js';
import knowledgeSearchHandler from './api/knowledge-search.js';
import ragSyncHandler from './api/rag-sync.js';
import ragUploadHandler from './api/rag-upload.js';
import ragDownloadHandler from './api/rag-download.js';
import mathSyncHandler from './api/mathSync.js';
import exportDocxHandler from './api/export-docx.js';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression()); // Gzip all responses (critical for JS bundle size)
app.use(cors());
app.use(express.json({ limit: '50mb' })); // RESTORED: Critical for API body parsing

// Request Logger (Debug Health Checks)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[Request] ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Health Check (Critical for Container/Cloud Hosting)
app.get('/health', (req, res) => res.status(200).send('OK'));

// Graceful Shutdown Handler
const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Static Files (Serve the built React app)
app.use(express.static(path.join(__dirname, 'dist')));

// API Routes (Adapter for Vercel-style handlers)
const adaptHandler = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (err) {
        console.error("API Error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
};

// import dbHandler from './api/db.js'; // Already imported at top
// import proxyHandler from './api/proxy.js'; // Already imported at top

app.all('/api/db', adaptHandler(dbHandler));
app.all('/api/proxy', adaptHandler(proxyHandler));
app.all('/api/checko', adaptHandler(checkoHandler));
app.all('/api/checko-deep', adaptHandler(checkoDeepHandler));
app.all('/api/tenders', adaptHandler(tendersHandler));
app.all('/api/knowledge-search', adaptHandler(knowledgeSearchHandler));
app.all('/api/rag-sync', adaptHandler(ragSyncHandler));
app.all('/api/rag-upload', adaptHandler(ragUploadHandler));
app.all('/api/rag-download', adaptHandler(ragDownloadHandler));
app.all('/api/math-sync', adaptHandler(mathSyncHandler));
app.all('/api/export-docx', adaptHandler(exportDocxHandler));

// SPA Fallback (Safe Wrapper)
app.get(/.*/, (req, res) => {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error("SPA Fallback Error (Missing dist?):", err);
            if (!res.headersSent) res.status(404).send("Application Loading...");
        }
    });
});

import { startCronService } from './api/cronService.js';
import { initFirebase } from './api/db.js';

// Enable Proxy Trust (for correct IP/Protocol detection behind Railway LB)
app.enable('trust proxy');

// Listen on default dual-stack (IPv4 + IPv6)
const server = app.listen(PORT, async () => {
    const addr = server.address();
    console.log(`Server running on ${JSON.stringify(addr)}`);
    console.log(`[Startup] PORT env: ${process.env.PORT}, Actual: ${PORT}`);

    // Initialize Firebase Admin (Lazy but pre-warmed)
    try {
        await initFirebase();
    } catch (e) {
        console.error("Startup Warning: Firebase init failed:", e);
    }

    // Initialize Scheduled Jobs (Activity Reporting)
    try {
        startCronService();
        console.log("[CRON] Service started.");
    } catch (err) {
        console.error("[CRON] Failed to start service:", err);
    }
});

// Manual Report Trigger Endpoint
import { generateDailyReports } from './api/cronService.js';
app.post('/api/force-report', async (req, res) => {
    console.log("[API] Manual Report Generation Triggered");
    try {
        await generateDailyReports();
        res.json({ success: true, message: "Reports generated successfully" });
    } catch (err) {
        console.error("[API] Force Report Failed:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Tuning for Load Balancers (Railway/AWS/GCP often need > 60s)
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
