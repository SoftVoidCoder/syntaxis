import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ vertexai: true, project: 'korda-syntax', location: 'global', googleAuthOptions: { credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) } });

async function test() {
    const userMessage = `Данные чек листа указаны ниже: Вид изоляции: КЗХ Максимальная температура оборудования: 200 Размещение: Помещение Температура ОС от и до: 20-25 Обогрев: Без обогрева Чертежи, 3D модели: см. файлы Комментарий к чек-листу: Защитные чехлы на фланцевые соединения и запорные арматуры трубопроводов химии (натр, соляная кислота: Пример во вложении. На запорные арматуры: 1.d100, длина 300 мм – 10 шт. 2.d50, длина 300 мм – 50 шт. На фланцевые соединения: 1.d50, длина 150 мм – 30 шт. 2.d65, длина 150 мм – 20 шт. 3.d100, длина 200 мм – 30 шт.`;

    const toolDef = {
        name: 'generate_tu_name',
        description: 'Ассистент по ТУ...',
    };

    const extractConfig = {
        maxOutputTokens: 256,
        temperature: 0.1,
        tools: [{ functionDeclarations: [toolDef] }],
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        systemInstruction: 'Твоя единственная задача - извлечь полные исходные данные от пользователя. ОБЯЗАТЕЛЬНО вызови функцию и передай ВЕСЬ текст из запроса пользователя целиком в параметр raw_specification как одну строку.'
    };

    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        config: extractConfig
    });

    console.log(JSON.stringify(response.candidates[0], null, 2));
}
test().catch(console.error);
