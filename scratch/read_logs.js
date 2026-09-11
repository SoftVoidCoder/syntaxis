import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

const saKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

initializeApp({
  credential: cert(saKey)
});

const db = getFirestore();

async function readLogs() {
  const snapshot = await db.collection('server_activity_logs')
    .orderBy('serverReceivedAt', 'desc')
    .limit(10)
    .get();

  if (snapshot.empty) {
    console.log("Коллекция server_activity_logs пуста.");
    return;
  }

  let count = 0;
  snapshot.forEach(doc => {
    count++;
    console.log(`--- Log ${count} ---`);
    console.log(doc.data());
  });
}

readLogs().catch(console.error);
