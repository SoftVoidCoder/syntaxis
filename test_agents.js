import { executeAgentTool } from './api/agentTools.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Wrap ai object to match what proxy passes
const ai = {
    models: {
        generateContent: async (req) => {
            const model = genAI.getGenerativeModel({ model: req.model });
            const prompt = req.contents[0].parts[0].text;
            console.log("SENDING PROMPT:\n", prompt.substring(0, 500), "...");
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: req.config
            });
            return result.response;
        }
    }
};

const spec = `
1. ВЗ-50-50 Rushwork 315 - 6 шт.
2. ВЗ-80-50 Rushwork 315 - 7 шт.
3. ВЗ-100-50 Rushwork 315 - 1 шт.
4. Кран шаровой фланцевый Ду 50 - 1 шт.
5. Кран шаровой фланцевый Ду 80 - 1 шт.
`;

async function run() {
    console.log("Running generate_tu_name...");
    const res = await executeAgentTool('generate_tu_name', { raw_specification: spec }, ai, 'gemini-1.5-flash');
    console.log("Result:", JSON.stringify(res, null, 2));
}

run().catch(console.error);
