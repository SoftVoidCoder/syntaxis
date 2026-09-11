import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getServerLogsFromFirebase } from '../../services/firebaseService';
import { callProxy } from '../../services/geminiCore';
import { FolderOpen, Clock, User, AlertTriangle, Calendar, Activity, X, Search, ChevronRight, Copy, ArrowDownAZ, Hash, Sparkles, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ServerLog {
   id: string;
   user: string;
   file: string;
   fullPath: string;
   action: string;
   time: string; // "2026-05-14 19:21:50"
   timestamp: number;
   serverReceivedAt: number;
}

interface UserActivity {
   user: string;
   totalOpens: number;
   uniqueFilesCount: number;
   firstActivityTimeStr: string;
   lastActivityTimeStr: string; 
   workDurationMinutes: number;
   pureWorkDurationMinutes: number;
   breaksSummary: { short: number, medium: number, long: number };
   breaksList: { startStr: string; endStr: string; durationMinutes: number; type: 'short' | 'medium' | 'long'; filesBefore: string[] }[];
   logs: ServerLog[];
   uniqueFilesList: { 
      file: string; 
      fullPath: string; 
      count: number; 
      lastTimeStr: string;
      firstTimeStr: string;
      lastTimeNum: number; // for sorting only
      dirCategory: string;
   }[];
   formatCounts: { ext: string; count: number }[];
   dirCounts: { dir: string; count: number }[];
}

// Helpers
const formatDuration = (minutes: number) => {
   if (minutes < 1) return 'Менее минуты';
   const h = Math.floor(minutes / 60);
   const m = Math.floor(minutes % 60);
   if (h === 0) return `${m} мин`;
   return `${h} ч ${m} мин`;
};

const getDurationColor = (minutes: number) => {
   if (minutes < 270) return 'text-red-500 font-bold'; // < 4.5h
   if (minutes < 390) return 'text-amber-500 font-bold'; // 4.5h - 6.5h
   return 'text-emerald-600 font-bold'; // >= 6.5h
};

const getCategoryFromPath = (fullPath: string) => {
   const parts = fullPath.split('\\');
   const rootIndex = parts.findIndex(p => p.toLowerCase() === 'отдел промышленного пошива');
   if (rootIndex !== -1 && rootIndex + 1 < parts.length) {
      if (rootIndex + 1 === parts.length - 1) {
          return 'Корневая папка';
      }
      return parts[rootIndex + 1];
   }
   if (parts.length > 2) {
      return parts[parts.length - 2];
   }
   return 'Неизвестно';
};

const getTodayString = () => {
   const d = new Date();
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const AdminFileMonitor: React.FC = () => {
   const [logs, setLogs] = useState<ServerLog[]>([]);
   const [loading, setLoading] = useState(true);
   
   // Date selection
   const todayString = getTodayString();
   const [selectedDate, setSelectedDate] = useState<string>(todayString);
   
   // Modal selection & sort
   const [selectedUser, setSelectedUser] = useState<UserActivity | null>(null);
   const [modalSearch, setModalSearch] = useState('');
   const [modalSort, setModalSort] = useState<'timeDesc' | 'countDesc'>('timeDesc');
   const [modalFormatFilter, setModalFormatFilter] = useState<string | null>(null);
   const [modalDirFilter, setModalDirFilter] = useState<string | null>(null);
   const [showBreaksDetail, setShowBreaksDetail] = useState(false);
   const [expandedBreakIdx, setExpandedBreakIdx] = useState<number | null>(null);

   // AI Chat State
   const [aiChatHistory, setAiChatHistory] = useState<Record<string, { role: 'user' | 'model', text: string }[]>>({});
   const [aiChatUser, setAiChatUser] = useState<UserActivity | null>(null);
   const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
   const [aiChatInput, setAiChatInput] = useState('');
   const [aiChatLoading, setAiChatLoading] = useState(false);
   const chatEndRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
   }, [aiChatMessages]);

    const handleAiAnalyze = async (user: UserActivity, e?: React.MouseEvent) => {
       if (e) e.stopPropagation();
       setAiChatUser(user);
       
       if (aiChatHistory[user.user]) {
           setAiChatMessages(aiChatHistory[user.user]);
           return;
       }

       setAiChatMessages([]);
       setAiChatLoading(true);

       const promptContext = `
Проанализируй рабочий день сотрудника: ${user.user}
Общее число открытий файлов: ${user.totalOpens}
Уникальных файлов: ${user.uniqueFilesCount}
Интервал активности: ${user.firstActivityTimeStr} - ${user.lastActivityTimeStr}
Грязное время за ПК: ${formatDuration(user.workDurationMinutes)}
Чистое время работы (за вычетом долгих простоев): ${formatDuration(user.pureWorkDurationMinutes)}
Перерывы (09:00 - 18:00): Коротких: ${user.breaksSummary.short}, Средних: ${user.breaksSummary.medium}, Долгих: ${user.breaksSummary.long}

Детализация перерывов:
${user.breaksList.map(b => `- ${b.startStr}-${b.endStr} (${b.durationMinutes} мин). Файлы перед паузой:\n  ${b.filesBefore.join('\n  ')}`).join('\n')}

Топ 5 форматов файлов: ${user.formatCounts.slice(0,5).map(f => `${f.ext}(${f.count})`).join(', ')}
Топ 5 папок (категорий): ${user.dirCounts.slice(0,5).map(d => `${d.dir}(${d.count})`).join(', ')}

Инструкция:
В ПЕРВУЮ ОЧЕРЕДЬ проанализируй перерывы. Определи, чем занимался сотрудник во время этих пауз, основываясь на последних 3-х открытых файлах перед уходом (например, долгие паузы после открытия чертежа могут означать глубокое проектирование, а после картинки - реальный отдых). Ищи потенциальные артефакты в поведении и связывай их с контекстом.
Далее, опираясь на количество и типы файлов, дай действительную оценку происходящего, а не просто пересказ. Сделай аргументированные выводы о продуктивности, стиле работы и возможных проблемах. Обращайся ко мне как к руководителю, тон аналитический и профессиональный. Используй Markdown (жирный шрифт, списки) для структурирования ответа. В ходе рассуждений используй короткие имена файлов для удобства чтения, но В САМОМ КОНЦЕ ответа обязательно добавь блок "Связанные файлы (Полные пути)", в котором перечисли полные пути ко всем файлам, которые ты упомянул в анализе.
`;

       try {
          const result = await callProxy('generateContent', {
              model: 'gemini-3-flash-preview',
              contents: [{ role: 'user', parts: [{ text: promptContext }] }],
              config: { temperature: 0.2 }
          });
          
          if (result.text) {
              const newMsgs: {role: 'user'|'model', text: string}[] = [
                 { role: 'user', text: "[Скрытый системный контекст с данными рабочего дня отправлен для анализа]" },
                 { role: 'model', text: result.text }
              ];
              setAiChatMessages(newMsgs);
              setAiChatHistory(prev => ({ ...prev, [user.user]: newMsgs }));
          }
       } catch (err) {
         console.error("AI Analysis failed:", err);
         setAiChatMessages([{ role: 'model', text: "Ошибка при получении анализа от AI." }]);
      } finally {
         setAiChatLoading(false);
      }
   };

   const handleSendAiMessage = async () => {
      if (!aiChatInput.trim() || !aiChatUser) return;
      const newMsg = aiChatInput.trim();
      setAiChatInput('');
      
      const updatedMessages = [...aiChatMessages, { role: 'user', text: newMsg } as const];
      setAiChatMessages(updatedMessages);
      setAiChatHistory(prev => ({ ...prev, [aiChatUser.user]: updatedMessages }));
      setAiChatLoading(true);

      const contents = updatedMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
      }));

      try {
         const result = await callProxy('generateContent', {
             model: 'gemini-3-flash-preview',
             contents,
             config: { temperature: 0.4 }
         });
         if (result.text) {
             const finalMsgs: {role: 'user'|'model', text: string}[] = [...updatedMessages, { role: 'model', text: result.text }];
             setAiChatMessages(finalMsgs);
             setAiChatHistory(prev => ({ ...prev, [aiChatUser.user]: finalMsgs }));
         }
      } catch (err) {
         const errMsgs: {role: 'user'|'model', text: string}[] = [...updatedMessages, { role: 'model', text: "Ошибка соединения с AI." }];
         console.error("AI Chat failed:", err);
         setAiChatMessages(errMsgs);
         setAiChatHistory(prev => ({ ...prev, [aiChatUser.user]: errMsgs }));
      } finally {
         setAiChatLoading(false);
      }
   };

   const fetchLogs = async () => {
      setLoading(true);
      try {
         const data = await getServerLogsFromFirebase();
         setLogs(data);
      } catch (e) {
         console.error(e);
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      fetchLogs();
   }, []);

   // 1. Data Aggregation
   const aggregatedData = useMemo(() => {
      // Filter by selected date (STRICTLY string-based from server to avoid timezone shifts across midnight)
      const dayLogs = logs.filter(log => {
         if (!log.time) return false;
         
         const fileNameLower = log.file.toLowerCase();
         // Filter out system and application artifacts
         if (
            fileNameLower.endsWith('.lnk') || 
            fileNameLower.endsWith('.tmp') || 
            fileNameLower.endsWith('.ini') ||
            fileNameLower === 'thumbs.db' || 
            fileNameLower === 'desktop.ini' ||
            fileNameLower === '.ds_store' ||
            fileNameLower.startsWith('~$')
         ) {
            return false; 
         }
         
         const logDay = log.time.substring(0, 10);
         return logDay === selectedDate;
      });

      // Group by user
      const userMap = new Map<string, ServerLog[]>();
      dayLogs.forEach(log => {
         if (!userMap.has(log.user)) userMap.set(log.user, []);
         userMap.get(log.user)!.push(log);
      });

      const activities: UserActivity[] = [];

      userMap.forEach((userLogsRaw, username) => {
         // Sort user logs chronologically by string
         userLogsRaw.sort((a, b) => a.time.localeCompare(b.time));

         const userLogs = userLogsRaw;

         if (userLogs.length === 0) return;

         const firstLog = userLogs[0];
         const lastLog = userLogs[userLogs.length - 1];
         
         const firstActivityTimeStr = firstLog.time.substring(11, 16);
         const lastActivityTimeStr = lastLog.time.substring(11, 16);
         
         const workDurationMinutes = Math.round((lastLog.timestamp - firstLog.timestamp) / 60000);
         let pureWorkDurationMinutes = workDurationMinutes;
         const breaksSummary = { short: 0, medium: 0, long: 0 };
         const breaksList: UserActivity['breaksList'] = [];

         for (let i = 1; i < userLogs.length; i++) {
             const gapMinutes = (userLogs[i].timestamp - userLogs[i-1].timestamp) / 60000;
             if (gapMinutes > 30) {
                 pureWorkDurationMinutes -= gapMinutes;
             }
             
             // Break analytics strictly between 09:00 and 18:00
             if (gapMinutes > 15) {
                 const gapStartTime = new Date(userLogs[i-1].timestamp);
                 const h = gapStartTime.getHours();
                 if (h >= 9 && h < 18) {
                     let type: 'short' | 'medium' | 'long' = 'short';
                     if (gapMinutes <= 30) { breaksSummary.short++; type = 'short'; }
                     else if (gapMinutes <= 60) { breaksSummary.medium++; type = 'medium'; }
                     else { breaksSummary.long++; type = 'long'; }
                     const filesBeforeSet = new Set<string>();
                     for (let j = i - 1; j >= 0 && filesBeforeSet.size < 3; j--) {
                         filesBeforeSet.add(userLogs[j].fullPath);
                     }

                     breaksList.push({
                         startStr: userLogs[i-1].time.substring(11, 16),
                         endStr: userLogs[i].time.substring(11, 16),
                         durationMinutes: Math.round(gapMinutes),
                         type,
                         filesBefore: Array.from(filesBeforeSet)
                     });
                 }
             }
         }
         
         if (pureWorkDurationMinutes < 0) pureWorkDurationMinutes = 0;

         // Group unique files
         const filesMap = new Map<string, UserActivity['uniqueFilesList'][0]>();
         userLogs.forEach(l => {
            const timeStr = l.time.substring(11, 16);
            if (!filesMap.has(l.fullPath)) {
               filesMap.set(l.fullPath, { 
                  file: l.file, 
                  fullPath: l.fullPath, 
                  count: 0, 
                  lastTimeStr: timeStr,
                  firstTimeStr: timeStr,
                  lastTimeNum: l.timestamp,
                  dirCategory: getCategoryFromPath(l.fullPath)
               });
            }
            const f = filesMap.get(l.fullPath)!;
            f.count++;
            
            // Because userLogs is already sorted chronologically, the last log we process for this file is the latest.
            f.lastTimeStr = timeStr;
            f.lastTimeNum = l.timestamp;
         });

         const formatMap = new Map<string, number>();
         const dirMap = new Map<string, number>();
         Array.from(filesMap.values()).forEach(f => {
            const lastDotIndex = f.file.lastIndexOf('.');
            let ext = 'unknown';
            if (lastDotIndex > 0) {
               const possibleExt = f.file.substring(lastDotIndex + 1).toLowerCase();
               if (/^[a-z0-9]{1,10}$/i.test(possibleExt) && !/^\d+$/.test(possibleExt)) {
                  ext = possibleExt;
               }
            }
            formatMap.set(ext, (formatMap.get(ext) || 0) + 1);
            
            dirMap.set(f.dirCategory, (dirMap.get(f.dirCategory) || 0) + 1);
         });
         
         const formatCounts = Array.from(formatMap.entries())
            .map(([ext, count]) => ({ ext, count }))
            .sort((a, b) => b.count - a.count);
            
         const dirCounts = Array.from(dirMap.entries())
            .map(([dir, count]) => ({ dir, count }))
            .sort((a, b) => b.count - a.count);

         activities.push({
            user: username,
            totalOpens: userLogs.length,
            uniqueFilesCount: filesMap.size,
            firstActivityTimeStr,
            lastActivityTimeStr,
            workDurationMinutes,
            pureWorkDurationMinutes,
            breaksSummary,
            breaksList,
            logs: userLogs,
            uniqueFilesList: Array.from(filesMap.values()),
            formatCounts,
            dirCounts
         });
      });

      // Sort activities by total unique files first
      return activities.sort((a, b) => b.uniqueFilesCount - a.uniqueFilesCount);
   }, [logs, selectedDate]);

   // Overall Day Stats
   const totalDayEvents = aggregatedData.reduce((acc, a) => acc + a.totalOpens, 0);
   const totalDayUniqueFiles = aggregatedData.reduce((acc, a) => acc + a.uniqueFilesCount, 0);

   // Modal Filtering and Sorting
   
   const dynamicFormatCounts = useMemo(() => {
      if (!selectedUser) return [];
      let list = selectedUser.uniqueFilesList;
      if (modalDirFilter) {
          list = list.filter(f => f.dirCategory === modalDirFilter);
      }
      const map = new Map<string, number>();
      list.forEach(f => {
         const lastDotIndex = f.file.lastIndexOf('.');
         let ext = 'unknown';
         if (lastDotIndex > 0) {
            const possibleExt = f.file.substring(lastDotIndex + 1).toLowerCase();
            if (/^[a-z0-9]{1,10}$/i.test(possibleExt) && !/^\d+$/.test(possibleExt)) {
               ext = possibleExt;
            }
         }
         map.set(ext, (map.get(ext) || 0) + 1);
      });
      return Array.from(map.entries()).map(([ext, count]) => ({ ext, count })).sort((a, b) => b.count - a.count);
   }, [selectedUser, modalDirFilter]);

   const dynamicDirCounts = useMemo(() => {
      if (!selectedUser) return [];
      let list = selectedUser.uniqueFilesList;
      if (modalFormatFilter) {
          list = list.filter(f => {
             const lastDotIndex = f.file.lastIndexOf('.');
             const ext = lastDotIndex > 0 ? f.file.substring(lastDotIndex + 1).toLowerCase() : 'unknown';
             return ext === modalFormatFilter;
          });
      }
      const map = new Map<string, number>();
      list.forEach(f => {
         map.set(f.dirCategory, (map.get(f.dirCategory) || 0) + 1);
      });
      return Array.from(map.entries()).map(([dir, count]) => ({ dir, count })).sort((a, b) => b.count - a.count);
   }, [selectedUser, modalFormatFilter]);

   const filteredModalFiles = useMemo(() => {
      if (!selectedUser) return [];
      let list = [...selectedUser.uniqueFilesList];

      if (modalSearch) {
         const lowerQ = modalSearch.toLowerCase();
         list = list.filter(f => f.file.toLowerCase().includes(lowerQ) || f.fullPath.toLowerCase().includes(lowerQ));
      }

      if (modalFormatFilter) {
         list = list.filter(f => {
            const lastDotIndex = f.file.lastIndexOf('.');
            const ext = lastDotIndex > 0 ? f.file.substring(lastDotIndex + 1).toLowerCase() : 'unknown';
            return ext === modalFormatFilter;
         });
      }
      
      if (modalDirFilter) {
         list = list.filter(f => f.dirCategory === modalDirFilter);
      }

      return list.sort((a, b) => {
         if (modalSort === 'timeDesc') return b.lastTimeNum - a.lastTimeNum;
         if (modalSort === 'countDesc') return b.count - a.count;
         return 0;
      });
   }, [selectedUser, modalSearch, modalSort, modalFormatFilter, modalDirFilter]);

   // Date Navigation Helpers
   const changeDate = (daysOffset: number) => {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      dateObj.setDate(dateObj.getDate() + daysOffset);
      const newDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      setSelectedDate(newDateStr);
   };

   return (
      <div className="space-y-6 pb-20">
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
               <h2 className="text-2xl font-black text-slate-800 tracking-tight">Активность пользователей</h2>
               <p className="text-sm text-slate-500 font-medium mt-1">Теневой аудит файлового сервера</p>
            </div>
            <div className="flex items-center gap-2">
               <button 
                  onClick={() => setSelectedDate(todayString)} 
                  className={`px-3 py-2 text-sm font-bold rounded-xl transition-colors shadow-sm border hidden sm:block ${selectedDate === todayString ? 'bg-korda-50 text-korda-700 border-korda-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
               >
                  Сегодня
               </button>
               <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                  <button onClick={() => changeDate(-1)} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">← Назад</button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <input 
                     type="date" 
                     value={selectedDate}
                     onChange={(e) => setSelectedDate(e.target.value)}
                     className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer px-2"
                  />
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button onClick={() => changeDate(1)} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">Вперед →</button>
               </div>
               <Button onClick={fetchLogs} disabled={loading} variant="primary" className="py-2.5">
                  {loading ? 'Обновление...' : 'Обновить'}
               </Button>
            </div>
         </div>

         {/* Summary Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-5 shadow-sm text-white flex flex-col justify-between">
               <div className="flex items-center gap-3 mb-2 opacity-90">
                  <Calendar size={20} />
                  <h3 className="font-bold">Выбранный день</h3>
               </div>
               <div>
                  <div className="text-3xl font-black">{selectedDate}</div>
                  <div className="text-indigo-100 text-sm mt-1 font-medium">{aggregatedData.length} активных сотрудников</div>
               </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
               <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                     <FolderOpen size={16} />
                  </div>
                  <h3 className="font-bold text-slate-700">Чтений файлов</h3>
               </div>
               <div>
                  <div className="text-3xl font-black text-slate-800">{totalDayUniqueFiles}</div>
                  <div className="text-slate-400 text-sm mt-1 font-medium">Зафиксировано за этот день</div>
               </div>
            </div>
         </div>

         {/* User Cards Grid */}
         <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
               <User className="text-indigo-500" size={20} />
               Сотрудники ({aggregatedData.length})
            </h3>
            
            {aggregatedData.length === 0 ? (
               <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-12 text-center">
                  <FolderOpen className="mx-auto text-slate-300 mb-3" size={32} />
                  <h4 className="text-lg font-bold text-slate-600">Нет активности</h4>
                  <p className="text-slate-400 mt-1">В этот день никто не открывал файлы на сервере.</p>
               </div>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {aggregatedData.map(stat => (
                      <div 
                         key={stat.user} 
                         onClick={() => { setSelectedUser(stat); setModalSearch(''); setModalFormatFilter(null); setModalDirFilter(null); setShowBreaksDetail(false); }}
                         className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 cursor-pointer transition-all group flex flex-col relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4 relative z-10">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm">
                                 {stat.user.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="font-bold text-slate-800 truncate max-w-[120px]" title={stat.user}>{stat.user}</div>
                           </div>
                           <div className="flex items-center gap-1.5">
                              <button 
                                 onClick={(e) => handleAiAnalyze(stat, e)}
                                 className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                                 title="AI Анализ сотрудника"
                              >
                                 <Sparkles size={16} />
                              </button>
                              <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-auto relative z-10">
                           <div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1" title="Чтения файлов">Чтения</div>
                              <div className="text-xl font-black text-indigo-600">{stat.uniqueFilesCount}</div>
                           </div>
                           <div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Интервал</div>
                              <div className="text-sm font-black text-slate-700 mt-1">{stat.firstActivityTimeStr === stat.lastActivityTimeStr ? stat.firstActivityTimeStr : `${stat.firstActivityTimeStr} - ${stat.lastActivityTimeStr}`}</div>
                           </div>
                        </div>

                        {stat.breaksSummary.long > 0 && (
                           <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg w-max" title="Зафиксировано отсутствие более часа">
                              <AlertTriangle size={14} className="mb-0.5" />
                              Отсутствие более часа: {stat.breaksSummary.long}
                           </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between text-xs font-medium text-slate-500 relative z-10">
                           <div className="flex items-center gap-1" title={`Интервал: ${formatDuration(stat.workDurationMinutes)}`}><Clock size={12}/> Общее время:</div>
                           <div className={`flex items-center gap-1 ${getDurationColor(stat.pureWorkDurationMinutes)}`} title={`Интервал: ${formatDuration(stat.workDurationMinutes)}`}>{formatDuration(stat.pureWorkDurationMinutes)}</div>
                        </div>
                     </div>
                  ))}
               </div>
            )}
         </div>

         {/* Info Box */}
         <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 items-start mt-8">
            <AlertTriangle className="text-blue-500 shrink-0 mt-0.5" size={18} />
            <div className="text-sm text-blue-800">
               Скрытый агент собирает данные с сервера каждые 10 минут. Логируются только открытия файлов.
            </div>
         </div>

         {/* DETAIL MODAL */}
         {selectedUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  
                  {/* Modal Header */}
                  <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg">
                           {selectedUser.user.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                           <h2 className="text-xl font-black text-slate-800">{selectedUser.user}</h2>
                           <p className="text-sm text-slate-500 font-medium">Активность за {selectedDate}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <button 
                           onClick={() => handleAiAnalyze(selectedUser)}
                           className="hidden sm:flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold text-sm transition-colors border border-indigo-100 shadow-sm"
                        >
                           <Sparkles size={16} />
                           Анализ ИИ
                        </button>
                        <button 
                           onClick={() => setSelectedUser(null)}
                           className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                           <X size={20} />
                        </button>
                     </div>
                  </div>

                  {/* Modal Stats Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-slate-100 bg-white">
                     <div className="p-4 border-r border-slate-100">
                        <div className="text-xs font-bold text-slate-400 uppercase">Чтений файлов</div>
                        <div className="text-xl font-black text-indigo-600 mt-1">{selectedUser.uniqueFilesCount}</div>
                     </div>
                     <div className="p-4 border-r border-slate-100">
                        <div className="text-xs font-bold text-slate-400 uppercase">Период активности</div>
                        <div className="text-lg font-bold text-slate-700 mt-1">{selectedUser.firstActivityTimeStr} - {selectedUser.lastActivityTimeStr}</div>
                     </div>
                     <div className="p-4">
                        <div className="text-xs font-bold text-slate-400 uppercase">Чистое время работы</div>
                        <div className="text-lg font-bold text-slate-700 mt-1" title={`С момента первого до последнего клика: ${formatDuration(selectedUser.workDurationMinutes)}`}>
                           {formatDuration(selectedUser.pureWorkDurationMinutes)}
                        </div>
                     </div>
                  </div>

                  {/* Modal Breaks Analytics */}
                  {(selectedUser.breaksSummary.short > 0 || selectedUser.breaksSummary.medium > 0 || selectedUser.breaksSummary.long > 0) && (
                     <div className="bg-slate-50 border-b border-slate-100 flex flex-col">
                        <div 
                           className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                           onClick={() => setShowBreaksDetail(!showBreaksDetail)}
                        >
                           <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-600">Перерывы (09:00 - 18:00):</span>
                              <ChevronRight size={16} className={`text-slate-400 transition-transform ${showBreaksDetail ? 'rotate-90' : ''}`} />
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2" title="Короткие отлучки (15-30 мин)">
                                 <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                 <span className="text-xs font-bold text-slate-600">{selectedUser.breaksSummary.short} коротких</span>
                              </div>
                              <div className="flex items-center gap-2" title="Средние перерывы (30-60 мин)">
                                 <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                 <span className="text-xs font-bold text-slate-600">{selectedUser.breaksSummary.medium} средних</span>
                              </div>
                              <div className="flex items-center gap-2" title="Отсутствие (>60 мин)">
                                 <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                 <span className="text-xs font-bold text-red-600">{selectedUser.breaksSummary.long} долгих</span>
                              </div>
                           </div>
                        </div>
                        
                        {showBreaksDetail && (
                           <div className="px-6 pb-4 pt-1 animate-in slide-in-from-top-2 duration-200">
                              <div className="flex flex-wrap gap-2">
                                 {selectedUser.breaksList.map((brk, idx) => {
                                    const bgColor = brk.type === 'short' ? 'bg-slate-100 text-slate-600 border-slate-200' 
                                       : brk.type === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200'
                                       : 'bg-red-50 text-red-700 border-red-200';
                                    const dotColor = brk.type === 'short' ? 'bg-slate-300' 
                                       : brk.type === 'medium' ? 'bg-amber-400'
                                       : 'bg-red-500';
                                       
                                    return (
                                       <div key={idx} className={`flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-bold ${bgColor} group relative cursor-pointer`}>
                                          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                                          {brk.startStr} - {brk.endStr}
                                          <span className="opacity-60 ml-1">({brk.durationMinutes} мин)</span>
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                        )}
                     </div>
                  )}

                  {/* Modal Dir Breakdown */}
                  {dynamicDirCounts.length > 0 && (
                     <div className="px-6 py-3 bg-white border-b border-slate-100 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase mr-2">Категории:</span>
                        
                        <button 
                           onClick={() => setModalDirFilter(null)}
                           className={`px-3 py-1 border rounded-md text-xs font-bold shadow-sm transition-all ${
                              modalDirFilter === null 
                              ? 'bg-emerald-500 border-emerald-600 text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
                           }`}
                        >
                           ВСЕ
                        </button>
                        
                        {dynamicDirCounts.map(d => (
                           <button 
                              key={d.dir} 
                              onClick={() => setModalDirFilter(d.dir)}
                              className={`px-2 py-1 border rounded-md text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all max-w-[200px] sm:max-w-[300px] ${
                                 modalDirFilter === d.dir 
                                 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                                 : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200'
                              }`}
                           >
                              <span className={`truncate ${modalDirFilter === d.dir ? 'text-emerald-600' : 'text-emerald-500'}`} title={d.dir}>{d.dir}</span>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded ${modalDirFilter === d.dir ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.count}</span>
                           </button>
                        ))}
                     </div>
                  )}

                  {/* Modal Format Breakdown */}
                  {dynamicFormatCounts.length > 0 && (
                     <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-2 items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase mr-2">Форматы:</span>
                        
                        <button 
                           onClick={() => setModalFormatFilter(null)}
                           className={`px-3 py-1 border rounded-md text-xs font-bold shadow-sm transition-all ${
                              modalFormatFilter === null 
                              ? 'bg-indigo-500 border-indigo-600 text-white' 
                              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                           }`}
                        >
                           ВСЕ
                        </button>
                        
                        {dynamicFormatCounts.map(f => (
                           <button 
                              key={f.ext} 
                              onClick={() => setModalFormatFilter(f.ext)}
                              className={`px-2 py-1 border rounded-md text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all ${
                                 modalFormatFilter === f.ext 
                                 ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                                 : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-200'
                              }`}
                           >
                              <span className={`uppercase ${modalFormatFilter === f.ext ? 'text-indigo-600' : 'text-indigo-500'}`}>{f.ext}</span>
                              <span className={`px-1.5 py-0.5 rounded ${modalFormatFilter === f.ext ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
                           </button>
                        ))}
                     </div>
                  )}

                  {/* Modal Search and Filters */}
                  <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3">
                     <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                           type="text"
                           placeholder="Поиск по имени файла или пути..."
                           value={modalSearch}
                           onChange={(e) => setModalSearch(e.target.value)}
                           className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                     </div>
                     
                     <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200">
                        <button
                           onClick={() => setModalSort('timeDesc')}
                           className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${modalSort === 'timeDesc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                           <ArrowDownAZ size={14} /> По времени
                        </button>
                        <button
                           onClick={() => setModalSort('countDesc')}
                           className={`px-3 py-1.5 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-colors ${modalSort === 'countDesc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                           <Hash size={14} /> По частоте
                        </button>
                     </div>
                  </div>

                  {/* Modal File List */}
                  <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                     {filteredModalFiles.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-medium">Ничего не найдено</div>
                     ) : (
                        <div className="space-y-3">
                           {filteredModalFiles.map((file, idx) => (
                              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:border-indigo-200 transition-colors">
                                 <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 min-w-0">
                                       <div className="mt-1">
                                          <FolderOpen className="text-blue-400" size={18} />
                                       </div>
                                       <div className="min-w-0">
                                          <h4 className="font-bold text-slate-800 truncate" title={file.file}>{file.file}</h4>
                                          <div className="flex items-center gap-2 mt-1">
                                             <p className="text-xs font-mono text-slate-400 truncate max-w-md xl:max-w-lg" title={file.fullPath}>
                                                {file.fullPath}
                                             </p>
                                             <button 
                                                onClick={(e) => {
                                                   e.stopPropagation();
                                                   navigator.clipboard.writeText(file.fullPath);
                                                }}
                                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded transition-colors shrink-0 flex items-center justify-center border border-slate-200 shadow-sm"
                                                title="Копировать путь"
                                             >
                                                <Copy size={12} />
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                    
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 shrink-0 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                       <div className="text-right flex flex-col gap-0.5">
                                          {file.firstTimeStr === file.lastTimeStr ? (
                                             <>
                                                <div className="text-[10px] font-bold uppercase text-slate-400">Время</div>
                                                <div className="font-bold text-indigo-600 text-sm">{file.lastTimeStr}</div>
                                             </>
                                          ) : (
                                             <>
                                                <div className="flex items-center justify-end gap-1.5 text-xs">
                                                   <span className="text-[10px] font-bold uppercase text-slate-400">Первое:</span>
                                                   <span className="font-bold text-slate-600">{file.firstTimeStr}</span>
                                                </div>
                                                <div className="flex items-center justify-end gap-1.5 text-xs">
                                                   <span className="text-[10px] font-bold uppercase text-slate-400">Последнее:</span>
                                                   <span className="font-bold text-indigo-600">{file.lastTimeStr}</span>
                                                </div>
                                             </>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            </div>
            )}
         {/* AI Chat Modal */}
         {aiChatUser && (
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
                     <div className="flex items-center gap-3">
                        <Sparkles size={24} className="text-indigo-200" />
                        <div>
                           <h3 className="font-bold text-lg leading-tight">AI Анализ активности</h3>
                           <p className="text-xs text-indigo-200 font-medium">{aiChatUser.user}</p>
                        </div>
                     </div>
                     <button onClick={() => setAiChatUser(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <X size={20} />
                     </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
                     {aiChatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                           <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'}`}>
                              {msg.role === 'model' ? (
                                 <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm prose-slate max-w-none">
                                    {msg.text}
                                 </ReactMarkdown>
                              ) : (
                                 <div className="whitespace-pre-wrap">{msg.text}</div>
                              )}
                           </div>
                        </div>
                     ))}
                     {aiChatLoading && (
                        <div className="flex justify-start">
                           <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 shadow-sm">
                              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"></div>
                              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                           </div>
                        </div>
                     )}
                     <div ref={chatEndRef} />
                  </div>
                  
                  <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                     <div className="flex items-center gap-2">
                        <input
                           type="text"
                           value={aiChatInput}
                           onChange={(e) => setAiChatInput(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                           placeholder="Задайте вопрос ИИ об этом сотруднике..."
                           className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                           disabled={aiChatLoading}
                        />
                        <button
                           onClick={handleSendAiMessage}
                           disabled={!aiChatInput.trim() || aiChatLoading}
                           className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl transition-colors shadow-sm flex-shrink-0"
                        >
                           <Send size={20} />
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
