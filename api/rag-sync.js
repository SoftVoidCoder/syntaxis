// RAG Sync API — Upload text chunks to Firestore + PDFs to Storage
// No embeddings — keyword search via knowledge-search.js
// Protected by RAG_SYNC_TOKEN header

import { initFirebase } from './db.js';

let db;
let bucket;

const COLLECTION = 'korda_knowledge_vectors';
const FILE_DIR_COLLECTION = 'korda_file_directory';
const VERSION = 'v9-file-dir';
const RAG_SYNC_TOKEN = process.env.RAG_SYNC_TOKEN || 'korda-rag-sync-2026';

// Common path segments to exclude from keywords
const PATH_NOISE = new Set(['shares', 'openfolders', 'рабочие', 'папки', 'отдел', 'промышленного', 'пошива', 'база', 'лекал', 'new', 'base', 'расчеты']);

function extractPathKeywords(filePath, filename) {
    const fullStr = `${filePath || ''} ${filename || ''}`;
    return [...new Set(
        fullStr.toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2 && !PATH_NOISE.has(w))
    )].slice(0, 150);
}

async function getDb() {
    if (!db) {
        const { getFirestore } = await import('firebase-admin/firestore');
        initFirebase();
        db = getFirestore();
    }
    return db;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // --- GET: Health check ---
    if (req.method === 'GET') {
        return res.status(200).json({ version: VERSION, status: 'ok' });
    }

    // Auth check
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (token !== RAG_SYNC_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // --- POST: Upload text chunks to Firestore ---
    if (req.method === 'POST') {
        const { chunks, fileId, filename, filePath, fileType, fileHash, storagePath } = req.body;

        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return res.status(400).json({ error: 'Missing or empty chunks array' });
        }
        if (!fileId || !filename) {
            return res.status(400).json({ error: 'Missing fileId or filename' });
        }

        try {
            const firestore = await getDb();
            console.log(`[RAG Sync] Uploading ${chunks.length} chunks for "${filename}"`);

            let uploaded = 0;
            
            for (let bStart = 0; bStart < chunks.length; bStart += 400) {
                const batch = firestore.batch();
                const bEnd = Math.min(bStart + 400, chunks.length);
                
                for (let i = bStart; i < bEnd; i++) {
                    const docId = `${fileId}_chunk_${i}`;
                    const docRef = firestore.collection(COLLECTION).doc(docId);
                    
                    // Extract keywords for search optimization
                    const text = chunks[i] || '';
                    const keywords = [...new Set(
                        text.toLowerCase()
                            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                            .split(/\s+/)
                            .filter(w => w.length > 2)
                    )].slice(0, 200); // Max 200 keywords per chunk
                    
                    batch.set(docRef, {
                        fileId,
                        fileHash: fileHash || '',
                        filename,
                        original_server_path: filePath || '',
                        original_folder_path: filePath 
                            ? (filePath.substring(0, filePath.lastIndexOf('\\')) || filePath.substring(0, filePath.lastIndexOf('/'))) 
                            : '',
                        file_type: fileType || '',
                        chunk_index: i,
                        text: chunks[i],
                        keywords,
                        storage_path: storagePath || '',
                        indexed_at: new Date().toISOString()
                    });
                    uploaded++;
                }
                
                await batch.commit();
            }

            // Auto-create file directory entry (lightweight, for path/name search)
            try {
                const pathKeywords = extractPathKeywords(filePath, filename);
                await firestore.collection(FILE_DIR_COLLECTION).doc(fileId).set({
                    fileId,
                    fileHash: fileHash || '',
                    filename,
                    original_server_path: filePath || '',
                    file_type: fileType || '',
                    path_keywords: pathKeywords,
                    total_chunks: chunks.length,
                    indexed_at: new Date().toISOString()
                });
            } catch (dirErr) {
                console.warn('[RAG Sync] File directory entry failed:', dirErr.message);
            }
            
            console.log(`[RAG Sync] ✅ ${uploaded} chunks for "${filename}"`);
            return res.status(200).json({ success: true, uploaded, version: VERSION });

        } catch (error) {
            console.error('[RAG Sync] Error:', error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    // --- PATCH: Batch upload (multiple files at once) ---
    if (req.method === 'PATCH') {
        const { files } = req.body;
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ error: 'Missing files array' });
        }

        try {
            const firestore = await getDb();
            let totalUploaded = 0;
            const results = [];

            // Collect all docs to write
            const allDocs = [];
            for (const file of files) {
                const { chunks, fileId, filename, filePath, fileType, fileHash } = file;
                if (!chunks || !fileId || !filename) continue;

                for (let i = 0; i < chunks.length; i++) {
                    const text = chunks[i] || '';
                    const keywords = [...new Set(
                        text.toLowerCase()
                            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
                            .split(/\s+/)
                            .filter(w => w.length > 2)
                    )].slice(0, 200);

                    allDocs.push({
                        docId: `${fileId}_chunk_${i}`,
                        data: {
                            fileId,
                            fileHash: fileHash || '',
                            filename,
                            original_server_path: filePath || '',
                            original_folder_path: filePath 
                                ? (filePath.substring(0, filePath.lastIndexOf('\\')) || filePath.substring(0, filePath.lastIndexOf('/'))) 
                                : '',
                            file_type: fileType || '',
                            chunk_index: i,
                            text,
                            keywords,
                            storage_path: '',
                            indexed_at: new Date().toISOString()
                        }
                    });
                }
                results.push({ fileId, chunks: chunks.length });
            }

            // Write all in Firestore batches of 400
            for (let i = 0; i < allDocs.length; i += 400) {
                const batch = firestore.batch();
                const slice = allDocs.slice(i, i + 400);
                for (const { docId, data } of slice) {
                    batch.set(firestore.collection(COLLECTION).doc(docId), data);
                }
                await batch.commit();
                totalUploaded += slice.length;
            }

            console.log(`[RAG Sync] ⚡ Batch: ${files.length} files, ${totalUploaded} total chunks`);
            return res.status(200).json({ success: true, uploaded: totalUploaded, files: results });

        } catch (error) {
            console.error('[RAG Sync] Batch error:', error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    // --- DELETE: Remove chunks + Storage file for a file ---
    if (req.method === 'DELETE') {
        const { fileId } = req.body;
        if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

        try {
            const firestore = await getDb();
            const snapshot = await firestore.collection(COLLECTION).where('fileId', '==', fileId).get();

            // Also delete from file directory
            try {
                await firestore.collection(FILE_DIR_COLLECTION).doc(fileId).delete();
            } catch (e) { /* ignore if doesn't exist */ }

            if (snapshot.empty) {
                console.log(`[RAG Sync] DELETE: No chunks found for ${fileId}`);
                return res.status(200).json({ success: true, deleted: 0 });
            }

            // Collect unique storage_paths to delete from Storage
            const storagePaths = new Set();
            snapshot.docs.forEach(doc => {
                const sp = doc.data().storage_path;
                if (sp) storagePaths.add(sp);
            });

            // Delete chunks from Firestore
            let deleted = 0;
            const docs = snapshot.docs;
            for (let i = 0; i < docs.length; i += 400) {
                const batch = firestore.batch();
                docs.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                deleted += Math.min(400, docs.length - i);
            }

            // Delete PDF files from Storage
            let storageDeleted = 0;
            if (storagePaths.size > 0) {
                try {
                    const { getStorage } = await import('firebase-admin/storage');
                    const bucket = getStorage().bucket('korda-syntax.firebasestorage.app');
                    for (const sp of storagePaths) {
                        try {
                            await bucket.file(sp).delete();
                            storageDeleted++;
                            console.log(`[RAG Sync] 🗑 Storage: ${sp}`);
                        } catch (e) {
                            // File might not exist in storage (ghost files)
                            console.log(`[RAG Sync] Storage skip: ${sp} (${e.message})`);
                        }
                    }
                } catch (e) {
                    console.error('[RAG Sync] Storage cleanup error:', e.message);
                }
            }

            console.log(`[RAG Sync] 🗑 Deleted ${deleted} chunks + ${storageDeleted} storage files for ${fileId}`);
            return res.status(200).json({ success: true, deleted, storageDeleted });
        } catch (error) {
            console.error('[RAG Sync] DELETE error:', error.message);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
