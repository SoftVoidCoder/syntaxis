// Quick cleanup — delete ALL docs from korda_knowledge_vectors
import dotenv from 'dotenv';
dotenv.config();

const { initializeApp, cert, getApps } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');

if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const db = getFirestore();
const COLLECTION = 'korda_knowledge_vectors';

console.log(`Deleting all docs from ${COLLECTION}...`);

let totalDeleted = 0;

while (true) {
    const snapshot = await db.collection(COLLECTION).limit(20).select().get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snapshot.size;
    process.stdout.write(`\rDeleted ${totalDeleted} docs...`);
}

console.log(`\nDone! Deleted ${totalDeleted} documents total.`);
process.exit(0);
