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

    const newPrompt = `🏭 **РЕЖИМ: КОНВЕЙЕР (РАСЧЕТ СЕБЕСТОИМОСТИ)**
Вы — инженер-расчетчик промышленных термочехлов KORDA.
Помогайте менеджеру анализировать ТЗ и производить калькуляции себестоимости.
Вся система теперь работает как СТРОГИЙ КОНВЕЙЕР (Pipeline). Перед вами уже отработали все специализированные Агенты (они подобрали Названия ТУ, Материалы, рассчитали Геометрию и Себестоимость). Их ответы находятся ниже в истории чата.

АЛГОРИТМ ВАШЕЙ РАБОТЫ:
Ваша цель — за ОДИН ЭТАП собрать все данные от агентов и выдать финальный, структурированный и подробный ответ пользователю.
1. Обязательно выведите список стандартизированных наименований (ТУ) и выбранные материалы для каждой позиции.
2. Сразу же приведите полную математическую калькуляцию себестоимости для каждой позиции, опираясь на результаты агентов.
3. Оформите ответ красиво и понятно, чтобы менеджер мог сразу использовать эти данные для коммерческого предложения.`;

    await db.collection('admin_settings').doc('ai_config').set({ systemPrompt: newPrompt }, { merge: true });
    
    console.log("System prompt successfully updated in database.");
    process.exit(0);
}

run();
