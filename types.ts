
export enum UserRole {
  ADMIN = 'ADMIN',
  DIRECTOR = 'DIRECTOR', // New role: General Director / Владелец
  SUPERVISOR = 'SUPERVISOR', // New role: Manager/Управленец
  MANAGER = 'MANAGER',
  CONSTRUCTOR = 'CONSTRUCTOR', // New role: Engineer/Constructor
  USER = 'USER'
}

export enum UserCity {
  SPB = 'SPB',
  PENZA = 'PENZA',
  MOSCOW = 'MOSCOW',
  VELIKY_NOVGOROD = 'VELIKY_NOVGOROD'
}

export interface UserPermissions {
  canGenerateImages: boolean;
  canGenerateVideos: boolean;
  canSearchClients?: boolean; // New: Access to TasksPage (Lead Gen)
  canAccessTenders?: boolean; // New: Access to TendersPage
  canAccessSales?: boolean;   // New: Access to ChatMode.SALES
  canAccessAnalytics?: boolean; // New: Access to ChatMode.ANALYTICS
  canAccessCalculation?: boolean; // New: Access to ChatMode.CALCULATION
  canAccessConveyor?: boolean; // New: Access to ChatMode.CONVEYOR (Конвейер)
  canAccessKnowledge?: boolean; // New: Access to ChatMode.KNOWLEDGE (RAG Document Search)
  canAccessDeepResearch?: boolean; // New: Access to ChatMode.DEEP_RESEARCH
  canAccessPsychologist?: boolean; // New: Access to Corporate Psychologist
  canAccessSandbox?: boolean; // Access to Sandbox (Песочница) section
  sandboxApps?: string[]; // List of allowed sandbox enterprise apps e.g. ['consilium']
}

export interface User {
  id: string;
  email: string; // New: Required for Firebase
  username: string; // Keep for display
  firstName: string;
  lastName: string;
  role: UserRole;
  isBlocked: boolean;
  password?: string;
  permissions: UserPermissions;
  bitrixWebhookUrl?: string; // Personal Bitrix Webhook
  bitrixUserId?: string; // New: Manual Bitrix ID for Reporting
  isIpRestricted?: boolean; // New: Restrict access to allowed IPs
  city?: UserCity; // City: SPB, PENZA, MOSCOW
}

export enum ChatMode {
  FREE = 'free',
  SALES = 'sales',
  TRAINING = 'training',
  DEEP_RESEARCH = 'deep_research',
  CALCULATION = 'calculation',
  ANALYTICS = 'analytics',
  KNOWLEDGE = 'knowledge',
  NEUROMENTOR = 'neuromentor',
  CONVEYOR = 'conveyor'
}

export enum KnowledgeCategory {
  GENERAL = 'GENERAL',
  SALES = 'SALES',
  TRAINING = 'TRAINING',
  DEEP_RESEARCH = 'DEEP_RESEARCH',
  CALCULATION = 'CALCULATION',
  ANALYTICS = 'ANALYTICS',
  STRATEGY = 'STRATEGY', // New: Ideal Customer Profiles
  KNOWLEDGE = 'KNOWLEDGE' // New: RAG Document Search
}

// --- Lead Generation Task System ---
export interface Lead {
  companyName: string;
  inn: string;
  reason: string; // Why this company fits the profile
  url?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED' | 'FAIL' | 'IGNORED';
}

export interface SalesTask {
  id: string;
  userId: string;
  createdAt: number;
  leads: Lead[];
  summary?: string; // AI Summary of the outcome
  status: 'IN_PROGRESS' | 'COMPLETED';
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  attachments?: Attachment[];
  telemetryLogs?: string[];
  tokensUsed?: number;
  searchQueries?: string[];
  masterJson?: any[];
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // base64 or raw text content
  fileUri?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  createdAt: number;
  isPinned: boolean;
  messages: Message[];
}

// --- Psychologist Chats (Local only) ---
export interface PsychologistMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export interface PsychologistChatSession {
  id: string;
  title: string;
  createdAt: number;
  school: string;
  messages: PsychologistMessage[];
}

export interface KnowledgeFile {
  id: string;
  name: string;
  content: string;
  mimeType: string;
  category: KnowledgeCategory;
  createdAt: number;
  originalSize?: number;
}

// --- Corporate Chats ---
export interface CorporateMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: number;
  isRead: boolean;
}

export interface CorporateChat {
  id: string;
  participants: string[]; // User IDs
  lastMessage?: CorporateMessage;
  updatedAt: number;
  unreadCount?: Record<string, number>; // Map of userId -> unread count
}

// --- Analytics ---
export interface MonthlyStats {
  chatRequests: Record<ChatMode, number>;
  imagesGenerated: number;
  videosGenerated: number;
}

export interface UserUsageStats {
  userId: string;
  // All-time totals
  chatRequests: Record<ChatMode, number>;
  imagesGenerated: number;
  videosGenerated: number;
  lastActive: number;
  // Historical data by "YYYY-MM"
  history?: Record<string, MonthlyStats>;
}

// --- Custom Prompts ---
export interface ModePrompts {
  sales: string;
  training: string;
  calculation: string;
  analytics: string; // New
  deep_research: string; // New
  free: string; // New
  knowledge: string; // New: RAG Knowledge Base
  conveyor?: string;
}

// --- Quick Prompts (Templates) ---
export interface QuickPrompt {
  id: string;
  title: string;
  content: string;
  mode: ChatMode;
}

// --- Testing / Quiz System ---
export enum QuizDifficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  EXTREME = 'EXTREME'
}

export interface QuizDefinition {
  id: string;
  topic: string;
  description?: string;
  category?: KnowledgeCategory;
  questionCount: number;
  createdAt: number;
  createdAtDate?: string;
  createdBy: string; // admin id
  isActive: boolean;
}

export interface QuizQuestion {
  questionText: string;
  options: string[];
  correctOptionIndex: number;
}

// --- Tender Workflow System ---
export enum TenderWorkflowStatus {
  REVIEW = 'REVIEW',           // Рассмотрение
  CONTRACTOR = 'CONTRACTOR',   // Подрядчик
  PREPARATION = 'PREPARATION', // Подготовка документов
  SUBMISSION = 'SUBMISSION',   // Подача заявки
  SUBMITTED = 'SUBMITTED',     // Заявка подана
  WON = 'WON',                 // Выиграно
  LOST = 'LOST',               // Проиграно
  OVERDUE = 'OVERDUE',         // Просрочено
  DECLINED = 'DECLINED',       // Отклонено
}

// Shared favourite / "в работу" record
export interface TenderFavorite {
  tenderId: string;
  addedBy: string;        // userId who added
  addedByName: string;    // "Имя Фамилия" for display
  addedAt: number;        // timestamp
  assignedTo?: string;    // userId of responsible person
  assignedToName?: string;
  assignedBy?: string;    // userId who assigned
  workflowStatus?: TenderWorkflowStatus;
  statusChangedAt?: number;
  statusChangedBy?: string;
  notes?: string;
  contractor?: string;         // Contractor name for CONTRACTOR stage
  markedForRemoval?: boolean;
  markedForRemovalBy?: string;
  markedForRemovalAt?: number;
}

// Shared AI score
export interface SharedTenderScore {
  tenderId: string;
  score: number;          // 1-5
  reason: string;
  scoredAt: number;
  scoredByModel: string;  // e.g. 'gemini-3.1-pro-preview'
}

// Comment on a tender
export interface TenderComment {
  id: string;
  tenderId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

// Daily tender analytics
export interface TenderDailyStats {
  date: string;           // 'YYYY-MM-DD'
  apiQuotaUsed: number;
  apiQuotaLimit: number;
  tendersFound: number;
  tendersAdded: number;
  aiScoringsRun: number;
  tokensUsed?: number;
  userSearches?: Record<string, { name: string, count: number }>;
  userAdded?: Record<string, { name: string, count: number }>;
  userAiScorings?: Record<string, { name: string, count: number }>;
}

export interface QuizSession {
  id: string;
  quizId: string;
  userId: string;
  username: string;
  firstName: string; // Snapshot
  lastName: string;  // Snapshot
  difficulty?: QuizDifficulty;
  startedAt: number;
  completedAt?: number;
  questions: QuizQuestion[];
  userAnswers: number[];
  score: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  explanations?: Record<number, string>; // AI explanations for wrong answers (questionIndex -> text)
  disputes?: Record<number, boolean>; // Disputed questions (questionIndex -> true)
}

// --- Conveyor System (НейроРасчеты) ---
export enum ConveyorStatus {
  NEW = 'NEW', // Черновик — менеджер работает с ИИ
  PENDING_VERIFICATION = 'PENDING_VERIFICATION', // Верификация — конструктор проверяет расчёт
  VERIFIED = 'VERIFIED', // КП Готово — менеджер формирует КП
  COMPLETED = 'COMPLETED', // Завершено — КП создано/отправлено клиенту
  REJECTED = 'REJECTED' // @deprecated — Legacy. Возврат теперь → NEW + revision entry
}

export enum RejectionCategory {
  CALCULATION_ERROR = 'CALCULATION_ERROR',       // Ошибка в расчёте
  MISSING_DATA = 'MISSING_DATA',                 // Недостаточно данных
  PRICE_ERROR = 'PRICE_ERROR',                   // Некорректные цены
  WRONG_MATERIAL = 'WRONG_MATERIAL',             // Нужен другой материал
  INCORRECT_DIMENSIONS = 'INCORRECT_DIMENSIONS', // Неверные размеры/площади
  OTHER = 'OTHER'                                // Другое
}

export interface RevisionEntry {
  round: number;
  returnedBy: string;       // userId
  returnedByName: string;   // "Фамилия Имя"
  category: RejectionCategory;
  comment: string;
  timestamp: number;
}

export interface ConveyorFile {
  name: string;          // Оригинальное имя файла
  gcsPath: string;       // Путь в GCS (conveyor-files/requestId/name)
  gsUri: string;         // gs:// URI для Gemini
  mimeType: string;
  size: number;
  uploadedBy: string;    // userId
  uploadedAt: number;    // timestamp
  extractedText?: string; // Text extracted from unsupported formats like .docx
}

export interface ConveyorRequest {
  id: string;
  sourceChatId: string;
  managerId: string;
  managerName: string;
  constructorId?: string;
  constructorName?: string;
  createdAt: number;
  updatedAt?: number;
  status: ConveyorStatus;
  title: string;
  finalOfferText?: string;
  isManagerBlocked: boolean;
  attachments?: Attachment[]; // Legacy — временные вложения для Gemini
  files?: ConveyorFile[]; // Постоянные документы заявки в GCS
  clientDescription?: string; // Текстовое описание от менеджера (редактируемое)
  reverificationCount: number;
  revisions?: RevisionEntry[]; // История возвратов с комментариями
  analysisResult?: string;
  calculationResult?: string;
  bitrixDealUrl?: string;
  bitrixDealId?: string;
  bitrixContext?: string;
  chatHistory?: Message[];
  totalTokensUsed?: number;
}

export interface ConveyorRuleCategory {
  id: string;
  name: string;
  parentId: string | null; // null if it's a root category
  isForCommercial?: boolean; // root-level flag: include rules in commercial phase
  isForCalculation?: boolean; // root-level flag: include rules in calculation phase
}

export interface ConveyorRule {
  id: string;
  name: string;
  content: string;
  priority: number; // 1-10
  categoryId?: string; // Links to ConveyorRuleCategory
}

// --- Agent Tools (Function Calling) ---
export interface AgentTool {
  id: string;
  name: string; // The exact function name expected by the code (e.g. "calculate_geometry")
  description: string; // The description that tells Gemini WHEN to use this tool
  isActive: boolean;
  createdAt: number;
}

// --- Coverage Coefficients (для расчёта площади изоляции) ---
export interface CoverageCoefficient {
  id: string;
  name: string;           // "Задвижка клиновая"
  h_coefficient: number;  // 0.60 — доля высоты, покрываемая изоляцией
  shape: 'cylinder' | 'cube'; // форма для расчёта площади
  keywords: string[];     // ["задвижка", "30с41нж"] — для автоопределения типа
  notes: string;          // "Изолируем корпус до сальника"
  abbreviation?: string;  // "З", "Ф", "КШ" — Аббревиатура ТУ
  series?: string;        // "ТА", "У", "КИП" — Серия
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    mammoth?: any;
    XLSX?: any;
    JSZip?: any;
  }
  var mammoth: any;
}

// --- OrgTasks (Kanban) ---
export enum OrgTaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

export enum OrgTaskType {
  TOP_DOWN = 'TOP_DOWN',   // Director/Manager -> Employee
  BOTTOM_UP = 'BOTTOM_UP', // Employee -> Director/Manager
  PARALLEL = 'PARALLEL'    // Employee -> Employee
}

export interface OrgTask {
  id: string;
  title: string;
  description: string;
  status: OrgTaskStatus;
  type: OrgTaskType;
  creatorId: string;
  assigneeId: string;
  createdAt: number;
  updatedAt: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
}

