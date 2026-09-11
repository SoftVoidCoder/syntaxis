// RAG Upload API — Upload PDF files to Firebase Storage
// Protected by RAG_SYNC_TOKEN header

import { initFirebase } from './db.js';

let bucket;

const RAG_SYNC_TOKEN = process.env.RAG_SYNC_TOKEN || 'korda-rag-sync-2026';

async function getBucket() {
    if (!bucket) {
        const { getStorage } = await import('firebase-admin/storage');
        initFirebase();
        bucket = getStorage().bucket('korda-syntax.firebasestorage.app');
    }
    return bucket;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        return res.status(200).json({ status: 'ok', endpoint: 'rag-upload' });
    }

    // Auth check
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token !== RAG_SYNC_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // --- POST: Upload base64 file to Firebase Storage ---
    if (req.method === 'POST') {
        const { fileData, storagePath, contentType } = req.body;

        if (!fileData || !storagePath) {
            return res.status(400).json({ error: 'Missing fileData or storagePath' });
        }

        try {
            const storage = await getBucket();
            const buffer = Buffer.from(fileData, 'base64');
            const file = storage.file(storagePath);

            await file.save(buffer, {
                metadata: {
                    contentType: contentType || 'application/pdf',
                    metadata: {
                        uploadedBy: 'rag_studio',
                        uploadedAt: new Date().toISOString()
                    }
                }
            });

            // Make file publicly readable so download links work
            await file.makePublic();

            console.log(`[RAG Upload] ✅ ${storagePath} (${(buffer.length / 1024).toFixed(0)} KB)`);
            return res.status(200).json({ success: true, path: storagePath, size: buffer.length });

        } catch (error) {
            console.error('[RAG Upload] Error:', error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
