import { initFirebase } from '../api/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const app = await initFirebase();
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();

    // 1. Delete the ghosts
    await db.collection('agent_tools').doc('calculate_geometry').delete();
    await db.collection('agent_tools').doc('generate_tu_name').delete();
    console.log("Deleted ghost agents.");

    // 2. Update the real ones
    await db.collection('agent_tools').doc('5feafefc-8b6e-4540-8983-0311bd369585').set({
        description: 'Рассчитывает точную площадь термочехла по формулам и переданным габаритам. ОБРАЩАЕТСЯ К: Формулы геометрии изоляции.'
    }, { merge: true });

    await db.collection('agent_tools').doc('generate_tu_name_tool').set({
        description: 'Ассистент по ТУ. Изолированно формирует номенклатурные наименования (например: Термочехол КОРДА ЧСТЭ-500). ОБРАЩАЕТСЯ К: Внутренние Технические Условия (ТУ) компании.'
    }, { merge: true });
    
    console.log("Updated real agents.");
    process.exit(0);
}
run();
