import { initFirebase } from './api/db.js';
import { getFirestore } from 'firebase-admin/firestore';

async function main() {
    await initFirebase();
    const db = getFirestore();
    const doc = await db.collection('settings').doc('global').get();
    console.log("Settings global:", doc.data());
    const users = await db.collection('users').get();
    const btUsers = users.docs.filter(d => d.data().bitrixUserId);
    console.log("Users with Bitrix ID:", btUsers.length);
    process.exit(0);
}
main().catch(console.error);
