/**
 * Quiz/Testing generation service.
 */
import { Type } from "@google/genai";
import { KnowledgeFile, KnowledgeCategory, QuizQuestion, QuizDifficulty } from "../types";
import { callProxy } from "./geminiCore";

interface GenerateQuizProps {
  topic: string;
  description?: string;
  category?: KnowledgeCategory;
  difficulty?: QuizDifficulty;
  questionCount: number;
  knowledgeBase: KnowledgeFile[];
}

const DIFFICULTY_INSTRUCTIONS: Record<QuizDifficulty, string> = {
  [QuizDifficulty.EASY]: `
    DIFFICULTY: EASY (Базовый)
    - Ask basic, straightforward questions about fundamental concepts.
    - Questions should test general understanding, not specific numbers or details.
    - Options should be clearly distinguishable — one correct, others obviously wrong.
    - No calculations or numerical problems required.
    - Example: "Что такое базальтовая вата?" with simple true/false-style options.
  `,
  [QuizDifficulty.MEDIUM]: `
    DIFFICULTY: MEDIUM (Средний)
    - Ask questions that require knowledge of specific details and properties.
    - Include some specific characteristics, classifications, or use cases.
    - Options should be plausible — require actual knowledge to distinguish.
    - May include simple numerical values (e.g. temperature ranges, standard sizes).
    - Example: "Какой класс горючести у базальтовой ваты?" with realistic options.
  `,
  [QuizDifficulty.HARD]: `
    DIFFICULTY: HARD (Сложный)
    - Ask questions that require deep technical knowledge.
    - MUST include specific numbers, values, tolerances, and technical specifications.
    - Include tricky distractors that are close to the correct answer.
    - Some questions should compare similar products/materials/parameters.
    - Options should differ by small margins to test precision of knowledge.
    - Example: "Какова плотность утеплителя марки X при толщине Y мм?" with close numerical options.
  `,
  [QuizDifficulty.EXTREME]: `
    DIFFICULTY: EXTREME (Предельный)
    - Create CALCULATION and PROBLEM-SOLVING questions.
    - Questions MUST require the user to perform calculations (area, volume, weight, cost, coverage).
    - Include multi-step problems: "Сколько упаковок утеплителя X потребуется для стены площадью Y м², если в одной упаковке Z м²?"
    - Include scenario-based questions: "Клиент просит утеплить крышу площадью X м². Какой материал и в каком количестве вы порекомендуете?"
    - All options must be numerically close — only correct calculation gives the right answer.
    - At least 60% of questions MUST be calculation/problem-solving tasks.
  `
};

export const generateQuizQuestions = async ({
  topic, description, category, difficulty, questionCount, knowledgeBase
}: GenerateQuizProps): Promise<QuizQuestion[]> => {

  let filteredKB = knowledgeBase;
  if (category) {
    filteredKB = knowledgeBase.filter(f => f.category === category || f.category === KnowledgeCategory.GENERAL);
  }

  let context = "";
  if (filteredKB.length === 0 && category) {
    context = `[Warning: No specific files found for category ${category}. Using general knowledge.]`;
  } else {
    filteredKB.forEach(file => {
      context += `\nContent from ${file.name} (${file.category}): ${file.content.substring(0, 4000)}`;
    });
  }

  const difficultyBlock = difficulty
    ? DIFFICULTY_INSTRUCTIONS[difficulty]
    : DIFFICULTY_INSTRUCTIONS[QuizDifficulty.MEDIUM];

  const prompt = `
    Create a multiple-choice quiz about "${topic}".
    Additional Context/Description for this test: "${description || 'None provided'}".
    Target Knowledge Category: ${category || 'General'}.
    
    Number of questions: ${questionCount}.
    Target audience: Company employees.
    Language: Russian.
    
    ${difficultyBlock}

    INSTRUCTIONS:
    1. Use the provided "Internal Knowledge Base Context" below as the PRIMARY source for generating questions.
    2. If the Knowledge Base context is insufficient, use your general knowledge to fill in the gaps.
    3. The goal is to create a challenging and educational test based on real facts.
    4. STRICTLY follow the difficulty instructions above — this is critical for test quality.
    5. Each question MUST have exactly 4 answer options.
    
    Internal Knowledge Base Context:
    ${context}
  `;

  try {
    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionText: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctOptionIndex: { type: Type.INTEGER, description: "Index of the correct option (0-based)" }
        },
        required: ["questionText", "options", "correctOptionIndex"]
      }
    };

    const result = await callProxy('generateContent', {
      model: 'gemini-3.5-flash',
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const text = result.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text) as QuizQuestion[];
  } catch (error) {
    console.error("Quiz Gen Error", error);
    throw new Error("Failed to generate quiz questions");
  }
};

/**
 * Generate an AI explanation for a wrong answer.
 */
export const generateQuizExplanation = async (
  questionText: string,
  options: string[],
  correctOptionIndex: number,
  userAnswerIndex: number
): Promise<string> => {
  const prompt = `
Ты — преподаватель в компании Korda, производящей теплоизоляцию.
Сотрудник ответил НЕВЕРНО на тестовый вопрос. Объясни кратко и конкретно:
1. Почему его ответ неправильный.
2. Почему правильный ответ — верный.

Вопрос: "${questionText}"
Варианты ответа:
${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Ответ сотрудника: "${options[userAnswerIndex]}" (Неверно)
Правильный ответ: "${options[correctOptionIndex]}"

Ответь на русском, 2-4 предложения. Без вступлений и заключений — только суть.
  `.trim();

  try {
    const result = await callProxy('generateContent', {
      model: 'gemini-3-flash-preview',
      contents: { role: 'user', parts: [{ text: prompt }] },
      config: {}
    });

    const text = result.text;
    if (!text) throw new Error("Empty explanation response");
    return text.trim();
  } catch (error) {
    console.error("Explanation Gen Error", error);
    throw new Error("Не удалось сгенерировать обоснование");
  }
};

