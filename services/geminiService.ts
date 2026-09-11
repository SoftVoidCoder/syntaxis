/**
 * Barrel re-export — all consumers can continue importing from 'services/geminiService'.
 * Internally, each domain lives in its own file for maintainability.
 */

// Chat
export { generateGeminiResponse, uploadFileToGemini } from './geminiChat';

// Design Studio
export { generateDesignImage, generateDesignVideo } from './geminiDesign';

// Quiz / Testing
export { generateQuizQuestions, generateQuizExplanation } from './geminiQuiz';

// Lead Generation & Client Search
export { generateLeads, analyzeTaskOutcome, generateChipSuggestions } from './geminiLeads';

// Tender Scoring
export { scoreTendersWithAI } from './geminiTenders';
export type { TenderScore } from './geminiTenders';