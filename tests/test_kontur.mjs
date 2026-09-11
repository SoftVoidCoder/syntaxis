import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.KONTUR_API_KEY;

if (!API_KEY) {
    console.error("❌ Ошибка: Переменная KONTUR_API_KEY не найдена в .env");
    process.exit(1);
}

async function testKonturApi() {
    console.log("🔍 Проверяем доступные лимиты API Контур.Закупки...");
    try {
        const response = await fetch('https://api-zakupki.kontur.ru/external/v1/limitGroups', {
            method: 'GET',
            headers: {
                'X-Kontur-Apikey': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`❌ HTTP Ошибка: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error("Детали:", errorText);
            return;
        }

        const data = await response.json();
        console.log("✅ Успешный ответ! Ваши лимиты:");
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("❌ Ошибка выполнения запроса:", error.message);
    }
}

testKonturApi();
