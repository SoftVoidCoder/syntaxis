import React, { useState, useEffect } from 'react';
import { User, UserRole, KnowledgeFile, ModePrompts, QuizDefinition, QuizSession, KnowledgeCategory, QuickPrompt, ChatMode, UserUsageStats, SalesTask } from '../types';
import { useAuth } from '../context/AuthContext';
import {
   getAllUsersFromFirebase,
   getKnowledgeBaseFromFirebase,
   getSystemSettings,
   getQuizzesFromFirebase,
   getQuizSessionsFromFirebase,
   getAnalyticsFromFirebase,
   getAllSalesTasks
} from '../services/firebaseService';
import { DEFAULT_WELCOME_MESSAGES } from '../constants';

// Sub-components
import { AdminUsers } from './admin/AdminUsers';
import { AdminReports } from './admin/AdminReports';
import { AdminAnalytics } from './admin/AdminAnalytics';
import { AdminKnowledge } from './admin/AdminKnowledge';
import { AdminPrompts } from './admin/AdminPrompts';
import { AdminTesting } from './admin/AdminTesting';
import { AdminClientSearch } from './admin/AdminClientSearch';
import { AdminConveyorSettings } from './admin/AdminConveyorSettings';
import { AdminFileMonitor } from './admin/AdminFileMonitor';
import { AdminChangelog } from './admin/AdminChangelog';

interface AdminDashboardProps {
   onViewReport?: (userId: string) => void;
   initialTab?: 'users' | 'knowledge' | 'prompts' | 'testing' | 'analytics' | 'reports' | 'client_search' | 'conveyor_settings' | 'file_monitor' | 'project_changelog';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onViewReport, initialTab = 'project_changelog' }) => {
   const { user } = useAuth();

   // Validate initial tab based on role
   const validInitialTab = ((initialTab === 'users' || initialTab === 'project_changelog') && user?.role !== UserRole.ADMIN && user?.role !== UserRole.DIRECTOR) ? 'reports' : initialTab;

   // --- Shared Data State ---
   const [users, setUsers] = useState<User[]>([]);
   const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeFile[]>([]);
   const [prompts, setPrompts] = useState<ModePrompts>({ sales: '', training: '', calculation: '', analytics: '', deep_research: '', free: '', knowledge: '' });
   const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([]);
   const [quizzes, setQuizzes] = useState<QuizDefinition[]>([]);
   const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
   const [analytics, setAnalytics] = useState<Record<string, UserUsageStats>>({});
   const [allSalesTasks, setAllSalesTasks] = useState<SalesTask[]>([]);

   // Settings State
   const [welcomeMessages, setWelcomeMessages] = useState<Record<ChatMode, string>>(DEFAULT_WELCOME_MESSAGES);
   const [bitrixWebhook, setBitrixWebhook] = useState('');
   const [tenderContext, setTenderContext] = useState('');
   const [baseNegativeKeywords, setBaseNegativeKeywords] = useState('');
   const [allowedIps, setAllowedIps] = useState<string[]>([]);
   const [searchChips, setSearchChips] = useState('');
   const [searchChipPrompt, setSearchChipPrompt] = useState('');

   // UI
   const [activeTab, setActiveTab] = useState<'users' | 'knowledge' | 'prompts' | 'testing' | 'analytics' | 'reports' | 'client_search' | 'conveyor_settings' | 'file_monitor' | 'project_changelog'>(validInitialTab);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      loadData();
   }, []);

   const loadData = async () => {
      setError(null);
      try {
         const fbUsers = await getAllUsersFromFirebase();
         setUsers(fbUsers);
      } catch (err: any) {
         console.error("Failed to load Users:", err);
         setError(`Ошибка: ${err.message || "Неизвестная ошибка загрузки"}`);
      }

      try {
         const fbKnowledge = await getKnowledgeBaseFromFirebase();
         setKnowledgeBase(fbKnowledge);
      } catch (err) {
         console.error("Failed to load Knowledge:", err);
      }

      try {
         const settings = await getSystemSettings();
         if (settings) {
            setWelcomeMessages(settings.welcomeMessages || DEFAULT_WELCOME_MESSAGES);
            setQuickPrompts(settings.quickPrompts || []);
            setBitrixWebhook(settings.bitrixWebhook || '');
            setTenderContext(settings.tenderContext || '');
            setBaseNegativeKeywords(settings.baseNegativeKeywords || '');
            setAllowedIps(settings.allowedIps || []);
            setSearchChips((settings.searchChips || []).join(', '));
            setSearchChipPrompt(settings.searchChipPrompt || '');

            if (settings.prompts) {
               setPrompts({
                  sales: settings.prompts.sales || '',
                  training: settings.prompts.training || '',
                  calculation: settings.prompts.calculation || '',
                  analytics: settings.prompts.analytics || '',
                  deep_research: settings.prompts.deep_research || '',
                  free: settings.prompts.free || '',
                  knowledge: settings.prompts.knowledge || ''
               });
            } else {
               setPrompts({ sales: '', training: '', calculation: '', analytics: '', deep_research: '', free: '', knowledge: '' });
            }
         } else {
            setPrompts({ sales: '', training: '', calculation: '', analytics: '', deep_research: '', free: '', knowledge: '' });
            setWelcomeMessages(DEFAULT_WELCOME_MESSAGES);
            setQuickPrompts([]);
            setBitrixWebhook('');
            setTenderContext('');
            setBaseNegativeKeywords('');
            setAllowedIps([]);
         }
      } catch (err) {
         console.error("Failed to load Settings:", err);
      }

      try {
         const [cloudQuizzes, cloudSessions] = await Promise.all([
            getQuizzesFromFirebase(),
            getQuizSessionsFromFirebase()
         ]);
         setQuizzes(cloudQuizzes);
         setQuizSessions(cloudSessions);
      } catch (err) {
         console.error("Failed to load Quizzes:", err);
      }

      try {
         const cloudAnalytics = await getAnalyticsFromFirebase();
         const transformedAnalytics: Record<string, UserUsageStats> = {};

         cloudAnalytics.forEach((doc: any) => {
            const uid = doc.userId;
            if (!transformedAnalytics[uid]) {
               transformedAnalytics[uid] = {
                  userId: uid,
                  chatRequests: {
                     [ChatMode.FREE]: 0,
                     [ChatMode.SALES]: 0,
                     [ChatMode.TRAINING]: 0,
                     [ChatMode.CALCULATION]: 0,
                     [ChatMode.DEEP_RESEARCH]: 0,
                     [ChatMode.ANALYTICS]: 0,
                     [ChatMode.KNOWLEDGE]: 0,
                     [ChatMode.NEUROMENTOR]: 0,
                     [ChatMode.CONVEYOR]: 0
                  },
                  imagesGenerated: 0,
                  videosGenerated: 0,
                  lastActive: 0,
                  history: {}
               };
            }

            const stats = transformedAnalytics[uid];
            if (doc.lastActive > stats.lastActive) stats.lastActive = doc.lastActive;

            if (stats.history) {
               stats.history[doc.month] = {
                  chatRequests: doc.chatRequests || {},
                  imagesGenerated: doc.imagesGenerated || 0,
                  videosGenerated: doc.videosGenerated || 0
               };
            }

            if (doc.chatRequests) {
               Object.entries(doc.chatRequests).forEach(([mode, count]) => {
                  const m = mode as ChatMode;
                  stats.chatRequests[m] = (stats.chatRequests[m] || 0) + (count as number);
               });
            }
            stats.imagesGenerated += (doc.imagesGenerated || 0);
            stats.videosGenerated += (doc.videosGenerated || 0);
         });

         setAnalytics(transformedAnalytics);
      } catch (err) {
         console.error("Failed to load Analytics:", err);
      }

      await loadSalesTasks();
   };

   const loadSalesTasks = async () => {
      try {
         const tasks = await getAllSalesTasks();
         setAllSalesTasks(tasks);
      } catch (err) {
         console.error("Failed to load Sales Tasks:", err);
      }
   };

   return (
      <div className="flex h-full">
         {/* Vertical Sidebar Navigation */}
         <div className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col py-4 overflow-y-auto">
            <nav className="flex flex-col gap-1 px-3">
               {[
                  { id: 'project_changelog', label: 'Отчеты по проекту', icon: '📝', adminOnly: true },
                  { id: 'file_monitor', label: 'Файловый сервер', icon: '🗄️', adminOnly: true },
                  { id: 'conveyor_settings', label: 'Настройки Конвейера', icon: '🏭', adminOnly: true },
                  { id: 'reports', label: 'Отчеты', icon: '📊', adminOnly: false },
                  { id: 'analytics', label: 'Аналитика', icon: '📈', adminOnly: false },
                  { id: 'prompts', label: 'Настройки ИИ', icon: '⚙️', adminOnly: true },
                  { id: 'knowledge', label: 'База знаний', icon: '📚', adminOnly: true },
                  { id: 'testing', label: 'Тестирование', icon: '✅', adminOnly: false },
                  { id: 'client_search', label: 'Поиск клиентов', icon: '🔍', adminOnly: false },
                  { id: 'users', label: 'Пользователи', icon: '👥', adminOnly: true }
               ]
               .filter(tab => {
                  if (!tab.adminOnly) return true;
                  if (user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR) return true;
                  if (tab.id === 'conveyor_settings' && user?.role === UserRole.SUPERVISOR) return true;
                  return false;
               })
               .map(tab => (
                  <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id as any)}
                     className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${activeTab === tab.id
                        ? 'bg-korda-50 text-korda-700 border border-korda-200 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                        }`}
                  >
                     <span className="text-base">{tab.icon}</span>
                     {tab.label}
                  </button>
               ))}
            </nav>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6 pb-20">
               {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 flex flex-col md:flex-row items-start md:items-center justify-between shadow-sm gap-4">
                     <span className="font-medium flex items-center gap-2 break-all">⚠️ {error}</span>
                     <button onClick={loadData} className="text-sm bg-white border border-red-200 px-3 py-1 rounded-lg hover:bg-red-50 font-bold transition-colors whitespace-nowrap">
                        Повторить
                     </button>
                  </div>
               )}

               {activeTab === 'users' && (
                  <AdminUsers
                     users={users}
                     setUsers={setUsers}
                     allowedIps={allowedIps}
                     setAllowedIps={setAllowedIps}
                  />
               )}

               {activeTab === 'reports' && (
                  <AdminReports
                     users={users}
                     onViewReport={onViewReport}
                  />
               )}

               {activeTab === 'analytics' && (
                  <AdminAnalytics
                     users={users}
                     analytics={analytics}
                  />
               )}

               {activeTab === 'knowledge' && (
                  <AdminKnowledge
                     knowledgeBase={knowledgeBase}
                     setKnowledgeBase={setKnowledgeBase}
                  />
               )}

               {activeTab === 'prompts' && (
                  <AdminPrompts
                     prompts={prompts}
                     setPrompts={setPrompts}
                     welcomeMessages={welcomeMessages}
                     setWelcomeMessages={setWelcomeMessages}
                     quickPrompts={quickPrompts}
                     setQuickPrompts={setQuickPrompts}
                     bitrixWebhook={bitrixWebhook}
                     setBitrixWebhook={setBitrixWebhook}
                     tenderContext={tenderContext}
                     setTenderContext={setTenderContext}
                     baseNegativeKeywords={baseNegativeKeywords}
                     setBaseNegativeKeywords={setBaseNegativeKeywords}
                     searchChips={searchChips}
                     setSearchChips={setSearchChips}
                     searchChipPrompt={searchChipPrompt}
                     setSearchChipPrompt={setSearchChipPrompt}
                  />
               )}

               {activeTab === 'conveyor_settings' && (
                  <AdminConveyorSettings />
               )}

               {activeTab === 'file_monitor' && (
                  <AdminFileMonitor />
               )}

               {activeTab === 'project_changelog' && (
                  <AdminChangelog />
               )}

               {activeTab === 'testing' && (
                  <AdminTesting
                     quizzes={quizzes}
                     setQuizzes={setQuizzes}
                     quizSessions={quizSessions}
                     users={users}
                     onReloadData={loadData}
                  />
               )}

               {activeTab === 'client_search' && (
                  <AdminClientSearch
                     users={users}
                     allSalesTasks={allSalesTasks}
                     loadSalesTasks={loadSalesTasks}
                  />
               )}
            </div>
         </div>
      </div>
   );
};
