import { initFirebase } from '../api/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log("Initializing firebase...");
    const app = await initFirebase();
    if (!app) {
        console.error("Firebase init failed.");
        process.exit(1);
    }
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    const tool = {
        id: 'select_materials',
        name: 'select_materials',
        description: 'Отвечает за интеллектуальный подбор изоляционных и защитных материалов (ткани, наполнители) в зависимости от температуры и типа оборудования. Опирается на правила ТУ.',
        isActive: true,
        createdAt: Date.now()
    };

    await db.collection('agent_tools').doc(tool.id).set(tool, { merge: true });
    console.log("Agent tool 'select_materials' added to database.");
    process.exit(0);
}

run();
