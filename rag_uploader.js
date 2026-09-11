import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Firebase Admin + Storage Init
// ============================================================
let bucket;

async function initFirebase() {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getStorage } = await import('firebase-admin/storage');

    if (getApps().length === 0) {
        const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountJSON) {
            console.error("FATAL: Missing FIREBASE_SERVICE_ACCOUNT in .env");
            process.exit(1);
        }
        initializeApp({
            credential: cert(JSON.parse(serviceAccountJSON)),
            storageBucket: 'korda-syntax.firebasestorage.app'
        });
    }

    bucket = getStorage().bucket();
    console.log("[OK] Firebase Storage connected.");
}

// ============================================================
// Upload a single PDF file to Storage
// ============================================================
async function uploadFile(localPath, storagePath) {
    try {
        await bucket.upload(localPath, {
            destination: storagePath,
            metadata: {
                contentType: 'application/pdf',
                metadata: {
                    uploadedBy: 'rag_uploader',
                    uploadedAt: new Date().toISOString()
                }
            }
        });
        return { status: 'ok', path: storagePath };
    } catch (e) {
        return { status: 'error', path: storagePath, error: e.message };
    }
}

// ============================================================
// Scan directory for PDFs and upload in parallel batches
// ============================================================
async function uploadAllPDFs(sourceDir, storagePrefix = 'project_docs') {
    await initFirebase();

    console.log(`\nScanning for PDFs in ${sourceDir}...`);
    const pdfQueue = [];

    function findPDFs(dir) {
        for (const file of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                findPDFs(fullPath);
            } else if (file.toLowerCase().endsWith('.pdf')) {
                // Preserve directory structure relative to sourceDir
                const relativePath = path.relative(sourceDir, fullPath).replace(/\\/g, '/');
                pdfQueue.push({
                    localPath: fullPath,
                    storagePath: `${storagePrefix}/${relativePath}`
                });
            }
        }
    }

    findPDFs(sourceDir);
    console.log(`Found ${pdfQueue.length} PDF files to upload.\n`);

    const startTime = Date.now();
    let uploaded = 0;
    let errors = 0;

    // Upload in parallel batches of 10
    const PARALLEL = 10;

    for (let i = 0; i < pdfQueue.length; i += PARALLEL) {
        const batch = pdfQueue.slice(i, i + PARALLEL);
        const results = await Promise.all(
            batch.map(f => uploadFile(f.localPath, f.storagePath))
        );

        for (const r of results) {
            if (r.status === 'ok') {
                uploaded++;
            } else {
                errors++;
                console.error(`\n[ERROR] ${r.path}: ${r.error}`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const progress = Math.min(i + PARALLEL, pdfQueue.length);
        process.stdout.write(`\r[UPLOAD] ${progress}/${pdfQueue.length} files | ${uploaded} uploaded | ${errors} errors | ${elapsed}s`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n========================================`);
    console.log(`UPLOAD COMPLETE`);
    console.log(`Uploaded: ${uploaded} PDFs`);
    console.log(`Errors: ${errors}`);
    console.log(`Total time: ${totalTime}s`);
    console.log(`Bucket: korda-syntax.firebasestorage.app`);
    console.log(`========================================`);
}

// ============================================================
// CLI
// ============================================================
const targetPath = process.argv[2];
if (!targetPath) {
    console.error("Usage: node rag_uploader.js <path_to_pdf_output_directory>");
    process.exit(1);
}

uploadAllPDFs(path.resolve(targetPath));
