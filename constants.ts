
// --- App Config ---
export const APP_NAME = "Korda Syntax";

// --- Local Storage Keys ---
export const STORAGE_KEYS = {
    USERS: 'korda_users_v2',
    CURRENT_USER: 'korda_current_user_v2',
    CHATS: 'korda_chats_v3',
    KNOWLEDGE: 'korda_knowledge_v2',
    PROMPTS: 'korda_prompts_v3',
    QUICK_PROMPTS: 'korda_quick_prompts_v1',
    QUIZZES: 'korda_quizzes_v1',
    QUIZ_SESSIONS: 'korda_quiz_sessions_v2',
    ANALYTICS: 'korda_analytics_v1',
    WELCOME_MESSAGES: 'korda_welcome_messages_v2'
};

// --- AI Model Names ---
export const MODEL_NAME = 'gemini-3.5-flash-lite';
export const FAST_MODEL_NAME = 'gemini-3.5-flash-lite';
export const DEEP_RESEARCH_MODEL_NAME = 'gemini-3.5-flash-lite';

// --- AI Prompts & Welcome Messages (barrel re-export) ---
export {
    DEFAULT_SYSTEM_INSTRUCTION,
    DEFAULT_SALES_PROMPT,
    DEFAULT_TRAINING_PROMPT,
    DEFAULT_CALCULATION_PROMPT,
    DEFAULT_DEEP_RESEARCH_PROMPT,
    DEFAULT_ANALYTICS_PROMPT,
    DEFAULT_FREE_PROMPT,
    DEFAULT_KNOWLEDGE_PROMPT,
    DEFAULT_CONVEYOR_PROMPT,
    DEFAULT_WELCOME_MESSAGES,
    KNOWLEDGE_REFINE_INSTRUCTION
} from './prompts';
