/**
 * Auth, user management, knowledge, settings, quizzes, and analytics.
 */
import { User, ChatSession, KnowledgeFile, QuizDefinition, QuizSession, ChatMode, QuickPrompt } from "../types";
import { callDbProxy } from "./dbProxy";

const USERS_COLLECTION = "users";
const CHATS_COLLECTION = "chats";
const KNOWLEDGE_COLLECTION = "knowledge";

// --- Auth ---
export const loginWithCustomAuth = async (username: string, password: string): Promise<User> => {
  try {
    const user = await callDbProxy('login', { username, password });
    return user as User;
  } catch (error: any) {
    console.error("Custom Auth Login Failed:", error);
    throw new Error("Неверный логин или пароль");
  }
};

export const bootstrapAdmin = async () => callDbProxy('bootstrap', {});
export const loginWithFirebase = async (emailOrUsername: string, password: string): Promise<User> => loginWithCustomAuth(emailOrUsername, password);
export const logoutFirebase = async () => {};
export const syncUserProfile = async (user: User): Promise<void> => {};

export const createUserInFirebase = async (userData: User, password: string): Promise<void> => {
  const newId = crypto.randomUUID();
  const newUser = { ...userData, id: newId, password };
  await callDbProxy('set', { collectionName: USERS_COLLECTION, docId: newId, data: newUser });
};

// --- User Management ---
let _usersCachePromise: Promise<User[]> | null = null;
let _usersCacheTime = 0;

export const getAllUsersFromFirebase = async (): Promise<User[]> => {
  const now = Date.now();
  if (_usersCachePromise && (now - _usersCacheTime < 30000)) {
    return _usersCachePromise; // Return cached promise if requested within 30 seconds
  }
  _usersCachePromise = callDbProxy('list', { collectionName: USERS_COLLECTION }).then(res => res as User[]);
  _usersCacheTime = now;
  
  try {
    return await _usersCachePromise;
  } catch (err) {
    _usersCachePromise = null; // Clear cache on error
    throw err;
  }
};

export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    return await callDbProxy('get', { collectionName: USERS_COLLECTION, docId: userId }) as User;
  } catch (err) { console.error(`Failed to get user ${userId}:`, err); return null; }
};

export const toggleUserBlockInFirebase = async (userId: string, isBlocked: boolean) => {
  await callDbProxy('set', { collectionName: USERS_COLLECTION, docId: userId, data: { isBlocked } });
};

export const updateUserPermissionsInFirebase = async (userId: string, permissions: any) => {
  await callDbProxy('set', { collectionName: USERS_COLLECTION, docId: userId, data: { permissions } });
};

export const updateUserPassword = async (userId: string, password: string) => {
  await callDbProxy('set', { collectionName: USERS_COLLECTION, docId: userId, data: { password } });
};

export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  await callDbProxy('set', { collectionName: USERS_COLLECTION, docId: userId, data });
};

// --- Chat Management ---
export const saveChatToFirebase = async (userId: string, chat: ChatSession) => {
  await callDbProxy('set', { collectionName: `${USERS_COLLECTION}/${userId}/${CHATS_COLLECTION}`, docId: chat.id, data: chat });
};

export const getUserChatsFromFirebase = async (userId: string): Promise<ChatSession[]> => {
  try {
    const chats = await callDbProxy('list', { collectionName: `${USERS_COLLECTION}/${userId}/${CHATS_COLLECTION}` });
    return (chats as ChatSession[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) { console.error("Failed to load chats via proxy:", err); return []; }
};

export const deleteChatFromFirebase = async (userId: string, chatId: string) => {
  await callDbProxy('delete', { collectionName: `${USERS_COLLECTION}/${userId}/${CHATS_COLLECTION}`, docId: chatId });
};

// --- Knowledge Base ---
export const saveKnowledgeFileToFirebase = async (file: KnowledgeFile) => {
  await callDbProxy('set', { collectionName: KNOWLEDGE_COLLECTION, docId: file.id, data: file });
};

export const getKnowledgeBaseFromFirebase = async (): Promise<KnowledgeFile[]> => {
  try {
    return await callDbProxy('list', { collectionName: KNOWLEDGE_COLLECTION }) as KnowledgeFile[];
  } catch (error) { console.error("Proxy knowledge fetch failed:", error); return []; }
};

export const deleteKnowledgeFileFromFirebase = async (fileId: string) => {
  await callDbProxy('delete', { collectionName: KNOWLEDGE_COLLECTION, docId: fileId });
};

// --- System Settings ---
export const getSystemSettings = async () => {
  try { return await callDbProxy('get_settings'); }
  catch (err) { console.error("Failed to fetch settings:", err); return null; }
};

export const saveSystemSettings = async (settings: any) => callDbProxy('save_settings', { settings });

// --- Quizzes ---
export const getQuizzesFromFirebase = async (): Promise<QuizDefinition[]> => {
  try { return await callDbProxy('list', { collectionName: 'quizzes' }) as QuizDefinition[]; }
  catch (err) { console.error("Failed to load quizzes", err); return []; }
};

export const saveQuizToFirebase = async (quiz: QuizDefinition) => {
  await callDbProxy('set', { collectionName: 'quizzes', docId: quiz.id, data: quiz });
};

export const deleteQuizFromFirebase = async (quizId: string) => {
  await callDbProxy('delete', { collectionName: 'quizzes', docId: quizId });
};

export const getQuizSessionsFromFirebase = async (): Promise<QuizSession[]> => {
  try { return await callDbProxy('list', { collectionName: 'quiz_sessions' }) as QuizSession[]; }
  catch (err) { console.error("Failed to load quiz sessions", err); return []; }
};

export const saveQuizSessionToFirebase = async (session: QuizSession) => {
  await callDbProxy('set', { collectionName: 'quiz_sessions', docId: session.id, data: session });
};

export const deleteQuizSessionFromFirebase = async (sessionId: string) => {
  await callDbProxy('delete', { collectionName: 'quiz_sessions', docId: sessionId });
};

// --- Analytics ---
export const logAnalyticsEvent = async (user: User, type: 'chat' | 'image' | 'video', mode?: ChatMode) => {
  try {
    await callDbProxy('track_analytics', { userId: user.id, type, mode, userInfo: { firstName: user.firstName, lastName: user.lastName } });
  } catch (err) { console.warn("Analytics tracking failed (silent):", err); }
};

export const getAnalyticsFromFirebase = async (): Promise<any[]> => {
  try { return await callDbProxy('list', { collectionName: 'analytics_monthly' }); }
  catch (err) { console.error("Failed to fetch analytics:", err); return []; }
};

export const getServerLogsFromFirebase = async (): Promise<any[]> => {
  try { return await callDbProxy('list', { collectionName: 'server_activity_logs' }); }
  catch (err) { console.error("Failed to fetch server logs:", err); return []; }
};

let _reportsCachePromise: Promise<any[]> | null = null;
let _reportsCacheTime = 0;

export const getDailyReportsFromFirebase = async (): Promise<any[]> => {
  const now = Date.now();
  if (_reportsCachePromise && (now - _reportsCacheTime < 30000)) {
    return _reportsCachePromise;
  }
  _reportsCachePromise = callDbProxy('list', { collectionName: 'analytics_daily' });
  _reportsCacheTime = now;

  try {
    return await _reportsCachePromise;
  } catch (err) {
    _reportsCachePromise = null;
    console.error("Failed to fetch daily reports:", err);
    return [];
  }
};

// --- Personal Quick Prompts (per user, per mode) ---
const PERSONAL_PROMPTS_SUBCOLLECTION = 'personal_prompts';

export const getPersonalPrompts = async (userId: string): Promise<QuickPrompt[]> => {
  try {
    return await callDbProxy('list', { collectionName: `${USERS_COLLECTION}/${userId}/${PERSONAL_PROMPTS_SUBCOLLECTION}` }) as QuickPrompt[];
  } catch (err) { console.error("Failed to load personal prompts:", err); return []; }
};

export const savePersonalPrompt = async (userId: string, prompt: QuickPrompt): Promise<void> => {
  await callDbProxy('set', { collectionName: `${USERS_COLLECTION}/${userId}/${PERSONAL_PROMPTS_SUBCOLLECTION}`, docId: prompt.id, data: prompt });
};

export const deletePersonalPrompt = async (userId: string, promptId: string): Promise<void> => {
  await callDbProxy('delete', { collectionName: `${USERS_COLLECTION}/${userId}/${PERSONAL_PROMPTS_SUBCOLLECTION}`, docId: promptId });
};
