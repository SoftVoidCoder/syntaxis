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

    // Descriptions explicitly referencing what they access:
    const updates = [
        {
            id: 'generate_tu_name',
            description: 'Ассистент по ТУ. Изолированно формирует номенклатурные наименования (например: Термочехол КОРДА ЧСТЭ-500). ОБРАЩАЕТСЯ К: Внутренние Технические Условия (ТУ) компании.'
        },
        {
            id: 'select_materials',
            description: 'Отвечает за интеллектуальный подбор изоляционных и защитных материалов (ткани, наполнители) в зависимости от температуры и типа оборудования. ОБРАЩАЕТСЯ К: Правила выбора материалов.'
        },
        {
            id: 'calculate_geometry',
            description: 'Рассчитывает точную площадь термочехла по формулам и переданным габаритам. ОБРАЩАЕТСЯ К: Формулы геометрии изоляции.'
        },
        {
            id: 'calculate_cost',
            description: 'Агент по расчету себестоимости. Опирается на актуальные цены комплектующих и перемножает их на вычисленную площадь. Запускается строго после расчета геометрии. ОБРАЩАЕТСЯ К: База данных Прайс-листов компании.'
        },
        {
            id: 'calculate_commercial',
            description: 'Агент по формированию коммерческой части (КП). Анализирует стоимость и выводит итоговое предложение для клиента. ОБРАЩАЕТСЯ К: Коммерческие правила и наценки.'
        }
    ];

    for (const u of updates) {
        await db.collection('agent_tools').doc(u.id).set({ description: u.description }, { merge: true });
        console.log(`Updated ${u.id} description.`);
    }

    console.log("All descriptions updated successfully.");
    process.exit(0);
}

run();
