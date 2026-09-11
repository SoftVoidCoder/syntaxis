/**
 * Tender AI scoring service.
 */
import { Type } from "@google/genai";
import { callProxy, extractJsonObject } from "./geminiCore";

export interface TenderScore {
  id: string;
  score: number;
  reason: string;
}

export const scoreTendersWithAI = async (
  tenders: { id: string, name: string, customer: string }[],
  companyContext: string,
  modelName: string = 'gemini-3.5-flash'
): Promise<TenderScore[]> => {
  if (!tenders || tenders.length === 0) return [];

  const prompt = `
    You are an AI Tender Expert. Your goal is to score how relevant a list of tenders is for a specific company.
    
    Company Context:
    "${companyContext}"
    
    Below is a list of tenders in JSON format (id, name, customer).
    Analyze each tender's name and customer against the company context.
    Assign a score from 1 to 5:
    - 5 = Exact match, perfect fit for the company's core business.
    - 4 = Very good fit, likely interesting.
    - 3 = Possible fit, related industry but maybe not the primary focus.
    - 2 = Unlikely fit, only marginally related.
    - 1 = No fit at all, completely irrelevant or obviously wrong context (e.g., "cases for phones" when the company makes "thermal cases for pipes").
    
    Also provide a very brief (max 5-7 words) reason in Russian for the score.
    
    Tenders to analyze:
    ${JSON.stringify(tenders)}
    
    Return a JSON object strictly following this structure:
    {
      "results": [
        {
          "id": "string",
          "score": number, // 1 to 5
          "reason": "string (in Russian)"
        }
      ]
    }
  `;

  try {
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        results: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              score: { type: Type.INTEGER },
              reason: { type: Type.STRING }
            },
            required: ["id", "score", "reason"]
          }
        }
      },
      required: ["results"]
    };

    const result = await callProxy('generateContent', {
      model: modelName,
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: { responseMimeType: "application/json", responseSchema, temperature: 0.2 }
    });

    const text = result.text;
    if (!text) throw new Error("Empty response from tender scoring");

    const data = extractJsonObject(text);
    return data.results as TenderScore[];
  } catch (error: any) {
    console.error("Tender Scoring Error:", error);
    throw new Error("Failed to score tenders with AI");
  }
};

