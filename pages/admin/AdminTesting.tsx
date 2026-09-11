import React, { useState } from 'react';
import { QuizDefinition, QuizSession, KnowledgeCategory, QuizDifficulty, User, UserRole } from '../../types';
import { Button } from '../../components/Button';
import { FileQuestion, ClipboardList, Trash2, ChevronDown, ChevronUp, RotateCcw, Users, BarChart3, Plus, Settings, PieChart, HelpCircle, Loader2, Lightbulb, Zap, Award } from 'lucide-react';

type AdminTestingTab = 'manage' | 'progress' | 'results';
import {
   saveQuizToFirebase,
   deleteQuizFromFirebase,
   deleteQuizSessionFromFirebase,
   saveQuizSessionToFirebase
} from '../../services/firebaseService';
import { generateQuizExplanation } from '../../services/geminiService';

const CATEGORY_NAMES: Record<KnowledgeCategory, string> = {
   [KnowledgeCategory.GENERAL]: 'Общая',
   [KnowledgeCategory.SALES]: 'Продажи',
   [KnowledgeCategory.TRAINING]: 'Обучение',
   [KnowledgeCategory.DEEP_RESEARCH]: 'Глубокий Анализ',
   [KnowledgeCategory.CALCULATION]: 'Расчеты',
   [KnowledgeCategory.ANALYTICS]: 'Аналитика',
   [KnowledgeCategory.STRATEGY]: 'Стратегия Продаж (ICP)',
   [KnowledgeCategory.KNOWLEDGE]: 'База Знаний R&D'
};

const DIFFICULTY_META: Record<QuizDifficulty, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
   [QuizDifficulty.EASY]: { label: 'Базовый', emoji: '🟢', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
   [QuizDifficulty.MEDIUM]: { label: 'Средний', emoji: '🟡', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
   [QuizDifficulty.HARD]: { label: 'Сложный', emoji: '🟠', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
   [QuizDifficulty.EXTREME]: { label: 'Предельный', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

const ALL_DIFFICULTIES: QuizDifficulty[] = [QuizDifficulty.EASY, QuizDifficulty.MEDIUM, QuizDifficulty.HARD, QuizDifficulty.EXTREME];

const DIFFICULTY_WEIGHT: Record<QuizDifficulty, number> = {
   [QuizDifficulty.EASY]: 25,
   [QuizDifficulty.MEDIUM]: 50,
   [QuizDifficulty.HARD]: 75,
   [QuizDifficulty.EXTREME]: 100,
};

const ROLE_NAMES: Record<UserRole, string> = {
   [UserRole.ADMIN]: 'Админ',
   [UserRole.DIRECTOR]: 'Директор',
   [UserRole.SUPERVISOR]: 'Руководитель',
   [UserRole.MANAGER]: 'Менеджер',
   [UserRole.USER]: 'Сотрудник',
   [UserRole.CONSTRUCTOR]: 'Инженер-Сметчик'
};

interface AdminTestingProps {
   quizzes: QuizDefinition[];
   setQuizzes: React.Dispatch<React.SetStateAction<QuizDefinition[]>>;
   quizSessions: QuizSession[];
   users: User[];
   onReloadData: () => Promise<void>;
}

export const AdminTesting: React.FC<AdminTestingProps> = ({ quizzes, setQuizzes, quizSessions, users, onReloadData }) => {
   const [activeTab, setActiveTab] = useState<AdminTestingTab>('manage');
   const [newQuizTopic, setNewQuizTopic] = useState('');
   const [newQuizDesc, setNewQuizDesc] = useState('');
   const [newQuizCount, setNewQuizCount] = useState(5);
   const [newQuizCategory, setNewQuizCategory] = useState<KnowledgeCategory>(KnowledgeCategory.TRAINING);
   const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null);
   const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
   const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
   const [searchQuery, setSearchQuery] = useState('');
   const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
   const [resultsDiffFilter, setResultsDiffFilter] = useState<QuizDifficulty | 'ALL'>('ALL');
   const [resultsRoleFilter, setResultsRoleFilter] = useState<UserRole | 'ALL'>('ALL');
   const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null); // sessionId-questionIdx
   const [localSessions, setLocalSessions] = useState<Record<string, QuizSession>>({}); // overridden sessions cache

   const handleCreateQuiz = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newQuizTopic) return;

      const newQuiz: QuizDefinition = {
         id: crypto.randomUUID(),
         topic: newQuizTopic,
         description: newQuizDesc,
         questionCount: newQuizCount,
         category: newQuizCategory,
         createdAt: Date.now(),
         createdBy: 'admin',
         isActive: true
      };

      try {
         await saveQuizToFirebase(newQuiz);
         setQuizzes([...quizzes, newQuiz]);
         setNewQuizTopic('');
         setNewQuizDesc('');
         alert("Тест успешно создан в облаке!");
      } catch (err: any) {
         console.error("Quiz creation failed:", err);
         alert("Ошибка создания теста: " + err.message);
      }
   };

   const toggleQuizStatus = async (id: string) => {
      const quiz = quizzes.find(q => q.id === id);
      if (!quiz) return;
      const updatedQuiz = { ...quiz, isActive: !quiz.isActive };
      try {
         await saveQuizToFirebase(updatedQuiz);
         setQuizzes(quizzes.map(q => q.id === id ? updatedQuiz : q));
      } catch (err) {
         console.error("Toggle status failed:", err);
         alert("Ошибка обновления статуса");
      }
   };

   const handleDeleteQuiz = async (id: string) => {
      if (!window.confirm("Удалить этот тест и все его результаты?")) return;
      try {
         await deleteQuizFromFirebase(id);
         setQuizzes(quizzes.filter(q => q.id !== id));
      } catch (err: any) {
         console.error("Failed to delete quiz:", err);
         alert("Ошибка удаления теста: " + err.message);
      }
   };

   const handleResetSession = async (sessionId: string) => {
      if (!window.confirm("Сбросить результат? Пользователь сможет пройти тест заново, но текущий результат будет безвозвратно удален.")) return;
      try {
         await deleteQuizSessionFromFirebase(sessionId);
         await onReloadData();
      } catch (e: any) {
         alert("Ошибка при сбросе результата: " + e.message);
      }
   };

   const handleOverrideScore = async (session: QuizSession) => {
      if (!window.confirm(`Засчитать 100% для ${session.lastName} ${session.firstName}?`)) return;
      try {
         const updatedSession = { ...session, score: session.questions.length };
         await saveQuizSessionToFirebase(updatedSession);
         setLocalSessions(prev => ({ ...prev, [session.id]: updatedSession }));
         await onReloadData();
      } catch (e: any) {
         alert("Ошибка: " + e.message);
      }
   };

   const handleAdminExplain = async (session: QuizSession, questionIdx: number) => {
      const loadKey = `${session.id}-${questionIdx}`;
      if (loadingExplanation === loadKey) return;
      const q = session.questions[questionIdx];
      const userAns = session.userAnswers[questionIdx];
      if (userAns === q.correctOptionIndex) return;
      if (session.explanations?.[questionIdx]) return;

      setLoadingExplanation(loadKey);
      try {
         const explanation = await generateQuizExplanation(
            q.questionText, q.options, q.correctOptionIndex, userAns
         );
         const updatedExplanations = { ...(session.explanations || {}), [questionIdx]: explanation };
         const updatedSession = { ...session, explanations: updatedExplanations };
         await saveQuizSessionToFirebase(updatedSession);
         setLocalSessions(prev => ({ ...prev, [session.id]: updatedSession }));
         await onReloadData();
      } catch (e: any) {
         console.error('Admin explanation failed:', e);
      } finally {
         setLoadingExplanation(null);
      }
   };

   const toggleExpandQuiz = (quizId: string) => {
      setExpandedQuizId(expandedQuizId === quizId ? null : quizId);
   };

   // === User Progress Helpers ===
   // Build per-user, per-quiz, per-difficulty stats
   const getUserProgress = (userId: string) => {
      const userSessions = quizSessions.filter(s => s.userId === userId && s.status === 'COMPLETED');
      const progress: Record<string, Record<QuizDifficulty, { bestScore: number; total: number } | null>> = {};

      quizzes.forEach(quiz => {
         progress[quiz.id] = {} as any;
         ALL_DIFFICULTIES.forEach(d => {
            const sessions = userSessions.filter(s => s.quizId === quiz.id && s.difficulty === d);
            if (sessions.length === 0) {
               progress[quiz.id][d] = null;
            } else {
               const best = sessions.reduce((b, s) => {
                  const bPct = b.questions.length > 0 ? b.score / b.questions.length : 0;
                  const sPct = s.questions.length > 0 ? s.score / s.questions.length : 0;
                  return sPct > bPct ? s : b;
               });
               progress[quiz.id][d] = { bestScore: best.score, total: best.questions.length };
            }
         });
      });

      return progress;
   };

   // Filter users by role
   const filteredProgressUsers = users.filter(u => {
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch = !query || 
         u.firstName.toLowerCase().includes(query) || 
         u.lastName.toLowerCase().includes(query) ||
         `${u.lastName} ${u.firstName}`.toLowerCase().includes(query);
      return matchesRole && matchesSearch;
   });

   const quizzesWithSessions = quizzes.filter(q => quizSessions.some(s => s.quizId === q.id && s.status === 'COMPLETED'));

   return (
      <div className="space-y-6">
         {/* Tab Bar */}
         <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
               onClick={() => setActiveTab('manage')}
               className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'manage'
                     ? 'bg-white text-korda-700 shadow-sm border border-slate-200'
                     : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
               }`}
            >
               <Settings size={18} />
               Управление
               <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'manage' ? 'bg-korda-100 text-korda-700' : 'bg-slate-200 text-slate-500'
               }`}>
                  {quizzes.length}
               </span>
            </button>
            <button
               onClick={() => setActiveTab('progress')}
               className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'progress'
                     ? 'bg-white text-korda-700 shadow-sm border border-slate-200'
                     : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
               }`}
            >
               <BarChart3 size={18} />
               Прогресс
            </button>
            <button
               onClick={() => setActiveTab('results')}
               className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'results'
                     ? 'bg-white text-korda-700 shadow-sm border border-slate-200'
                     : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
               }`}
            >
               <ClipboardList size={18} />
               Результаты
               {quizzesWithSessions.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                     activeTab === 'results' ? 'bg-korda-100 text-korda-700' : 'bg-slate-200 text-slate-500'
                  }`}>
                     {quizzesWithSessions.length}
                  </span>
               )}
            </button>
         </div>

         {/* ===== TAB: MANAGE ===== */}
         {activeTab === 'manage' && (
            <div className="space-y-6">
               {/* Create Form */}
               <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                  <h2 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
                     <Plus className="text-korda-500" size={20} /> Создать новый тест
                  </h2>
                  <form onSubmit={handleCreateQuiz} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Название/Тема</label>
                        <input type="text" placeholder="Например: Базальтовая вата" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none" value={newQuizTopic} onChange={e => setNewQuizTopic(e.target.value)} required />
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Источник вопросов (Категория БЗ)</label>
                        <select className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none" value={newQuizCategory} onChange={e => setNewQuizCategory(e.target.value as KnowledgeCategory)}>
                           {Object.values(KnowledgeCategory).map(cat => (
                              <option key={cat} value={cat}>{CATEGORY_NAMES[cat]}</option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Детали и контекст (для ИИ)</label>
                        <textarea placeholder="Опишите, на чем сделать акцент..." className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none h-[42px] text-sm resize-none" value={newQuizDesc} onChange={e => setNewQuizDesc(e.target.value)} />
                     </div>
                     <div className="flex items-end gap-3">
                        <div className="flex-1">
                           <label className="block text-sm font-bold text-slate-700 mb-1">Кол-во вопросов</label>
                           <input type="number" min={1} max={20} className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none" value={newQuizCount} onChange={e => setNewQuizCount(parseInt(e.target.value))} />
                        </div>
                        <Button type="submit" className="shadow-md px-6 h-[42px]">Создать тест</Button>
                     </div>
                  </form>
                  <p className="text-xs text-slate-400 mt-3">💡 Уровень сложности выбирает сотрудник при прохождении. ИИ автоматически адаптирует вопросы.</p>
               </div>

               {/* Test List */}
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <FileQuestion className="text-korda-500" size={20} /> Все тесты
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold ml-1">{quizzes.length}</span>
                     </h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                     {quizzes.length === 0 && (
                        <div className="text-center text-slate-400 py-12">
                           <FileQuestion size={48} className="mx-auto text-slate-300 mb-3" />
                           <p className="font-medium">Нет созданных тестов</p>
                           <p className="text-sm mt-1">Создайте первый тест с помощью формы выше</p>
                        </div>
                     )}
                     {quizzes.map(q => {
                        const sessionCount = quizSessions.filter(s => s.quizId === q.id && s.status === 'COMPLETED').length;
                        return (
                           <div key={q.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                              <div className="min-w-0 flex-1 mr-4">
                                 <p className="font-bold text-slate-800 truncate">{q.topic}</p>
                                 {q.description && <p className="text-xs text-slate-500 truncate mt-0.5">{q.description}</p>}
                                 <div className="flex gap-2 mt-2">
                                    <span className="text-xs text-slate-400 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded">{q.questionCount} вопросов</span>
                                    <span className="text-xs text-korda-600 font-medium bg-korda-50 inline-block px-2 py-0.5 rounded">{q.category ? CATEGORY_NAMES[q.category] : 'Общая'}</span>
                                    {sessionCount > 0 && (
                                       <span className="text-xs text-slate-400 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded">{sessionCount} прохождений</span>
                                    )}
                                 </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                 <Button variant="secondary" className={`text-xs whitespace-nowrap bg-slate-50 border border-slate-200 ${q.isActive ? 'text-green-600' : 'text-red-500'}`} onClick={() => toggleQuizStatus(q.id)}>
                                    {q.isActive ? 'Активен' : 'Скрыт'}
                                 </Button>
                                 <button onClick={() => handleDeleteQuiz(q.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Удалить тест">
                                    <Trash2 size={18} />
                                 </button>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>
         )}

         {/* ===== TAB: PROGRESS ===== */}
         {activeTab === 'progress' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex gap-2 flex-wrap items-center">
                     <button
                        onClick={() => setRoleFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                           roleFilter === 'ALL'
                              ? 'bg-korda-50 text-korda-700 border-korda-200 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                     >
                        Все
                     </button>
                     {([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.USER] as UserRole[]).map(role => (
                        <button
                           key={role}
                           onClick={() => setRoleFilter(role)}
                           className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border ${
                              roleFilter === role
                                 ? 'bg-korda-50 text-korda-700 border-korda-200 shadow-sm'
                                 : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                           }`}
                        >
                           {ROLE_NAMES[role]}
                        </button>
                     ))}
                     <div className="ml-auto">
                        <input
                           type="text"
                           placeholder="Поиск по имени..."
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                           className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none w-48 shadow-sm"
                        />
                     </div>
                  </div>
               </div>
               <div className="p-6">
                  {filteredProgressUsers.length === 0 && (
                     <div className="text-center text-slate-400 py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">Нет сотрудников с данной ролью</div>
                  )}
                  {filteredProgressUsers.map(user => {
                     const progress = getUserProgress(user.id);
                     const activeQuizzes = quizzes.filter(q => q.isActive);

                     // Stepped progress: highest difficulty passed at 100% gives 25/50/75/100%
                     const getQuizProgress = (quizId: string) => {
                        const qp = progress[quizId];
                        if (!qp) return 0;
                        let highest = 0;
                        for (const d of ALL_DIFFICULTIES) {
                           const data = qp[d];
                           if (data && data.bestScore === data.total) {
                              highest = DIFFICULTY_WEIGHT[d];
                           }
                        }
                        return highest;
                     };

                     const totalTests = activeQuizzes.length;
                     const overallProgress = totalTests > 0
                        ? Math.round(activeQuizzes.reduce((sum, q) => sum + getQuizProgress(q.id), 0) / totalTests)
                        : 0;
                     const progressColor = overallProgress >= 80 ? 'text-green-600' : overallProgress >= 50 ? 'text-korda-600' : overallProgress > 0 ? 'text-orange-500' : 'text-slate-400';
                     const progressBgColor = overallProgress >= 80 ? 'bg-green-500' : overallProgress >= 50 ? 'bg-korda-500' : overallProgress > 0 ? 'bg-orange-400' : 'bg-slate-200';

                     return (
                        <div key={user.id} className="mb-3 last:mb-0 border border-slate-200 rounded-xl overflow-hidden">
                           <button
                              onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                           >
                              <div className="flex items-center gap-2">
                                 <h3 className="font-bold text-slate-800">{user.lastName} {user.firstName}</h3>
                                 <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-medium">{ROLE_NAMES[user.role]}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-slate-200">
                                    <span className={`text-sm font-bold ${progressColor}`}>{overallProgress}%</span>
                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                       <div className={`h-full rounded-full transition-all ${progressBgColor}`} style={{ width: `${overallProgress}%` }} />
                                    </div>
                                 </div>
                                 <div className="text-slate-400">
                                    {expandedUserId === user.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                 </div>
                              </div>
                           </button>
                           {expandedUserId === user.id && (
                              <div className="overflow-x-auto border-t border-slate-200">
                                 <table className="w-full text-sm">
                                    <thead>
                                       <tr className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                          <th className="text-left px-4 py-3">Тест</th>
                                          {ALL_DIFFICULTIES.map(d => (
                                             <th key={d} className="text-center px-3 py-3 whitespace-nowrap">{DIFFICULTY_META[d].emoji} {DIFFICULTY_META[d].label}</th>
                                          ))}
                                          <th className="text-center px-3 py-3">Статус</th>
                                       </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                       {activeQuizzes.map(quiz => {
                                          const quizProgress = progress[quiz.id];
                                          const quizPct = getQuizProgress(quiz.id);
                                          const qpColor = quizPct >= 75 ? 'text-green-600 bg-green-100' : quizPct >= 50 ? 'text-korda-600 bg-korda-50' : quizPct > 0 ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-slate-100';

                                          return (
                                             <tr key={quiz.id} className={`hover:bg-slate-50 ${quizPct === 100 ? 'bg-green-50/30' : ''}`}>
                                                <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{quiz.topic}</td>
                                                {ALL_DIFFICULTIES.map(d => {
                                                   const data = quizProgress?.[d];
                                                   if (!data) {
                                                      return <td key={d} className="text-center px-3 py-3 text-slate-300">—</td>;
                                                   }
                                                   const pct = Math.round((data.bestScore / data.total) * 100);
                                                   const isPerfect = pct === 100;
                                                   return (
                                                      <td key={d} className="text-center px-3 py-3">
                                                         <div className="flex flex-col items-center gap-1">
                                                            <span className={`text-sm font-bold ${isPerfect ? 'text-green-600' : pct >= 70 ? 'text-korda-600' : 'text-red-500'}`}>
                                                               {isPerfect ? '✅' : `${pct}%`}
                                                            </span>
                                                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                               <div
                                                                  className={`h-full rounded-full ${isPerfect ? 'bg-green-500' : pct >= 70 ? 'bg-korda-500' : 'bg-red-400'}`}
                                                                  style={{ width: `${pct}%` }}
                                                               />
                                                            </div>
                                                         </div>
                                                      </td>
                                                   );
                                                })}
                                                <td className="text-center px-3 py-3">
                                                   <span className={`font-bold text-xs px-2 py-1 rounded-full ${qpColor}`}>
                                                      {quizPct === 100 ? '🏆 100%' : quizPct > 0 ? `${quizPct}%` : 'Не начат'}
                                                   </span>
                                                </td>
                                             </tr>
                                          );
                                       })}
                                    </tbody>
                                 </table>
                              </div>
                           )}
                        </div>
                     );
                  })}
               </div>
            </div>
         )}

         {/* ===== TAB: RESULTS ===== */}
         {activeTab === 'results' && (
            <div className="space-y-4">
               {/* Filters */}
               <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-4 items-center">
                     <div className="flex gap-1 items-center">
                        <span className="text-xs font-bold text-slate-500 mr-1">Сложность:</span>
                        <button onClick={() => setResultsDiffFilter('ALL')} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${resultsDiffFilter === 'ALL' ? 'bg-korda-50 text-korda-700 border-korda-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Все</button>
                        {ALL_DIFFICULTIES.map(d => (
                           <button key={d} onClick={() => setResultsDiffFilter(d)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${resultsDiffFilter === d ? `${DIFFICULTY_META[d].bgColor} ${DIFFICULTY_META[d].color} ${DIFFICULTY_META[d].borderColor}` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                              {DIFFICULTY_META[d].emoji} {DIFFICULTY_META[d].label}
                           </button>
                        ))}
                     </div>
                     <div className="flex gap-1 items-center">
                        <span className="text-xs font-bold text-slate-500 mr-1">Роль:</span>
                        <button onClick={() => setResultsRoleFilter('ALL')} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${resultsRoleFilter === 'ALL' ? 'bg-korda-50 text-korda-700 border-korda-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>Все</button>
                        {([UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPERVISOR, UserRole.MANAGER, UserRole.USER] as UserRole[]).map(role => (
                           <button key={role} onClick={() => setResultsRoleFilter(role)} className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${resultsRoleFilter === role ? 'bg-korda-50 text-korda-700 border-korda-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                              {ROLE_NAMES[role]}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>

               {quizzesWithSessions.length === 0 && (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                     <ClipboardList size={48} className="mx-auto text-slate-300 mb-3" />
                     <p className="text-lg font-medium text-slate-400">Нет результатов</p>
                     <p className="text-sm text-slate-400 mt-1">Когда сотрудники начнут проходить тесты, результаты появятся здесь</p>
                  </div>
               )}
               {quizzes.map(quiz => {
                  const allSessionsForQuiz = quizSessions.filter(s => s.quizId === quiz.id && s.status === 'COMPLETED');
                  // Apply filters
                  const sessionsForQuiz = allSessionsForQuiz.filter(s => {
                     if (resultsDiffFilter !== 'ALL' && s.difficulty !== resultsDiffFilter) return false;
                     if (resultsRoleFilter !== 'ALL') {
                        const sessionUser = users.find(u => u.id === s.userId);
                        if (sessionUser && sessionUser.role !== resultsRoleFilter) return false;
                     }
                     return true;
                  });
                  if (sessionsForQuiz.length === 0) return null;

                  const totalScorePct = sessionsForQuiz.reduce((acc, s) => {
                     const qCount = s.questions?.length || 0;
                     if (qCount === 0) return acc;
                     return acc + (s.score / qCount);
                  }, 0);
                  const avgScore = sessionsForQuiz.length > 0 ? Math.round((totalScorePct / sessionsForQuiz.length) * 100) : 0;
                  const totalDisputes = allSessionsForQuiz.reduce((acc, s) => acc + Object.keys(s.disputes || {}).length, 0);
                  const isExpanded = expandedQuizId === quiz.id;

                  return (
                     <div key={quiz.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <button onClick={() => toggleExpandQuiz(quiz.id)} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                           <div className="flex items-center gap-4">
                              <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm text-korda-500">
                                 <FileQuestion size={20} />
                              </div>
                              <div className="text-left">
                                 <h3 className="font-bold text-slate-800">{quiz.topic}</h3>
                                 <div className="flex gap-2 text-xs mt-1">
                                    <span className="text-slate-500">{sessionsForQuiz.length} прохождений</span>
                                    <span className="text-slate-300">|</span>
                                    <span className={`${avgScore >= 70 ? 'text-green-600' : 'text-orange-500'} font-medium`}>Средний балл: {avgScore}%</span>
                                    {totalDisputes > 0 && (
                                       <><span className="text-slate-300">|</span><span className="text-orange-500 font-medium flex items-center gap-0.5"><Zap size={12} /> {totalDisputes} споров</span></>
                                    )}
                                 </div>
                              </div>
                           </div>
                           <div className="text-slate-400">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                           </div>
                        </button>

                        {isExpanded && (
                           <div className="border-t border-slate-200 bg-white">
                              <table className="w-full text-left text-sm text-slate-600">
                                 <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                                    <tr>
                                       <th className="px-6 py-3">Сотрудник</th>
                                       <th className="px-6 py-3">Сложность</th>
                                       <th className="px-6 py-3">Дата</th>
                                       <th className="px-6 py-3">Результат</th>
                                       <th className="px-6 py-3 text-right">Действия</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {sessionsForQuiz.map(rawSession => {
                                       const session = localSessions[rawSession.id] || rawSession;
                                       const isSessionExpanded = expandedSessionId === session.id;
                                       const qCount = session.questions?.length || 0;
                                       const scorePct = qCount > 0 ? Math.round((session.score / qCount) * 100) : 0;
                                       const completedDate = session.completedAt ? new Date(session.completedAt).toLocaleDateString() : 'Н/Д';
                                       const diffMeta = session.difficulty ? DIFFICULTY_META[session.difficulty] : null;
                                       const sessionDisputes = Object.keys(session.disputes || {}).length;

                                       return (
                                          <React.Fragment key={session.id}>
                                             <tr className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-bold text-slate-800">{session.lastName} {session.firstName}</td>
                                                <td className="px-6 py-3">
                                                   {diffMeta ? (
                                                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${diffMeta.bgColor} ${diffMeta.color} border ${diffMeta.borderColor}`}>
                                                         {diffMeta.emoji} {diffMeta.label}
                                                      </span>
                                                   ) : (
                                                      <span className="text-xs text-slate-400">—</span>
                                                   )}
                                                </td>
                                                <td className="px-6 py-3">{completedDate}</td>
                                                <td className="px-6 py-3">
                                                   <div className="flex items-center gap-2">
                                                      <span className={`px-2 py-1 rounded text-xs font-bold ${scorePct >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                         {scorePct}% ({session.score}/{qCount})
                                                      </span>
                                                      {sessionDisputes > 0 && (
                                                         <span className="text-xs text-orange-500 font-medium flex items-center gap-0.5">
                                                            <Zap size={12} /> {sessionDisputes}
                                                         </span>
                                                      )}
                                                   </div>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                   <div className="flex justify-end gap-2">
                                                      {scorePct < 100 && (
                                                         <button onClick={(e) => { e.stopPropagation(); handleOverrideScore(session); }} className="text-slate-400 hover:text-green-600 bg-slate-100 p-1.5 rounded-lg hover:bg-green-50 transition-colors" title="Засчитать 100%">
                                                            <Award size={16} />
                                                         </button>
                                                      )}
                                                      <button onClick={(e) => { e.stopPropagation(); handleResetSession(session.id); }} className="text-slate-400 hover:text-orange-600 bg-slate-100 p-1.5 rounded-lg hover:bg-orange-100 transition-colors" title="Сбросить результат">
                                                         <RotateCcw size={16} />
                                                      </button>
                                                      <button onClick={(e) => { e.stopPropagation(); setExpandedSessionId(isSessionExpanded ? null : session.id); }} className="text-slate-400 hover:text-korda-600 bg-slate-100 p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                                         {isSessionExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                      </button>
                                                   </div>
                                                </td>
                                             </tr>
                                             {isSessionExpanded && (
                                                <tr>
                                                   <td colSpan={5} className="bg-slate-50 p-6 shadow-inner">
                                                      <div className="space-y-4">
                                                         {session.questions?.map((q, idx) => {
                                                            const userAns = session.userAnswers?.[idx];
                                                            const isCorrect = userAns === q.correctOptionIndex;
                                                            const explanation = session.explanations?.[idx];
                                                            const isDisputed = session.disputes?.[idx];
                                                            const explainKey = `${session.id}-${idx}`;
                                                            const isExplaining = loadingExplanation === explainKey;
                                                            return (
                                                               <div key={idx} className={`p-4 rounded-xl border ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                                                  <p className="font-bold text-slate-800 mb-3 flex gap-2 items-start">
                                                                     <span className="text-slate-400">{idx + 1}.</span>
                                                                     <span className="flex-1">{q.questionText}</span>
                                                                     {isDisputed && (
                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full shrink-0">
                                                                           <Zap size={10} /> Спор
                                                                        </span>
                                                                     )}
                                                                  </p>
                                                                  <ul className="space-y-2 text-sm ml-4">
                                                                     {q.options.map((opt, oIdx) => (
                                                                        <li key={oIdx} className={`
                                                                           px-3 py-2 rounded-lg border
                                                                           ${oIdx === q.correctOptionIndex ? 'bg-green-100 border-green-200 text-green-800 font-medium' : 'border-transparent'}
                                                                           ${oIdx === userAns && !isCorrect ? 'bg-red-100 border-red-200 text-red-800 line-through' : ''}
                                                                           ${oIdx !== q.correctOptionIndex && oIdx !== userAns ? 'text-slate-500' : ''}
                                                                        `}>
                                                                           {opt}
                                                                        </li>
                                                                     ))}
                                                                  </ul>
                                                                  {/* Admin: explanation + why button */}
                                                                  {!isCorrect && (
                                                                     <div className="ml-4 mt-3 space-y-2">
                                                                        {explanation ? (
                                                                           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex gap-2">
                                                                              <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                                                              <span>{explanation}</span>
                                                                           </div>
                                                                        ) : (
                                                                           <button
                                                                              onClick={() => handleAdminExplain(session, idx)}
                                                                              disabled={isExplaining}
                                                                              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200 transition-colors disabled:opacity-50"
                                                                           >
                                                                              {isExplaining ? (
                                                                                 <><Loader2 size={12} className="animate-spin" /> Генерация...</>
                                                                              ) : (
                                                                                 <><HelpCircle size={12} /> Почему?</>
                                                                              )}
                                                                           </button>
                                                                        )}
                                                                     </div>
                                                                  )}
                                                               </div>
                                                            );
                                                         }) || <p>Нет данных о вопросах</p>}
                                                      </div>
                                                   </td>
                                                </tr>
                                             )}
                                          </React.Fragment>
                                       );
                                    })}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>
                  );
               })}
            </div>
         )}
      </div>
   );
};
