
import { STORAGE_KEYS, DEFAULT_SALES_PROMPT, DEFAULT_TRAINING_PROMPT, DEFAULT_CALCULATION_PROMPT, DEFAULT_WELCOME_MESSAGES, DEFAULT_ANALYTICS_PROMPT, DEFAULT_KNOWLEDGE_PROMPT, DEFAULT_CONVEYOR_PROMPT } from "../constants";
import { User, ChatSession, KnowledgeFile, UserRole, ModePrompts, QuizDefinition, QuizSession, KnowledgeCategory, QuickPrompt, UserUsageStats, ChatMode, MonthlyStats } from "../types";

const isStorageQuotaError = (error: unknown): boolean => {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
};

// --- Users ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    const defaultAdmin: User = {
      id: 'admin-1',
      username: 'adam',
      email: 'adam@korda.internal',
      firstName: 'Илья',
      lastName: 'developer',
      password: '*H($ueiw(B',
      role: UserRole.ADMIN,
      isBlocked: false,
      permissions: { canGenerateImages: true, canGenerateVideos: true }
    };
    saveUsers([defaultAdmin]);
    return [defaultAdmin];
  }

  // Migration: Ensure permissions and name fields exist
  const users: User[] = JSON.parse(data);
  const updatedUsers = users.map(u => ({
    ...u,
    email: u.email || `${u.username}@korda.internal`,
    firstName: u.firstName || u.username,
    lastName: u.lastName || '',
    permissions: u.permissions || { canGenerateImages: false, canGenerateVideos: false }
  }));

  return updatedUsers;
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

// --- Analytics ---
export const getAnalytics = (): Record<string, UserUsageStats> => {
  const data = localStorage.getItem(STORAGE_KEYS.ANALYTICS);
  return data ? JSON.parse(data) : {};
};

const getMonthKey = () => new Date().toISOString().slice(0, 7); // Returns "YYYY-MM"

const ensureUserStats = (allStats: Record<string, UserUsageStats>, userId: string) => {
  if (!allStats[userId]) {
    allStats[userId] = {
      userId,
      chatRequests: {
        [ChatMode.FREE]: 0,
        [ChatMode.SALES]: 0,
        [ChatMode.TRAINING]: 0,
        [ChatMode.DEEP_RESEARCH]: 0,
        [ChatMode.CALCULATION]: 0,
        [ChatMode.ANALYTICS]: 0,
        [ChatMode.KNOWLEDGE]: 0,
        [ChatMode.NEUROMENTOR]: 0,
        [ChatMode.CONVEYOR]: 0,
      },
      imagesGenerated: 0,
      videosGenerated: 0,
      lastActive: Date.now(),
      history: {}
    };
  }
  if (!allStats[userId].history) {
    allStats[userId].history = {};
  }
};

const ensureMonthlyStats = (userStats: UserUsageStats, monthKey: string) => {
  if (userStats.history && !userStats.history[monthKey]) {
    userStats.history[monthKey] = {
      chatRequests: {
        [ChatMode.FREE]: 0,
        [ChatMode.SALES]: 0,
        [ChatMode.TRAINING]: 0,
        [ChatMode.DEEP_RESEARCH]: 0,
        [ChatMode.CALCULATION]: 0,
        [ChatMode.ANALYTICS]: 0,
        [ChatMode.KNOWLEDGE]: 0,
        [ChatMode.NEUROMENTOR]: 0,
        [ChatMode.CONVEYOR]: 0,
      },
      imagesGenerated: 0,
      videosGenerated: 0
    };
  }
};

export const trackChatRequest = (userId: string, mode: ChatMode) => {
  const allStats = getAnalytics();
  ensureUserStats(allStats, userId);

  // Update All Time
  allStats[userId].chatRequests[mode] = (allStats[userId].chatRequests[mode] || 0) + 1;
  allStats[userId].lastActive = Date.now();

  // Update Monthly
  const monthKey = getMonthKey();
  ensureMonthlyStats(allStats[userId], monthKey);
  if (allStats[userId].history && allStats[userId].history![monthKey]) {
    const mStats = allStats[userId].history![monthKey];
    mStats.chatRequests[mode] = (mStats.chatRequests[mode] || 0) + 1;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(allStats));
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;
    console.warn('[Storage] Analytics cache quota exceeded. Skipping local analytics update.', error);
  }
};

export const trackImageGeneration = (userId: string) => {
  const allStats = getAnalytics();
  ensureUserStats(allStats, userId);

  // Update All Time
  allStats[userId].imagesGenerated += 1;
  allStats[userId].lastActive = Date.now();

  // Update Monthly
  const monthKey = getMonthKey();
  ensureMonthlyStats(allStats[userId], monthKey);
  if (allStats[userId].history && allStats[userId].history![monthKey]) {
    allStats[userId].history![monthKey].imagesGenerated += 1;
  }

  localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(allStats));
};

export const trackVideoGeneration = (userId: string) => {
  const allStats = getAnalytics();
  ensureUserStats(allStats, userId);

  // Update All Time
  allStats[userId].videosGenerated += 1;
  allStats[userId].lastActive = Date.now();

  // Update Monthly
  const monthKey = getMonthKey();
  ensureMonthlyStats(allStats[userId], monthKey);
  if (allStats[userId].history && allStats[userId].history![monthKey]) {
    allStats[userId].history![monthKey].videosGenerated += 1;
  }

  localStorage.setItem(STORAGE_KEYS.ANALYTICS, JSON.stringify(allStats));
};

// --- Chats ---
const compactChatsForLocalCache = (chats: ChatSession[]): ChatSession[] => {
  return chats.slice(0, 30).map(chat => ({
    ...chat,
    messages: chat.messages.slice(-80).map(message => ({
      ...message,
      text: message.text.length > 20000 ? `${message.text.slice(0, 20000)}\n\n[Ответ был сокращен в локальном кэше браузера.]` : message.text,
      attachments: message.attachments?.map(attachment => ({
        name: attachment.name,
        mimeType: attachment.mimeType,
        fileUri: attachment.fileUri,
        data: ''
      }))
    }))
  }));
};

export const getChats = (userId: string): ChatSession[] => {
  const allChatsRaw = localStorage.getItem(STORAGE_KEYS.CHATS);
  if (!allChatsRaw) return [];
  const allChats: Record<string, ChatSession[]> = JSON.parse(allChatsRaw);
  return allChats[userId] || [];
};

export const saveUserChats = (userId: string, chats: ChatSession[]) => {
  const allChatsRaw = localStorage.getItem(STORAGE_KEYS.CHATS);
  let allChats: Record<string, ChatSession[]> = allChatsRaw ? JSON.parse(allChatsRaw) : {};
  allChats[userId] = chats;
  try {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(allChats));
  } catch (error) {
    if (!isStorageQuotaError(error)) throw error;

    console.warn('[Storage] Browser chat cache quota exceeded. Saving compact local cache instead.', error);
    try {
      allChats = { [userId]: compactChatsForLocalCache(chats) };
      localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(allChats));
    } catch (fallbackError) {
      if (!isStorageQuotaError(fallbackError)) throw fallbackError;
      console.warn('[Storage] Compact chat cache still exceeds quota. Clearing local chat cache; cloud sync remains active.', fallbackError);
      localStorage.removeItem(STORAGE_KEYS.CHATS);
    }
  }
};

// --- Knowledge Base ---
export const getKnowledgeBase = (): KnowledgeFile[] => {
  const data = localStorage.getItem(STORAGE_KEYS.KNOWLEDGE);
  if (!data) return [];

  const files: KnowledgeFile[] = JSON.parse(data);
  // Migration: If no category, assign GENERAL
  return files.map(f => ({
    ...f,
    category: f.category || KnowledgeCategory.GENERAL
  }));
};

export const saveKnowledgeBase = (files: KnowledgeFile[]) => {
  localStorage.setItem(STORAGE_KEYS.KNOWLEDGE, JSON.stringify(files));
};

// --- Custom Prompts ---
export const getModePrompts = (): ModePrompts => {
  const data = localStorage.getItem(STORAGE_KEYS.PROMPTS);
  if (data) {
    const parsed = JSON.parse(data);
    return {
      sales: parsed.sales || DEFAULT_SALES_PROMPT,
      training: parsed.training || DEFAULT_TRAINING_PROMPT,
      calculation: parsed.calculation || DEFAULT_CALCULATION_PROMPT,
      analytics: parsed.analytics || DEFAULT_ANALYTICS_PROMPT,
      deep_research: parsed.deep_research || '',
      free: parsed.free || '',
      knowledge: parsed.knowledge || DEFAULT_KNOWLEDGE_PROMPT,
      conveyor: parsed.conveyor || parsed.conveyor_calculation || DEFAULT_CONVEYOR_PROMPT
    };
  }
  return {
    sales: DEFAULT_SALES_PROMPT,
    training: DEFAULT_TRAINING_PROMPT,
    calculation: DEFAULT_CALCULATION_PROMPT,
    analytics: DEFAULT_ANALYTICS_PROMPT,
    deep_research: '',
    free: '',
    knowledge: DEFAULT_KNOWLEDGE_PROMPT,
    conveyor: DEFAULT_CONVEYOR_PROMPT
  };
};

export const saveModePrompts = (prompts: ModePrompts) => {
  localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(prompts));
};

// --- Welcome Messages ---
export const getWelcomeMessages = (): Record<ChatMode, string> => {
  const data = localStorage.getItem(STORAGE_KEYS.WELCOME_MESSAGES);
  if (data) {
    return { ...DEFAULT_WELCOME_MESSAGES, ...JSON.parse(data) };
  }
  return DEFAULT_WELCOME_MESSAGES;
};

export const saveWelcomeMessages = (messages: Record<ChatMode, string>) => {
  localStorage.setItem(STORAGE_KEYS.WELCOME_MESSAGES, JSON.stringify(messages));
};

// --- Quick Prompts (Templates) ---
export const getQuickPrompts = (): QuickPrompt[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUICK_PROMPTS);
  return data ? JSON.parse(data) : [];
};

export const saveQuickPrompt = (prompt: QuickPrompt) => {
  const prompts = getQuickPrompts();
  const existingIndex = prompts.findIndex(p => p.id === prompt.id);
  if (existingIndex >= 0) {
    prompts[existingIndex] = prompt;
  } else {
    prompts.push(prompt);
  }
  localStorage.setItem(STORAGE_KEYS.QUICK_PROMPTS, JSON.stringify(prompts));
  return prompts;
};

export const deleteQuickPrompt = (id: string) => {
  const prompts = getQuickPrompts();
  const updated = prompts.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.QUICK_PROMPTS, JSON.stringify(updated));
  return updated;
};

// --- Quizzes (Tests) ---
export const getQuizzes = (): QuizDefinition[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUIZZES);
  return data ? JSON.parse(data) : [];
};

export const saveQuizzes = (quizzes: QuizDefinition[]) => {
  localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
};

// --- Quiz Sessions (Results) ---
export const getQuizSessions = (): QuizSession[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUIZ_SESSIONS);
  const sessions: QuizSession[] = data ? JSON.parse(data) : [];
  // Migration: Ensure name fields
  return sessions.map(s => ({
    ...s,
    firstName: s.firstName || s.username,
    lastName: s.lastName || ''
  }));
};

export const saveQuizSession = (session: QuizSession) => {
  const sessions = getQuizSessions();
  const existingIndex = sessions.findIndex(s => s.id === session.id);
  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(STORAGE_KEYS.QUIZ_SESSIONS, JSON.stringify(sessions));
};
