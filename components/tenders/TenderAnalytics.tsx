import React from 'react';
import { BarChart3, Trophy } from 'lucide-react';
import { TenderDailyStats } from '../../types';

interface TenderAnalyticsProps {
   favoritesCount: number;
   aiScoresCount: number;
   dailyStats: TenderDailyStats[];
   selectedLeaderboardUser: string | null;
   onSelectLeaderboardUser: (uid: string | null) => void;
}

export const TenderAnalytics: React.FC<TenderAnalyticsProps> = ({
   favoritesCount,
   aiScoresCount,
   dailyStats,
   selectedLeaderboardUser,
   onSelectLeaderboardUser,
}) => {
   // User leaderboard from last 10 days
   const userLeaderboard = React.useMemo(() => {
      const agg: Record<string, { name: string; count: number; added: number; aiScorings: number }> = {};
      dailyStats.slice(0, 10).forEach(day => {
         if (day.userSearches) {
            Object.entries(day.userSearches).forEach(([uid, data]) => {
               if (!agg[uid]) agg[uid] = { name: data.name, count: 0, added: 0, aiScorings: 0 };
               agg[uid].count += data.count;
               agg[uid].name = data.name;
            });
         }
         if (day.userAdded) {
            Object.entries(day.userAdded).forEach(([uid, data]) => {
               if (!agg[uid]) agg[uid] = { name: data.name, count: 0, added: 0, aiScorings: 0 };
               agg[uid].added += data.count;
               agg[uid].name = data.name;
            });
         }
         if (day.userAiScorings) {
            Object.entries(day.userAiScorings).forEach(([uid, data]) => {
               if (!agg[uid]) agg[uid] = { name: data.name, count: 0, added: 0, aiScorings: 0 };
               agg[uid].aiScorings += data.count;
               agg[uid].name = data.name;
            });
         }
      });
      return Object.entries(agg)
         .map(([uid, data]) => ({ uid, ...data }))
         .sort((a, b) => b.count - a.count);
   }, [dailyStats]);

   const totalApiLast10Days = dailyStats.slice(0, 10).reduce((sum, s) => sum + (s.apiQuotaUsed || 0), 0);
   const totalAiScoringsLast10Days = dailyStats.slice(0, 10).reduce((sum, s) => sum + (s.aiScoringsRun || 0), 0);

   return (
      <div className="mb-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-5 animate-in slide-in-from-top-2">
         <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-korda-500" /> Статистика по тендерам
         </h3>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
               <p className="text-xs text-slate-500 uppercase tracking-wider">В работе</p>
               <p className="text-2xl font-bold text-korda-600">{favoritesCount}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
               <p className="text-xs text-slate-500 uppercase tracking-wider" title="Количество запусков ИИ-оценки за последние 10 дней">ИИ-оценок (10 дн.)</p>
               <p className="text-2xl font-bold text-violet-600">{totalAiScoringsLast10Days}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
               <p className="text-xs text-slate-500 uppercase tracking-wider">API сегодня</p>
               <p className="text-2xl font-bold text-amber-600">{dailyStats[0]?.apiQuotaUsed || 0}</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
               <p className="text-xs text-slate-500 uppercase tracking-wider">API за 10 дней</p>
               <p className="text-2xl font-bold text-green-600">{totalApiLast10Days}</p>
            </div>
         </div>

         {/* User Leaderboard */}
         {userLeaderboard.length > 0 && (
            <div className="mb-4">
               <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                  <Trophy size={14} className="text-amber-500" /> Рейтинг пользователей (10 дней)
               </h4>
               <div className="flex flex-wrap gap-2">
                  <button
                     onClick={() => onSelectLeaderboardUser(null)}
                     className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${!selectedLeaderboardUser ? 'bg-korda-100 border-korda-300 text-korda-800 font-bold ring-2 ring-korda-200' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300'}`}
                  >
                     Все
                  </button>
                  {userLeaderboard.map((u, idx) => (
                     <button
                        key={u.uid}
                        onClick={() => onSelectLeaderboardUser(selectedLeaderboardUser === u.uid ? null : u.uid)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-all ${selectedLeaderboardUser === u.uid
                           ? 'bg-korda-100 border-korda-300 text-korda-800 font-bold ring-2 ring-korda-200'
                           : idx === 0 ? 'bg-amber-50 border-amber-200 text-amber-800 font-bold hover:ring-2 hover:ring-amber-200'
                              : idx === 1 ? 'bg-slate-50 border-slate-200 text-slate-700 font-semibold hover:ring-2 hover:ring-slate-200'
                                 : idx === 2 ? 'bg-orange-50 border-orange-200 text-orange-700 font-semibold hover:ring-2 hover:ring-orange-200'
                                    : 'bg-white border-slate-100 text-slate-600 hover:ring-2 hover:ring-slate-200'
                           }`}
                     >
                        <span className="text-xs font-bold w-5 text-center">
                           {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                        </span>
                        <span>{u.name}</span>
                        <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono" title="API запросов">{u.count}</span>
                        {u.added > 0 && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono" title="Добавлено">+{u.added}</span>}
                        {u.aiScorings > 0 && <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-mono" title="ИИ оценок">🤖{u.aiScorings}</span>}
                     </button>
                  ))}
               </div>
            </div>
         )}

         {/* Daily stats table */}
         {dailyStats.length > 0 && (
            <div className="overflow-x-auto">
               {selectedLeaderboardUser && (
                  <p className="text-xs text-korda-600 font-medium mb-2">
                     Статистика: {userLeaderboard.find(u => u.uid === selectedLeaderboardUser)?.name || 'Пользователь'}
                  </p>
               )}
               <table className="w-full text-xs">
                  <thead>
                     <tr className="text-slate-500 border-b border-slate-100">
                        <th className="text-left p-2 font-medium">Дата</th>
                        <th className="text-center p-2 font-medium">API запросов</th>
                        <th className="text-center p-2 font-medium">Добавлено</th>
                        <th className="text-center p-2 font-medium">ИИ оценок</th>
                     </tr>
                  </thead>
                  <tbody>
                     {dailyStats.slice(0, 10).map(s => {
                        const userApiCount = selectedLeaderboardUser
                           ? (s.userSearches?.[selectedLeaderboardUser]?.count || 0)
                           : s.apiQuotaUsed;
                        const userAddedCount = selectedLeaderboardUser
                           ? (s.userAdded?.[selectedLeaderboardUser]?.count || 0)
                           : s.tendersAdded;
                        const userAiCount = selectedLeaderboardUser
                           ? (s.userAiScorings?.[selectedLeaderboardUser]?.count || 0)
                           : s.aiScoringsRun;
                        if (selectedLeaderboardUser && userApiCount === 0 && userAddedCount === 0 && userAiCount === 0) return null;
                        return (
                           <tr key={s.date} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="p-2 font-mono">{s.date}</td>
                              <td className="p-2 text-center font-medium">{userApiCount}</td>
                              <td className="p-2 text-center">{userAddedCount}</td>
                              <td className="p-2 text-center">{userAiCount}</td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         )}
      </div>
   );
};
