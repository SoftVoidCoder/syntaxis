import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, UserCity } from '../../types';
import { Button } from '../../components/Button';
import { FileText, Eye, TrendingUp, TrendingDown, Minus, BarChart, Phone, Mail } from 'lucide-react';
import { getDailyReportsFromFirebase } from '../../services/firebaseService';
import { UserKpiAnalyticsModal } from '../../components/reports/UserKpiAnalyticsModal';

interface AdminReportsProps {
   users: User[];
   onViewReport?: (userId: string) => void;
}

export const AdminReports: React.FC<AdminReportsProps> = ({ users, onViewReport }) => {
   const [reportRoleFilter, setReportRoleFilter] = useState<string>(UserRole.MANAGER);
   const [reportCityFilter, setReportCityFilter] = useState<string>('ALL');
   const [analyticsUser, setAnalyticsUser] = useState<User | null>(null);
   
   const [reports, setReports] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(false);

   useEffect(() => {
      const loadReports = async () => {
         setIsLoading(true);
         try {
            const data = await getDailyReportsFromFirebase();
            setReports(data || []);
         } catch (err) {
            console.error("Failed to load reports for KPIs", err);
         } finally {
            setIsLoading(false);
         }
      };
      loadReports();
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
      today.setHours(23, 59, 59, 999); // End of today

      const current7Days = userReports.filter((r: any) => {
         const d = new Date(r.date);
         const diff = (today.getTime() - d.getTime()) / (1000 * 3600 * 24);
         return diff >= 0 && diff <= 7;
      });

      const prev7Days = userReports.filter((r: any) => {
         const d = new Date(r.date);
         const diff = (today.getTime() - d.getTime()) / (1000 * 3600 * 24);
         return diff > 7 && diff <= 14;
      });

      const calcSum = (reps: any[]) => reps.reduce((sum, r) => {
         const outTel = Array.isArray(r.telephony) ? r.telephony.filter((t: any) => String(t.direction) === '2' && (Number(t.duration) || 0) >= 30).length : 0;
         const outEm = Array.isArray(r.emails) ? r.emails.filter((e: any) => String(e.direction) === '2').length : 0;
         return sum + outTel + outEm;
      }, 0);

      const calcTotalActions = (reps: any[]) => reps.reduce((sum, r) => {
         const outTel = Array.isArray(r.telephony) ? r.telephony.filter((t: any) => String(t.direction) === '2').length : 0;
         const outEm = Array.isArray(r.emails) ? r.emails.filter((e: any) => String(e.direction) === '2').length : 0;
         return sum + outTel + outEm;
      }, 0);

      const currentKPI = calcSum(current7Days);
      const prevKPI = calcSum(prev7Days);
      const currentTotalActions = calcTotalActions(current7Days);

      let trend = 0;
      if (prevKPI === 0) {
         if (currentKPI > 0) trend = 100;
      } else {
         trend = Math.round(((currentKPI - prevKPI) / prevKPI) * 100);
      }

      return { currentKPI, prevKPI, trend, currentTotalActions };
   };

   const getConnectionStatus = (user: User) => {
      const uFirst = (user.firstName || "").toLowerCase();
      const uLast = (user.lastName || "").toLowerCase();
      const targetBitrixId = user.bitrixUserId ? String(user.bitrixUserId) : null;

      const userReports = reports.filter((r: any) => {
         const reportBitrixId = r.bitrixId || r.userId;
         if (targetBitrixId && reportBitrixId) return String(reportBitrixId) === targetBitrixId;
         const reportName = (r.name || "").toLowerCase();
         return reportName.includes(uLast) || (uFirst && reportName.includes(uFirst));
      });

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonthReports = userReports.filter((r: any) => {
         const d = new Date(r.date);
         return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      });

      let hasPhone = false;
      let hasEmail = false;
      for (const r of thisMonthReports) {
         if (!hasPhone && Array.isArray(r.telephony) && r.telephony.length > 0) hasPhone = true;
         if (!hasEmail && Array.isArray(r.emails) && r.emails.length > 0) hasEmail = true;
         if (hasPhone && hasEmail) break;
      }
      return { hasPhone, hasEmail };
   };

   const filteredUsers = useMemo(() => {
      return users.filter(u => 
         !u.isBlocked &&
         (reportRoleFilter === 'ALL' || (u.role as string) === reportRoleFilter) && 
         (reportCityFilter === 'ALL' || (u.city || UserCity.SPB) === reportCityFilter)
      );
   }, [users, reportRoleFilter, reportCityFilter]);

   return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="text-korda-500" /> Отчеты сотрудников (Bitrix24)
               </h2>
               <p className="text-sm text-slate-400 mt-1">Выберите сотрудника для просмотра детальной статистики.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
               {/* Role Filter */}
               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 ml-2">Роль:</span>
                  <select value={reportRoleFilter} onChange={(e) => setReportRoleFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2">
                     <option value="ALL">Все роли</option>
                     <option value={UserRole.DIRECTOR}>Владельцы</option>
                     <option value={UserRole.ADMIN}>Администраторы</option>
                     <option value={UserRole.SUPERVISOR}>Управленцы</option>
                     <option value={UserRole.MANAGER}>Менеджеры</option>
                     <option value={UserRole.USER}>Сотрудники</option>
                  </select>
               </div>

               {/* City Filter */}
               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-bold text-slate-500 ml-2">Город:</span>
                  <select value={reportCityFilter} onChange={(e) => setReportCityFilter(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2">
                     <option value="ALL">Все города</option>
                     <option value={UserCity.SPB}>Санкт-Петербург</option>
                     <option value={UserCity.PENZA}>Пенза</option>
                     <option value={UserCity.MOSCOW}>Москва</option>
                     <option value={UserCity.VELIKY_NOVGOROD}>Великий Новгород</option>
                  </select>
               </div>
            </div>
         </div>

         <div className="divide-y divide-slate-100">
            {isLoading ? (
               <div className="p-12 flex justify-center items-center text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-300" />
                  <span className="ml-3 font-medium">Загрузка KPI...</span>
               </div>
            ) : filteredUsers.length === 0 ? (
               <div className="p-8 text-center text-slate-400">
                  Сотрудники не найдены
               </div>
            ) : (
               filteredUsers
                  .map(u => ({ user: u, kpiData: getKPI(u), conn: getConnectionStatus(u) }))
                  .sort((a, b) => b.kpiData.currentKPI - a.kpiData.currentKPI)
                  .map(({ user: u, kpiData: { currentKPI, trend, currentTotalActions }, conn }) => (
                     <div
                        key={u.id}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-slate-50 transition-colors group gap-4"
                     >
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover:bg-korda-100 group-hover:text-korda-600 transition-colors shrink-0">
                              {u.firstName[0]}{u.lastName[0]}
                           </div>
                           <div>
                              <p className="font-bold text-slate-800">{u.lastName} {u.firstName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <span className="text-xs text-slate-500 font-mono">ID: {u.bitrixUserId || 'Не указан'}</span>
                                 <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${u.role === UserRole.DIRECTOR ? 'bg-rose-100 text-rose-600' :
                                    u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' :
                                       u.role === UserRole.SUPERVISOR ? 'bg-teal-100 text-teal-600' :
                                          u.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-600' :
                                             'bg-slate-100 text-slate-600'
                                    }`}>
                                    {u.role === UserRole.DIRECTOR ? 'DIRECTOR' : u.role === UserRole.ADMIN ? 'ADMIN' : u.role === UserRole.SUPERVISOR ? 'SUPERVISOR' : u.role === UserRole.MANAGER ? 'MANAGER' : 'USER'}
                                 </span>
                                 <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${conn.hasPhone ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'}`} title={conn.hasPhone ? 'Телефония активна' : 'Нет звонков в этом месяце'}>
                                    <Phone size={10} strokeWidth={2.5} />
                                 </span>
                                 <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-bold ${conn.hasEmail ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-300'}`} title={conn.hasEmail ? 'Почта активна' : 'Нет писем в этом месяце'}>
                                    <Mail size={10} strokeWidth={2.5} />
                                 </span>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 w-full md:w-auto ml-14 md:ml-0">
                           {/* Холод (Короткие звонки/час) */}
                           <div className="flex flex-col items-center hidden md:flex">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-center">Холод</span>
                              <div className="flex items-baseline gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 group-hover:bg-white transition-colors" title="Короткие исходящие вызовы (до 30 сек) в час">
                                 <span className="text-lg font-black text-sky-500 leading-none">{((currentTotalActions - currentKPI) / 56).toFixed(1)}</span>
                                 <span className="text-[10px] text-slate-400 font-bold">Выз/ч</span>
                              </div>
                           </div>

                           {/* Активность (Д/час) */}
                           <div className="flex flex-col items-center hidden sm:flex">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-center">Активность</span>
                              <div className="flex items-baseline gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 group-hover:bg-white transition-colors" title="Все исходящие контакты в час">
                                 <span className="text-lg font-black text-slate-600 leading-none">{(currentTotalActions / 56).toFixed(1)}</span>
                                 <span className="text-[10px] text-slate-400 font-bold">Д/ч</span>
                              </div>
                           </div>

                           {/* Интенсивность (КД/час) */}
                           <div className="flex flex-col items-center hidden sm:flex">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-center">Темп</span>
                              <div className="flex items-baseline gap-1 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 group-hover:bg-white transition-colors" title="Ключевых действий в час (Только результативные звонки > 30с)">
                                 <span className="text-lg font-black text-indigo-600 leading-none">{(currentKPI / 56).toFixed(1)}</span>
                                 <span className="text-[10px] text-slate-400 font-bold">КД/ч</span>
                              </div>
                           </div>

                           {/* Показатель эффективности (KPI) */}
                           <div className="flex flex-col items-center sm:items-end sm:border-l sm:border-slate-100 sm:pl-6">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 text-center sm:text-right">Эффективность (7 дней)</span>
                              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                                 <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-black text-slate-800 leading-none">{currentKPI}</span>
                                    <span className="text-[10px] text-slate-400 font-bold">KPI</span>
                                 </div>
                                 <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    trend > 0 ? 'bg-emerald-100 text-emerald-700' : 
                                    trend < 0 ? 'bg-rose-100 text-rose-700' : 
                                    'bg-slate-200 text-slate-600'
                                 }`}>
                                    {trend > 0 ? <TrendingUp size={10} strokeWidth={3} /> : trend < 0 ? <TrendingDown size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
                                    {trend > 0 ? '+' : ''}{trend}%
                                 </div>
                              </div>
                           </div>
                           
                           <div className="flex items-center gap-2 shrink-0">
                              <Button variant="secondary" onClick={(e) => { e.stopPropagation(); onViewReport?.(u.id); }} className="text-[10px] px-3 py-1.5 h-auto flex items-center gap-1.5 bg-white shadow-sm border border-slate-200">
                                 <Eye size={14} /> Открыть
                              </Button>
                              <Button onClick={(e) => { e.stopPropagation(); setAnalyticsUser(u); }} className="text-[10px] px-3 py-1.5 h-auto flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 shadow-sm">
                                 <BarChart size={14} /> Аналитика
                              </Button>
                           </div>
                        </div>
                     </div>
                  )
               )
            )}
         </div>
         {analyticsUser && (
            <UserKpiAnalyticsModal 
               user={analyticsUser} 
               reports={reports} 
               onClose={() => setAnalyticsUser(null)} 
            />
         )}
      </div>
   );
};
