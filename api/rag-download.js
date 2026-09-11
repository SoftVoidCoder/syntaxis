// RAG Download API — Generate signed download URLs for Storage files
import { initFirebase } from './db.js';

let bucket;

async function getBucket() {
    if (!bucket) {
        const { getStorage } = await import('firebase-admin/storage');
        initFirebase();
        bucket = getStorage().bucket('korda-syntax.firebasestorage.app');
    }
    return bucket;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    const storagePath = req.query.path;
    if (!storagePath) {
        return res.status(400).json({ error: 'Missing ?path= parameter' });
    }

    try {
        const storage = await getBucket();
        const file = storage.file(storagePath);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).json({ error: 'File not found in Storage' });
        }

        // Generate signed URL valid for 7 days
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to the signed URL
        res.redirect(302, signedUrl);

    } catch (error) {
        console.error('[RAG Download] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
}
