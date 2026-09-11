
// Knowledge Search API — searches Firestore 'korda_knowledge_vectors' + 'korda_file_directory'
// Dual search: text chunks + file/folder names
import { initFirebase } from './db.js';

let db;

async function getDb() {
    if (!db) {
        const { getFirestore } = await import('firebase-admin/firestore');
        initFirebase();
        db = getFirestore();
    }
    return db;
}

const CHUNKS_COLLECTION = 'korda_knowledge_vectors';
const FILES_COLLECTION = 'korda_file_directory';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { query, limit = 15, maxPerFile = 3 } = req.body;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing "query" in request body' });
    }

    try {
        const firestore = await getDb();

        // Extract single words for Firestore array-contains-any (max 10)
        const singleWords = query.toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2);

        if (singleWords.length === 0) {
            return res.status(200).json({ results: [], message: 'Query too short' });
        }

        const searchKeywords = singleWords.slice(0, 10);

        // Determine terms for scoring: comma-separated phrases OR single words
        // We preserve dashes, dots, underscores, slashes for scoring so exact part numbers match
        let scoringTerms = [];
        if (query.includes(',')) {
            scoringTerms = query.toLowerCase().split(',')
                .map(p => p.trim().replace(/[^\p{L}\p{N}\s\-._/]/gu, ' ').replace(/\s+/g, ' '))
                .filter(p => p.length >= 2);
            if (scoringTerms.length === 0) scoringTerms = singleWords; // fallback
        } else {
            // Keep the query as a single phrase with hyphens, and also add individual words
            const rawWords = query.toLowerCase()
                .replace(/[^\p{L}\p{N}\s\-._/]/gu, ' ')
                .split(/\s+/)
                .filter(w => w.length >= 2);
            scoringTerms = [...new Set([query.toLowerCase().trim(), ...rawWords, ...singleWords])];
        }

        // ===== DUAL SEARCH: chunks + file directory (parallel) =====
        const [chunkResults, fileResults] = await Promise.all([
            // Search 1: Text chunks (existing behavior)
            searchChunks(firestore, searchKeywords, scoringTerms, maxPerFile),
            // Search 2: File/folder names (NEW)
            searchFileDirectory(firestore, searchKeywords, scoringTerms)
        ]);

        // Merge: file directory results get their chunks loaded
        const allResults = new Map();

        // Add chunk results first
        for (const r of chunkResults) {
            allResults.set(r.id, r);
        }

        // Boost scores of chunk results that also match file directory (path + text = high relevance)
        const fileIdSet = new Set(fileResults.map(f => f.fileId));
        if (fileIdSet.size > 0) {
            for (const [id, r] of allResults) {
                if (fileIdSet.has(r.fileId)) {
                    r.score += 50; // Chunk belongs to a file found by path — boost it
                    r.found_by = 'text+path';
                }
            }
        }

        // For file directory hits NOT already in chunk results, load their chunks
        if (fileResults.length > 0) {
            const fileIdsToLoad = fileResults
                .filter(f => !chunkResults.some(c => c.fileId === f.fileId))
                .slice(0, 10); // Max 10 new files from directory search

            for (const fileHit of fileIdsToLoad) {
                try {
                    const chunkSnap = await firestore.collection(CHUNKS_COLLECTION)
                        .where('fileId', '==', fileHit.fileId)
                        .limit(maxPerFile)
                        .get();

                    chunkSnap.forEach(doc => {
                        if (!allResults.has(doc.id)) {
                            const data = doc.data();
                            allResults.set(doc.id, {
                                id: doc.id,
                                score: fileHit.score + 50, // Strong boost: found by path/filename
                                fileId: data.fileId || '',
                                filename: data.filename,
                                original_server_path: data.original_server_path,
                                original_folder_path: data.original_folder_path,
                                file_type: data.file_type,
                                chunk_index: data.chunk_index,
                                text: data.text?.substring(0, 600),
                                found_by: 'path'
                            });
                        }
                    });
                } catch (e) {
                    console.warn(`[Knowledge Search] Failed to load chunks for ${fileHit.fileId}:`, e.message);
                }
            }

            // Also add file-level results (even if no chunks — shows that the file exists)
            for (const f of fileResults) {
                const dirId = `dir_${f.fileId}`;
                if (!allResults.has(dirId) && !chunkResults.some(c => c.fileId === f.fileId)) {
                    allResults.set(dirId, {
                        id: dirId,
                        score: f.score + 50,
                        fileId: f.fileId,
                        filename: f.filename,
                        original_server_path: f.original_server_path,
                        file_type: f.file_type,
                        chunk_index: -1,
                        text: `[Файл найден по имени/пути: ${f.filename}]`,
                        found_by: 'path'
                    });
                }
            }
        }

        // Sort by score, dedup by file
        const sorted = [...allResults.values()]
            .sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index);

        const fileChunkCount = new Map();
        const deduped = [];
        for (const item of sorted) {
            const key = item.fileId || item.filename;
            const count = fileChunkCount.get(key) || 0;
            if (count < maxPerFile) {
                deduped.push(item);
                fileChunkCount.set(key, count + 1);
            }
        }

        const results = deduped.slice(0, limit);

        console.log(`[Knowledge Search] Query: "${query}" → ${results.length} results (${chunkResults.length} from text, ${fileResults.length} from paths)`);

        res.status(200).json({
            results,
            total_chunk_matches: chunkResults.length,
            total_file_matches: fileResults.length,
            keywords_used: scoringTerms
        });

    } catch (error) {
        console.error('[Knowledge Search] Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ===== Search text chunks =====
async function searchChunks(firestore, searchKeywords, allKeywords, maxPerFile) {
    let snapshot;
    try {
        snapshot = await firestore.collection(CHUNKS_COLLECTION)
            .where('keywords', 'array-contains-any', searchKeywords)
            .limit(1000)
            .get();
    } catch (e) {
        console.log('[Knowledge Search] array-contains-any failed, falling back to full scan');
        snapshot = await firestore.collection(CHUNKS_COLLECTION)
            .limit(2000)
            .get();
    }

    const scored = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const text = (data.text || '').toLowerCase();
        const filename = (data.filename || '').toLowerCase();

        let score = 0;
        for (const kw of allKeywords) {
            // JavaScript \b fails for Cyrillic characters. Use Unicode properties for word boundaries.
            const wordRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu');
            if (wordRegex.test(text)) {
                score += 3;
            } else if (text.includes(kw)) {
                score += 1;
            }
            if (filename.includes(kw)) score += 3;
        }

        if (score > 0) {
            scored.push({
                id: doc.id,
                score,
                fileId: data.fileId || '',
                filename: data.filename,
                original_server_path: data.original_server_path,
                original_folder_path: data.original_folder_path,
                file_type: data.file_type,
                chunk_index: data.chunk_index,
                text: data.text?.substring(0, 600),
                found_by: 'text'
            });
        }
    });

    scored.sort((a, b) => b.score - a.score || a.chunk_index - b.chunk_index);
    return scored;
}

// ===== Search file directory (by filename + path) =====
async function searchFileDirectory(firestore, searchKeywords, allKeywords) {
    try {
        const snapshot = await firestore.collection(FILES_COLLECTION)
            .where('path_keywords', 'array-contains-any', searchKeywords)
            .limit(200)
            .get();

        const scored = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const filename = (data.filename || '').toLowerCase();
            const path = (data.original_server_path || '').toLowerCase();

            let score = 0;
            for (const kw of allKeywords) {
                if (filename.includes(kw)) score += 5; // Strong: filename match
                else if (path.includes(kw)) score += 3; // Medium: path match
            }

            if (score > 0) {
                scored.push({
                    fileId: data.fileId || doc.id,
                    filename: data.filename,
                    original_server_path: data.original_server_path,
                    file_type: data.file_type,
                    score
                });
            }
        });

        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 30);
    } catch (e) {
        console.warn('[Knowledge Search] File directory search failed:', e.message);
        return [];
    }
}
