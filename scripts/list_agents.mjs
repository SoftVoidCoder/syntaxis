import { initFirebase } from '../api/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const app = await initFirebase();
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    const snapshot = await db.collection('agent_tools').get();
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Name: ${data.name}, Active: ${data.isActive}`);
    });
    process.exit(0);
}
run();
