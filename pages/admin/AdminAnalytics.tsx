import React, { useState } from 'react';
import { User, ChatMode, UserUsageStats, UserRole, UserCity } from '../../types';
import { BarChart3, Calendar, Filter } from 'lucide-react';

interface AdminAnalyticsProps {
   users: User[];
   analytics: Record<string, UserUsageStats>;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ users, analytics }) => {
   const getCurrentMonthString = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
   };

   const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentMonthString());
   const [selectedRole, setSelectedRole] = useState<UserRole | 'ALL'>(UserRole.MANAGER);
   const [selectedCity, setSelectedCity] = useState<UserCity | 'ALL'>('ALL');

   const getAvailableMonths = () => {
      const months = new Set<string>();
      months.add(getCurrentMonthString()); // Ensure current month is always an option
      Object.values(analytics).forEach((stats: UserUsageStats) => {
         if (stats.history) {
            Object.keys(stats.history).forEach(key => months.add(key));
         }
      });
      return Array.from(months).sort().reverse();
   };

   const formatPeriod = (period: string) => {
      if (period === 'ALL') return 'За все время';
      const [year, month] = period.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' });
   };

   const getStatsForUser = (userId: string) => {
      const baseStats = analytics[userId];
      if (!baseStats) return null;

      if (selectedPeriod === 'ALL') {
         return baseStats;
      }

      const history = baseStats.history?.[selectedPeriod];
      if (!history) {
         return {
            userId,
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
            videosGenerated: 0
         };
      }

      return { ...history, userId };
   };

   return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="text-korda-500" /> Аналитика активности
               </h2>
               <p className="text-sm text-slate-400 mt-1">Отслеживайте показатели эффективности сотрудников.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <Filter size={18} className="text-slate-500 ml-2" />
                  <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as any)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2">
                     <option value="ALL">Все роли</option>
                     {Object.values(UserRole).map(role => {
                         const roleLabels: Record<UserRole, string> = {
                             [UserRole.USER]: 'Сотрудник',
                             [UserRole.MANAGER]: 'Менеджер',
                             [UserRole.SUPERVISOR]: 'Управленец',
                             [UserRole.ADMIN]: 'Администратор',
                             [UserRole.DIRECTOR]: 'Генеральный директор',
                             [UserRole.CONSTRUCTOR]: 'Инженер-Сметчик'
                         };
                         return <option key={role} value={role}>{roleLabels[role]}</option>;
                     })}
                  </select>
               </div>
               
               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <Filter size={18} className="text-slate-500 ml-2" />
                  <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value as any)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2">
                     <option value="ALL">Все города</option>
                     {Object.values(UserCity).map(city => {
                         const cityLabels: Record<UserCity, string> = {
                             [UserCity.SPB]: 'Санкт-Петербург',
                             [UserCity.PENZA]: 'Пенза',
                             [UserCity.MOSCOW]: 'Москва',
                             [UserCity.VELIKY_NOVGOROD]: 'Великий Новгород'
                         };
                         return <option key={city} value={city}>{cityLabels[city]}</option>;
                     })}
                  </select>
               </div>

               <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <Calendar size={18} className="text-slate-500 ml-2" />
                  <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer pr-2">
                     <option value="ALL">За все время</option>
                     {getAvailableMonths().map(month => (
                        <option key={month} value={month}>{formatPeriod(month)}</option>
                     ))}
                  </select>
               </div>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                  <tr>
                     <th className="px-6 py-4">Сотрудник</th>
                     <th className="px-6 py-4 text-center font-extrabold text-slate-800 bg-slate-100 border-x border-slate-200 shadow-inner">Всего</th>
                     <th className="px-6 py-4 text-center text-blue-600">Свобод.</th>
                     <th className="px-6 py-4 text-center text-korda-600">Продажи</th>
                     <th className="px-6 py-4 text-center text-purple-600">Обучение</th>
                     <th className="px-6 py-4 text-center text-orange-600">Расчеты</th>
                     <th className="px-6 py-4 text-center text-indigo-600">Research</th>
                     <th className="px-6 py-4 text-center text-teal-600">Аналитика</th>
                     <th className="px-6 py-4 text-center text-amber-600">БЗ</th>
                     <th className="px-6 py-4 text-center text-pink-600">Нейроментор</th>
                     <th className="px-6 py-4 text-center bg-slate-100 border-l border-slate-200">Картинки</th>
                     <th className="px-6 py-4 text-center bg-slate-100">Видео</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {users
                     .filter(u => {
                        if (u.isBlocked) return false;
                        if (selectedRole !== 'ALL' && u.role !== selectedRole) return false;
                        if (selectedCity !== 'ALL' && u.city !== selectedCity) return false;
                        return true;
                     })
                     .map(u => {
                        const stats = getStatsForUser(u.id);
                        if (!stats) return null;

                        const total = (stats.chatRequests[ChatMode.FREE] || 0) +
                                      (stats.chatRequests[ChatMode.SALES] || 0) +
                                      (stats.chatRequests[ChatMode.TRAINING] || 0) +
                                      (stats.chatRequests[ChatMode.CALCULATION] || 0) +
                                      (stats.chatRequests[ChatMode.DEEP_RESEARCH] || 0) +
                                      (stats.chatRequests[ChatMode.ANALYTICS] || 0) +
                                      (stats.chatRequests[ChatMode.KNOWLEDGE] || 0) +
                                      (stats.chatRequests[ChatMode.NEUROMENTOR] || 0) +
                                      (stats.chatRequests[ChatMode.CONVEYOR] || 0) +
                                      (stats.imagesGenerated || 0) +
                                      (stats.videosGenerated || 0);

                        return { user: u, stats, total };
                     })
                     .filter((item): item is NonNullable<typeof item> => item !== null)
                     .sort((a, b) => b.total - a.total)
                     .map(({ user: u, stats, total }) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                           <td className="px-6 py-4 font-bold text-slate-800">{u.lastName} {u.firstName}</td>
                           <td className="px-6 py-4 text-center font-extrabold text-slate-900 bg-slate-50 border-x border-slate-200 shadow-inner text-lg">{total}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.FREE] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.SALES] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.TRAINING] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.CALCULATION] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.DEEP_RESEARCH] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.ANALYTICS] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono">{stats.chatRequests[ChatMode.KNOWLEDGE] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono text-pink-600">{stats.chatRequests[ChatMode.NEUROMENTOR] || 0}</td>
                           <td className="px-6 py-4 text-center font-mono font-bold bg-slate-50 border-l border-slate-200">{stats.imagesGenerated}</td>
                           <td className="px-6 py-4 text-center font-mono font-bold bg-slate-50">{stats.videosGenerated}</td>
                        </tr>
                     ))}
               </tbody>
            </table>
            {Object.keys(analytics).length === 0 && (
               <div className="text-center py-8 text-slate-400">Данные отсутствуют</div>
            )}
         </div>
      </div>
   );
};
