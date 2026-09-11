import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// DIRECT Firebase Admin SDK (No HTTP proxy overhead!)
// ============================================================
let db;

async function initFirebase() {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
        const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountJSON) {
            console.error("FATAL: Missing FIREBASE_SERVICE_ACCOUNT in .env");
            process.exit(1);
        }
        initializeApp({ credential: cert(JSON.parse(serviceAccountJSON)) });
    }

    db = getFirestore();
    console.log("[OK] Firebase Admin connected directly (no proxy).");
}

const COLLECTION_NAME = 'korda_knowledge_vectors';

// ============================================================
// BATCH WRITER — writes up to 500 docs per Firestore commit
// ============================================================
async function batchInsert(documents) {
    const BATCH_SIZE = 450; // Firestore max is 500, leave margin
    let written = 0;

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const slice = documents.slice(i, i + BATCH_SIZE);

        for (const doc of slice) {
            const ref = db.collection(COLLECTION_NAME).doc(doc.id);
            batch.set(ref, doc.data);
        }

        await batch.commit();
        written += slice.length;
        process.stdout.write(`\r  [DB] Written ${written}/${documents.length} chunks`);
    }

    return written;
}

// ============================================================
// Process a single _meta.json — no delay, no HTTP, pure batch
// ============================================================
async function indexFile(metaFilePath) {
    try {
        const raw = fs.readFileSync(metaFilePath, 'utf-8');
        const metaData = JSON.parse(raw);
        const { chunks, original_server_path, original_folder_path, filename, file_type, processed_at } = metaData;

        if (!chunks || chunks.length === 0) {
            return { filename, status: 'skip', count: 0 };
        }

        const fileHash = crypto.createHash('sha256')
            .update(original_server_path)
            .digest('hex')
            .substring(0, 16);

        // Prepare all documents in memory (no network calls yet)
        const documents = chunks.map((chunkText, i) => ({
            id: `${fileHash}_chunk_${i}`,
            data: {
                fileId: fileHash,
                filename,
                original_server_path,
                original_folder_path,
                file_type,
                processed_at,
                chunk_index: i,
                text: chunkText,
                // Mock embedding vector — будет заменен на реальный при интеграции Gemini Embedding API
                embedding: [] // Пустой пока — заполним позже через отдельный скрипт
            }
        }));

        // Single batch commit for the entire file
        const written = await batchInsert(documents);
        return { filename, status: 'ok', count: written };

    } catch (e) {
        console.error(`\n[ERROR] ${metaFilePath}: ${e.message}`);
        return { filename: metaFilePath, status: 'error', count: 0 };
    }
}

// ============================================================
// Main: Crawl and Index
// ============================================================
async function crawlAndIndex(directoryPath) {
    await initFirebase();

    console.log(`\nScanning for _meta.json in ${directoryPath}...`);
    const indexQueue = [];

    function findMetaFiles(dir) {
        for (const file of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                findMetaFiles(fullPath);
            } else if (file.endsWith('_meta.json')) {
                indexQueue.push(fullPath);
            }
        }
    }

    findMetaFiles(directoryPath);
    console.log(`Found ${indexQueue.length} metadata files to index.\n`);

    const startTime = Date.now();
    let totalChunks = 0;
    let successFiles = 0;
    let skipFiles = 0;
    let errorFiles = 0;

    // Process files in parallel batches of 5 (avoid overwhelming Firestore)
    const PARALLEL = 5;
    for (let i = 0; i < indexQueue.length; i += PARALLEL) {
        const batch = indexQueue.slice(i, i + PARALLEL);
        const results = await Promise.all(batch.map(f => indexFile(f)));

        for (const r of results) {
            if (r.status === 'ok') {
                successFiles++;
                totalChunks += r.count;
                console.log(`\n[OK] ${r.filename} — ${r.count} chunks`);
            } else if (r.status === 'skip') {
                skipFiles++;
            } else {
                errorFiles++;
            }
        }

        // Progress summary every batch
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const progress = Math.min(i + PARALLEL, indexQueue.length);
        console.log(`--- Progress: ${progress}/${indexQueue.length} files | ${totalChunks} chunks | ${elapsed}s ---`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n========================================`);
    console.log(`INDEXING COMPLETE`);
    console.log(`Files: ${successFiles} indexed, ${skipFiles} skipped, ${errorFiles} errors`);
    console.log(`Total chunks written: ${totalChunks}`);
    console.log(`Total time: ${totalTime}s`);
    console.log(`========================================`);
}

// ============================================================
// CLI Entry
// ============================================================
const targetPath = process.argv[2];
if (!targetPath) {
    console.error("Usage: node rag_indexer.js <path_to_pdf_output_directory>");
    process.exit(1);
}

crawlAndIndex(path.resolve(targetPath));
