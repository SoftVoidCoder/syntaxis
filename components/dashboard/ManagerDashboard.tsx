import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, UserRole } from '../../types';
import { getAllUsersFromFirebase, getDailyReportsFromFirebase } from '../../services/firebaseService';
import { ShirtIcon, TieIcon, SuitIcon } from './StatusIcons';
import { Trophy, TrendingUp, Star, ChevronUp, AlertCircle, BarChart3, Info, LineChart } from 'lucide-react';
import { UserKpiAnalyticsModal } from '../reports/UserKpiAnalyticsModal';

export const ManagerDashboard: React.FC<{ onViewReport?: (userId: string) => void }> = ({ onViewReport }) => {
   const { user: currentUser } = useAuth();
   const [users, setUsers] = useState<User[]>([]);
   const [reports, setReports] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true);
   const [selectedUserIdForKpi, setSelectedUserIdForKpi] = useState<string | null>(null);

   useEffect(() => {
      const loadData = async () => {
         setIsLoading(true);
         try {
            const [fbUsers, fbReports] = await Promise.all([
               getAllUsersFromFirebase(),
               getDailyReportsFromFirebase()
            ]);
            setUsers(fbUsers || []);
            setReports(fbReports || []);
         } catch (err) {
            console.error("Failed to load dashboard data", err);
         } finally {
            setIsLoading(false);
         }
      };
      loadData();
   }, []);

   const getKPI = (user: User) => {
      const uFirst = (user.firstName || "").toLowerCase();
      const uLast = (user.lastName || "").toLowerCase();
      const targetBitrixId = user.bitrixUserId ? String(user.bitrixUserId) : null;

      const userReports = reports.filter((r: any) => {
         const reportBitrixId = r.bitrixId || r.userId;
         if (targetBitrixId && reportBitrixId) return String(reportBitrixId) === targetBitrixId;
         const reportName = (r.name || "").toLowerCase();
         return reportName.includes(uLast) || (uFirst && reportName.includes(uFirst));
      });

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const current7Days = userReports.filter((r: any) => {
         const d = new Date(r.date);
         const diff = (today.getTime() - d.getTime()) / (1000 * 3600 * 24);
         return diff >= 0 && diff <= 7;
      });

      const currentKPI = current7Days.reduce((sum, r) => {
         const outTel = Array.isArray(r.telephony) ? r.telephony.filter((t: any) => String(t.direction) === '2' && (Number(t.duration) || 0) >= 30).length : 0;
         const outEm = Array.isArray(r.emails) ? r.emails.filter((e: any) => String(e.direction) === '2').length : 0;
         return sum + outTel + outEm;
      }, 0);

      const tempo = parseFloat((currentKPI / 56).toFixed(1));
      return tempo;
   };

   const rankings = useMemo(() => {
      if (!users.length || !reports.length) return [];

      const managers = users.filter(u => u.role === UserRole.MANAGER && !u.isBlocked);
      
      const sorted = managers.map(u => ({
         user: u,
         kdch: getKPI(u),
         status: 'SHIRT' as 'SHIRT' | 'TIE' | 'SUIT'
      })).sort((a, b) => b.kdch - a.kdch);

      return sorted.map((item, index) => {
         if (index < 3) item.status = 'SUIT';           
         else if (index < 8) item.status = 'TIE';       
         else item.status = 'SHIRT';                    
         return item;
      });
   }, [users, reports]);

   if (isLoading) {
      return (
         <div className="flex-1 overflow-y-auto w-full bg-slate-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-korda-500" />
         </div>
      );
   }

   const myRanking = rankings.find(r => r.user.id === currentUser?.id);
   const myKdch = myRanking ? myRanking.kdch : 0;

   // Если я менеджер - вижу всех, но те кто ниже меня будут размыты.
   const visibleRankings = rankings;

   const getStatusVisuals = (status: 'SHIRT' | 'TIE' | 'SUIT') => {
      switch (status) {
         case 'SUIT': return { 
            name: 'Пиджак (Элита)', 
            icon: <SuitIcon className="w-8 h-8 text-amber-500" />,
            bg: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200',
            badge: 'bg-amber-100 text-amber-700 border-amber-200'
         };
         case 'TIE': return { 
            name: 'Галстук (Профи)', 
            icon: <TieIcon className="w-8 h-8 text-indigo-500" />,
            bg: 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200',
            badge: 'bg-indigo-100 text-indigo-700 border-indigo-200'
         };
         case 'SHIRT': default: return { 
            name: 'Рубашка (База)', 
            icon: <ShirtIcon className="w-8 h-8 text-slate-400" />,
            bg: 'bg-white border-slate-200',
            badge: 'bg-slate-100 text-slate-600 border-slate-200'
         };
      }
   };

   return (
      <div className="flex-1 overflow-y-auto w-full bg-slate-50">
         <div className="max-w-4xl mx-auto p-4 md:p-8 min-h-full pb-20">
            
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-korda-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
               
               <div className="relative z-10 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-lg shrink-0">
                     <LineChart size={32} />
                  </div>
                  <div>
                     <h1 className="text-2xl font-black text-slate-800 mb-1">Сравнительная аналитика</h1>
                     <p className="text-slate-500 font-medium">Контроль плотности коммуникаций за последние 7 дней</p>
                  </div>
               </div>

               {myRanking && (
                  <div className="relative z-10 flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                     <div className="text-center">
                        <div className="text-3xl font-black text-slate-800 leading-none">{myRanking.kdch}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Твой КД/ч</div>
                     </div>
                     <div className="w-px h-10 bg-slate-200 mx-2"></div>
                     <div className="flex flex-col items-center">
                        {getStatusVisuals(myRanking.status).icon}
                        <span className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusVisuals(myRanking.status).badge}`}>
                           {getStatusVisuals(myRanking.status).name}
                        </span>
                     </div>
                  </div>
               )}
            </div>

            <div className="mb-8 bg-white border border-slate-200 p-5 rounded-2xl text-sm shadow-sm relative overflow-hidden">
               <div className="absolute left-0 top-0 bottom-0 w-1 bg-korda-500"></div>
               <div className="flex items-center gap-2 font-bold text-slate-800 mb-3 text-base">
                  <Info size={20} className="text-korda-500" /> Памятка по метрикам
               </div>
               <ul className="space-y-2 text-slate-600">
                  <li className="flex items-start gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                     <span><strong>КД/ч (Количество Действий в Час)</strong> — показатель интенсивности работы, формируемый из количества совершенных звонков и отправленных писем.</span>
                  </li>
                  <li className="flex items-start gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 shrink-0"></div>
                     <span><strong>Статусы</strong> — система грейдов (Рубашка, Галстук, Пиджак), отражающая вашу эффективность в сравнении с общими показателями отдела.</span>
                  </li>
                  {myRanking && (
                     <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-korda-400 mt-1.5 shrink-0"></div>
                        <span><strong>Приватность</strong> — таблица предназначена для сравнительной аналитики и самоконтроля. Имена коллег скрыты, вам доступен лишь ближайший ориентир для профессионального роста.</span>
                     </li>
                  )}
               </ul>
            </div>

            <div className="space-y-4 relative">
               <div className="absolute left-6 top-10 bottom-10 w-0.5 bg-gradient-to-b from-korda-200 to-transparent hidden md:block"></div>

               {visibleRankings.map((rank, index) => {
                  const isMe = rank.user.id === currentUser?.id;
                  
                  const myIndex = visibleRankings.findIndex(r => r.user.id === currentUser?.id);
                  const isDirectTarget = myIndex > 0 && index === myIndex - 1; // Конкурент ровно на 1 позицию выше
                  
                  // Скрываем имя всех, кроме себя и своего прямого конкурента (админы видят всех)
                  const shouldBlurName = !!myRanking && !isMe && !isDirectTarget;
                  const canViewAnalytics = isMe || !myRanking; // Admin sees all, Manager sees only own

                  const vis = getStatusVisuals(rank.status);
                  
                  return (
                     <div 
                        key={rank.user.id} 
                        className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300
                           ${isMe ? 'shadow-md border-korda-300 bg-korda-50 ring-2 ring-korda-500/20 z-20' : vis.bg}
                           ${!isMe ? 'hover:scale-[1.01] hover:shadow-sm' : ''}
                        `}
                     >
                        <div className="hidden md:flex w-12 h-12 rounded-full bg-white border border-slate-200 items-center justify-center font-black text-lg text-slate-400 shadow-sm shrink-0 z-10">
                           {index + 1}
                        </div>

                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border
                           ${isMe ? 'bg-korda-500 text-white border-korda-600' : 'bg-white border-slate-200'}
                        `}>
                           {rank.status === 'SUIT' && <SuitIcon className={`w-7 h-7 ${isMe ? 'text-white' : 'text-amber-500'}`} />}
                           {rank.status === 'TIE' && <TieIcon className={`w-7 h-7 ${isMe ? 'text-white' : 'text-indigo-500'}`} />}
                           {rank.status === 'SHIRT' && <ShirtIcon className={`w-7 h-7 ${isMe ? 'text-white' : 'text-slate-400'}`} />}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center justify-between gap-2">
                           <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                 <h3 className={`font-bold truncate text-lg ${isMe ? 'text-korda-900' : 'text-slate-800'} ${shouldBlurName ? 'blur-md opacity-60 select-none pointer-events-none' : ''}`}>
                                    {shouldBlurName ? 'Скрытый конкурент' : `${rank.user.lastName} ${rank.user.firstName}`}
                                 </h3>
                                 {isMe && <span className="text-[10px] bg-korda-500 text-white px-1.5 py-0.5 rounded font-bold uppercase shrink-0">Это вы</span>}
                                 {isDirectTarget && <span className="text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold uppercase shrink-0 animate-pulse">Ближайшая цель</span>}
                              </div>
                              
                              <div className="flex items-center gap-2">
                                 <span className={`text-xs font-bold px-2 py-0.5 rounded border ${vis.badge}`}>
                                    {vis.name}
                                 </span>
                              </div>
                           </div>

                           {canViewAnalytics && (
                              <button 
                                onClick={() => setSelectedUserIdForKpi(rank.user.id)}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 hover:text-korda-600 transition-colors shadow-sm shrink-0"
                              >
                                <BarChart3 size={16} /> Аналитика
                              </button>
                           )}
                        </div>

                        <div className="text-right flex items-center justify-end shrink-0 ml-4 min-w-[3rem]">
                           <div>
                              <div className={`text-2xl font-black leading-none ${isMe ? 'text-korda-600' : 'text-slate-800'}`}>
                                 {rank.kdch}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 text-center">КД/ч</div>
                           </div>
                        </div>
                     </div>
                  );
               })}



            </div>
         </div>
         
         {selectedUserIdForKpi && (
            <UserKpiAnalyticsModal 
               user={users.find(u => u.id === selectedUserIdForKpi)!} 
               reports={reports} 
               onClose={() => setSelectedUserIdForKpi(null)} 
            />
         )}
      </div>
   );
};
