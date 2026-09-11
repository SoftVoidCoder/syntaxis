/**
 * Lead generation, task outcome analysis, and chip suggestions services.
 */
import { Type } from "@google/genai";
import { Lead } from "../types";
import { FAST_MODEL_NAME } from "../constants";
import { callProxy, extractJsonObject } from "./geminiCore";

// --- Lead Generation ---
export const generateLeads = async (
  strategyContext: string,
  managerWishes?: string,
  excludeNames?: string[],
  excludeCompanyNames?: string[],
  requestCount: number = 15
): Promise<Lead[]> => {
  const wishesContext = managerWishes ? `\n    MANAGER'S SPECIFIC WISHES (PRIORITY): "${managerWishes}"\n    (Adhere strictly to these wishes if they narrow down the search in terms of location, industry, or company size.)` : "";
  const excludeContext = (excludeNames && excludeNames.length > 0) ? `\n    CRITICAL EXCLUSION LIST (by name): DO NOT include the following companies (names or similar variants): ${excludeNames.join(', ')}.` : "";
  const excludeCompanyContext = (excludeCompanyNames && excludeCompanyNames.length > 0) ? `\n    ADDITIONAL EXCLUSION LIST (by company name): These companies are already known. DO NOT include them or their subsidiaries: ${excludeCompanyNames.join(', ')}.` : "";

  const prompt = `
    Find ${requestCount} distinct real-world companies that match this strategy: "${strategyContext}".
    ${wishesContext}
    ${excludeContext}
    ${excludeCompanyContext}
    
    For each company you find, provide:
    - Company Name (Official legal name)
    - INN (Tax ID) - CRITICAL: You MUST specifically search for "ИНН [CompanyName]" to find the correct Russian INN.
    - Website URL
    - A brief reason why they fit the Ideal Customer Profile described in the strategy.
    
    Target Region: Russia / CIS (unless strategy says otherwise).
    Output Language: Russian.

    CRITICAL INSTRUCTION FOR OUTPUT: 
    You MUST output ONLY a pure, valid JSON object. 
    Do NOT include any markdown formatting.
    Do NOT include any citations or text outside the JSON structure.
    If you include any citations like [1] or [2] from your search grounding, they MUST be placed INSIDE the string values (e.g. "reason": "They fit because... [1]").

    Return a JSON object with this structure:
    {
      "leads": [
        {
          "companyName": "String",
          "inn": "String (10-12 digits)",
          "url": "String",
          "reason": "String",
          "status": "NEW"
        }
      ]
    }
  `;

  try {
    const initResult = await callProxy('generateContentAsync', {
      model: FAST_MODEL_NAME,
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: { 
        tools: [{ googleSearch: {} }]
      }
    });

    if (!initResult.jobId) throw new Error("Failed to start generation job");

    let result = null;
    const POLLING_INTERVAL = 10000;
    const MAX_ATTEMPTS = 60;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      try {
        const statusResult = await callProxy('getContentStatus', { jobId: initResult.jobId });
        if (statusResult.done) { result = statusResult; break; }
      } catch (pollErr) {
        console.warn("Polling Warning:", pollErr);
        if (String(pollErr).includes("Job Failed")) throw pollErr;
      }
    }

    if (!result) throw new Error("Время ожидания генерации вышло.");

    const text = result.text;
    if (!text) throw new Error("Empty response from lead generation");

    const data = extractJsonObject(text);
    return data.leads as Lead[];

  } catch (error: any) {
    console.error("Lead Gen Error:", error);
    throw new Error(`Не удалось найти лиды: ${error?.message || 'Неизвестная ошибка'}. Попробуйте уточнить стратегию.`);
  }
};

// --- Task Outcome Analysis ---
export const analyzeTaskOutcome = async (chats: any[]): Promise<string> => {
  if (!chats || chats.length === 0) return "Нет диалогов для анализа.";

  const chatLogs = chats.map(c => {
    const history = c.messages.map((m: any) => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    return `### Chat for Company: "${c.title}"\nLOG:\n${history}\n--- END CHAT ---\n`;
  }).join('\n\n');

  const prompt = `
    You are an AI Analyst. Analyze the following sales chat logs from a Lead Generation task.
    
    For each company/chat, identify:
    1. **Status**: Was a "Company" or "Lead" created in the CRM? Or was it a Duplicate? Or Rejected?
    2. **Actions**: explicit confirmation of "Created Company [ID]" or "Created Lead [ID]".
    3. **Links**: Extract FULL Bitrix24 links (e.g., https://.../crm/lead/details/123/) if present in the text.
    
    CRITICAL: You must NOT guess. Only report "Created" if the log contains a system message or confirmation about a created ID.
    
    Output Format: Markdown Table.
    Columns: Company Name | Status | Details & Links
    
    Example Row:
    | OOO "Vector" | ✅ Lead Created | [Lead #555](https://b24.../lead/555) |
    | ZAO "Omega" | ⚠️ Duplicate | Found existing ID: 1022 |
    | IP "Smirnov" | ❌ Rejected | Not interested |
    
    Output in Russian.
    
    CHATS TO ANALYZE:
    ${chatLogs}
  `;

  try {
    const result = await callProxy('generateContent', {
      model: FAST_MODEL_NAME,
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: { temperature: 0.2 }
    });
    return result.text || "Не удалось сформировать отчет.";
  } catch (err: any) {
    console.error("Task Analysis Error:", err);
    return "Ошибка при анализе результатов задачи.";
  }
};

// --- Chip Suggestions for Client Search ---
export const generateChipSuggestions = async (currentText: string, chipPrompt: string): Promise<string[]> => {
  if (!currentText.trim()) return [];

  const prompt = `${chipPrompt}\n\nТекущий запрос менеджера: "${currentText}"`;

  try {
    const result = await callProxy('generateContent', {
      model: FAST_MODEL_NAME,
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: { temperature: 0.8, maxOutputTokens: 2048 }
    });

    const text = result.text;
    if (!text) return [];

    let jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBracket = jsonString.indexOf('[');
    const lastBracket = jsonString.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      jsonString = jsonString.substring(firstBracket, lastBracket + 1);
      try {
        const suggestions = JSON.parse(jsonString) as string[];
        return suggestions.filter(s => typeof s === 'string' && s.trim()).slice(0, 5);
      } catch { /* fallback below */ }
    }

    const matches = text.match(/"([^"]{3,80})"/g);
    if (matches && matches.length > 0) {
      return matches.map(m => m.replace(/"/g, '')).slice(0, 5);
    }
    return [];
  } catch (error: any) {
    console.error("Chip Suggestion Error:", error);
    return [];
  }
};
