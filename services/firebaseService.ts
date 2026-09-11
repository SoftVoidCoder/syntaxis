/**
 * Barrel re-export — all consumers can continue importing from 'services/firebaseService'.
 * Internally, each domain lives in its own file for maintainability.
 */

// Auth & Users & Chats & Knowledge & Settings & Quizzes & Analytics
export {
  loginWithCustomAuth, bootstrapAdmin, loginWithFirebase, logoutFirebase, syncUserProfile, createUserInFirebase,
  getAllUsersFromFirebase, getUserById, toggleUserBlockInFirebase, updateUserPermissionsInFirebase, updateUserPassword, updateUserProfile,
  saveChatToFirebase, getUserChatsFromFirebase, deleteChatFromFirebase,
  saveKnowledgeFileToFirebase, getKnowledgeBaseFromFirebase, deleteKnowledgeFileFromFirebase,
  getSystemSettings, saveSystemSettings,
  getQuizzesFromFirebase, saveQuizToFirebase, deleteQuizFromFirebase,
  getQuizSessionsFromFirebase, saveQuizSessionToFirebase, deleteQuizSessionFromFirebase,
  logAnalyticsEvent, getAnalyticsFromFirebase, getDailyReportsFromFirebase, getServerLogsFromFirebase,
  getPersonalPrompts, savePersonalPrompt, deletePersonalPrompt
} from './fireCore';

// Corporate Chats
export {
  getCorporateChats, getCorporateMessages, sendCorporateMessage,
  markCorporateChatAsRead, createCorporateChat
} from './fireCorporate';

// Tenders
export {
  getSharedFavorites, addSharedFavorite, removeSharedFavorite,
  markFavoriteForRemoval, unmarkFavoriteForRemoval,
  assignTenderResponsible, updateTenderWorkflowStatus, updateTenderContractor,
  getSharedTenderScores, saveSharedTenderScores,
  logTenderDailyStats, getTenderDailyStats,
  getTenderComments, addTenderComment
} from './fireTenders';

// Conveyor
export {
  getConveyorRequests, createConveyorRequest, updateConveyorRequest,
  getConveyorRuleCategories, saveConveyorRuleCategory, deleteConveyorRuleCategory,
  getConveyorRules, saveConveyorRule, deleteConveyorRule,
  getAgentTools, saveAgentTool, deleteAgentTool,
} from './fireConveyor';

// Sales Tasks & Leads
export {
  createTask, getUserTasks, getAllSalesTasks, deleteSalesTask,
  completeTask, updateTaskLeads,
  getKnownLeadNames, reserveLeadNames, updateLeadInn,
  getPersonalIgnoreList, addToPersonalIgnore
} from './fireTasks';

// Org Tasks (Kanban)
export {
  createOrgTask, updateOrgTask, deleteOrgTask, getOrgTasks
} from './fireOrgTasks';
