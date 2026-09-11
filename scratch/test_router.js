import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function run() {
    const ai = new GoogleGenAI({
        vertexai: true,
        project: 'korda-syntax',
        location: 'global',
        googleAuthOptions: {
            credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'),
        }
    });

    const userPrompt = `Данные чек листа указаны ниже: Вид изоляции: КЗХ Максимальная температура оборудования: 200 Размещение: Помещение Температура ОС от и до: 20-25 Обогрев: Без обогрева Чертежи, 3D модели: см. файлы Комментарий к чек-листу: Защитные чехлы на фланцевые соединения и запорные арматуры трубопроводов химии (натр, соляная кислота: Пример во вложении. На запорные арматуры: 1.d100, длина 300 мм – 10 шт. 2.d50, длина 300 мм – 50 шт. На фланцевые соединения: 1.d50, длина 150 мм – 30 шт. 2.d65, длина 150 мм – 20 шт. 3.d100, длина 200 мм – 30 шт.`;

    const tools = [{
        functionDeclarations: [
            {
                name: 'calculate_geometry',
                description: 'Calculates the geometry',
                parameters: { type: "OBJECT", properties: { diameter: { type: "NUMBER" }, length: { type: "NUMBER" } }, required: ["diameter", "length"] }
            },
            {
                name: 'generate_tu_name',
                description: 'Generates TU name',
                parameters: { type: "OBJECT", properties: { equipmentType: { type: "STRING" } }, required: ["equipmentType"] }
            },
            {
                name: 'select_materials',
                description: 'Selects materials',
                parameters: { type: "OBJECT", properties: { equipmentType: { type: "STRING" }, temperature: { type: "STRING" } }, required: ["equipmentType"] }
            }
        ]
    }];

    const dispatcherConfig = {
        maxOutputTokens: 512,
        temperature: 0.1,
        tools: tools,
        systemInstruction: `ТЫ — МАРШРУТИЗАТОР (ROUTER) АГЕНТНОЙ СИСТЕМЫ. Твоя ЕДИНСТВЕННАЯ задача — анализировать запрос пользователя и ВЫЗЫВАТЬ ИНСТРУМЕНТЫ (function calls).
КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ отвечать пользователю текстом, давать советы или производить вычисления самостоятельно.
1. Если в запросе упоминается тип оборудования (задвижка, теплообменник, труба, фильтр и т.д.) или температура — ОБЯЗАТЕЛЬНО вызови инструмент 'select_materials' для подбора материалов.
2. Если в запросе упоминается тип оборудования (задвижка, теплообменник, труба и т.д.) — ОБЯЗАТЕЛЬНО вызови инструмент 'generate_tu_name' для подбора правильного названия по ТУ.
3. Если в запросе есть хотя бы один из параметров: диаметр, длина, ширина, толщина — ОБЯЗАТЕЛЬНО вызови инструмент 'calculate_geometry'.
4. Если для ответа требуются данные из CRM — вызывай соответствующие инструменты.
Если никакие инструменты точно не применимы, ответь ровно одним словом: "SKIP".`
    };

    console.log("Calling router...");
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            config: dispatcherConfig
        });

        console.log("Response text:", typeof response.text === 'function' ? response.text() : response.text);
        
        const candidate = response.candidates?.[0];
        const functionCallParts = candidate?.content?.parts?.filter(p => p.functionCall) || [];
        console.log("Function calls:", JSON.stringify(functionCallParts, null, 2));
    } catch(err) {
        console.error(err);
    }
}

run();
