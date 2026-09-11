import React, { useState } from 'react';
import { User, UserRole, UserCity, SalesTask, ChatSession } from '../../types';
import { Briefcase, BarChart3, ChevronDown } from 'lucide-react';
import { TasksPage } from '../TasksPage';
import {
   getUserChatsFromFirebase,
   deleteSalesTask
} from '../../services/firebaseService';

// getWeekNumber helper
function getWeekNumber(d: Date): number {
   d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
   d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
   var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
   var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
   return weekNo;
}

function getDecadeOfMonth(date: Date): number {
   const day = date.getDate();
   if (day <= 10) return 1;
   if (day <= 20) return 2;
   return 3;
}

const formatMonth = (dateStr: string) => {
   const date = new Date(dateStr + "-01");
   return date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
};

interface AdminClientSearchProps {
   users: User[];
   allSalesTasks: SalesTask[];
   loadSalesTasks: () => Promise<void>;
}

export const AdminClientSearch: React.FC<AdminClientSearchProps> = ({ users, allSalesTasks, loadSalesTasks }) => {
   const [clientSearchChats, setClientSearchChats] = useState<ChatSession[]>([]);
   const [selectedClientSearchUser, setSelectedClientSearchUser] = useState<User | null>(null);
   const [clientSearchRoleFilter, setClientSearchRoleFilter] = useState<UserRole>(UserRole.MANAGER);
   const [clientSearchCityFilter, setClientSearchCityFilter] = useState<string>(UserCity.SPB);
   const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
   const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

   const handleClientSearchUserSelect = async (userId: string) => {
      if (!userId) {
         setSelectedClientSearchUser(null);
         setClientSearchChats([]);
         return;
      }

      const user = users.find(u => u.id === userId);
      if (!user) return;

      setSelectedClientSearchUser(user);

      const userTasks = allSalesTasks.filter(t => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
      if (userTasks.length > 0) {
         const latestDate = new Date(userTasks[0].createdAt);
         const yyyy = latestDate.getFullYear();
         const mm = String(latestDate.getMonth() + 1).padStart(2, '0');
         setSelectedMonth(`${yyyy}-${mm}`);
      } else {
         setSelectedMonth(new Date().toISOString().slice(0, 7));
      }
      setSelectedWeek(null);

      try {
         const chats = await getUserChatsFromFirebase(userId);
         setClientSearchChats(chats);
      } catch (err) {
         console.error("Failed to load user chats:", err);
         alert("Не удалось загрузить историю чатов пользователя.");
      }
   };

   return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
         {/* Header & Controls */}
         <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-2">
               <div>
                  <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
                     <Briefcase className="text-korda-600" /> Аналитика и Поиск
                  </h2>
                  <p className="text-slate-500 text-sm">Мониторинг активности и просмотр истории задач.</p>
               </div>

               {/* Role Switcher */}
               <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Роль:</span>
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                     {[UserRole.MANAGER, UserRole.USER, UserRole.SUPERVISOR, UserRole.ADMIN].map(role => (
                        <button key={role} onClick={() => { setClientSearchRoleFilter(role); setSelectedClientSearchUser(null); }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${clientSearchRoleFilter === role ? 'bg-white text-korda-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                           {role === UserRole.MANAGER ? 'Менеджеры' : role === UserRole.USER ? 'Сотрудники' : role === UserRole.SUPERVISOR ? 'Управленцы' : 'Админы'}
                        </button>
                     ))}
                  </div>
               </div>

               {/* City Switcher */}
               <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Город:</span>
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                     {[{ value: 'ALL', label: 'Все' }, { value: UserCity.SPB, label: 'СПб' }, { value: UserCity.PENZA, label: 'Пенза' }, { value: UserCity.MOSCOW, label: 'Москва' }, { value: UserCity.VELIKY_NOVGOROD, label: 'В.Новгород' }].map(city => (
                        <button key={city.value} onClick={() => { setClientSearchCityFilter(city.value); setSelectedClientSearchUser(null); }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${clientSearchCityFilter === city.value ? 'bg-white text-korda-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                           {city.label}
                        </button>
                     ))}
                  </div>
               </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
               {selectedClientSearchUser && (
                  <button onClick={() => { setSelectedClientSearchUser(null); setClientSearchChats([]); setSelectedWeek(null); }} className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1">
                     <ChevronDown className="rotate-90" size={16} /> Назад к списку
                  </button>
               )}
               <select className="p-2 border border-slate-200 rounded-lg text-slate-700 text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-korda-500" value={selectedClientSearchUser?.id || ''} onChange={(e) => handleClientSearchUserSelect(e.target.value)}>
                  <option value="">-- Обзор (Лидерборд) --</option>
                  {users.filter(u => u.role === clientSearchRoleFilter && (clientSearchCityFilter === 'ALL' || (u.city || UserCity.SPB) === clientSearchCityFilter)).map(u => (
                     <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
               </select>
            </div>
         </div>

         {/* LEADERBOARD VIEW */}
         {!selectedClientSearchUser && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                     <BarChart3 size={18} /> Активность Менеджеров
                  </h3>
                  <span className="text-xs font-mono text-slate-400">Текущий месяц: {formatMonth(selectedMonth)}</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                     <thead className="bg-white text-slate-500 uppercase font-bold text-xs border-b border-slate-100">
                        <tr>
                           <th className="px-6 py-4">Менеджер</th>
                           <th className="px-6 py-4 text-center">Эта неделя</th>
                           <th className="px-6 py-4 text-center">Этот месяц</th>
                           <th className="px-6 py-4 text-center">Всего задач</th>
                           <th className="px-6 py-4 text-right">Последняя активность</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {users.filter(u => u.role === clientSearchRoleFilter && (clientSearchCityFilter === 'ALL' || (u.city || UserCity.SPB) === clientSearchCityFilter)).map(u => {
                           const userTasks = allSalesTasks.filter(t => t.userId === u.id);
                           const now = new Date();
                           const currentWeek = getWeekNumber(now);
                           const currentMonth = now.getMonth();
                           const currentYear = now.getFullYear();

                           const tasksThisMonth = userTasks.filter(t => {
                              const d = new Date(t.createdAt);
                              return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                           }).length;

                           const tasksThisWeek = userTasks.filter(t => {
                              const d = new Date(t.createdAt);
                              return getWeekNumber(d) === currentWeek && d.getFullYear() === currentYear;
                           }).length;

                           const lastActive = userTasks.length > 0 ? new Date(userTasks[0].createdAt).toLocaleDateString() : '-';

                           return (
                              <tr key={u.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleClientSearchUserSelect(u.id)}>
                                 <td className="px-6 py-4 font-medium text-slate-900">
                                    {u.firstName} {u.lastName} <span className="text-slate-400 font-normal">(@{u.username})</span>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    {tasksThisWeek > 0 ? <span className="text-emerald-600 font-bold">+{tasksThisWeek}</span> : <span className="text-slate-300">0</span>}
                                 </td>
                                 <td className="px-6 py-4 text-center font-medium">{tasksThisMonth}</td>
                                 <td className="px-6 py-4 text-center text-slate-500">{userTasks.length}</td>
                                 <td className="px-6 py-4 text-right text-xs text-slate-400">{lastActive}</td>
                              </tr>
                           );
                        })}
                        {users.filter(u => u.role === clientSearchRoleFilter).length === 0 && (
                           <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                 Нет пользователей с выбранной ролью для отображения.
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {/* DETAILED HISTORY VIEW */}
         {selectedClientSearchUser && (
            <div className="space-y-6">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="font-bold text-lg text-slate-800">История продуктивности</h3>
                     <input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setSelectedWeek(null); }} className="p-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-korda-500" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                     {(() => {
                        const [year, month] = selectedMonth.split('-').map(Number);
                        const userTasks = allSalesTasks.filter(t => t.userId === selectedClientSearchUser.id);
                        const tasksInMonth = userTasks.filter(t => {
                           const d = new Date(t.createdAt);
                           return d.getMonth() === (month - 1) && d.getFullYear() === year;
                        });
                        const decades: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
                        if (tasksInMonth.length > 0) {
                           tasksInMonth.forEach(t => {
                              const dcd = getDecadeOfMonth(new Date(t.createdAt));
                              decades[dcd] = (decades[dcd] || 0) + 1;
                           });
                        }
                        return [1, 2, 3].map(dcd => {
                           const count = decades[dcd];
                           const isSelected = selectedWeek === dcd;
                           let label = '';
                           if (dcd === 1) label = '1 - 10 число';
                           if (dcd === 2) label = '11 - 20 число';
                           if (dcd === 3) label = '21 - 31 число';
                           return (
                              <button key={dcd} onClick={() => setSelectedWeek(isSelected ? null : dcd)} className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${isSelected ? 'bg-korda-50 border-korda-500 shadow-sm ring-1 ring-korda-500' : 'bg-white border-slate-200 hover:border-korda-300 hover:bg-slate-50'}`}>
                                 <span className={`text-xs font-bold uppercase mb-1 ${isSelected ? 'text-korda-600' : 'text-slate-400'}`}>{label}</span>
                                 <span className="text-2xl font-bold text-slate-800">{count}</span>
                                 <span className="text-[10px] text-slate-400 mt-1">задач</span>
                              </button>
                           );
                        });
                     })()}
                  </div>
               </div>

               <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden min-h-[500px]">
                  <div className="p-3 bg-slate-100 border-b border-slate-200 text-xs text-center text-slate-500 font-mono flex justify-between px-6">
                     <span>РЕЖИМ ПРОСМОТРА: {selectedClientSearchUser.firstName} {selectedClientSearchUser.lastName}</span>
                     {selectedWeek && <span className="text-korda-600 font-bold">ФИЛЬТР: ДЕКАДА {selectedWeek}</span>}
                  </div>

                  {(() => {
                     const [year, month] = selectedMonth.split('-').map(Number);
                     let filteredTasks = allSalesTasks.filter(t => t.userId === selectedClientSearchUser.id);
                     filteredTasks = filteredTasks.filter(t => {
                        const d = new Date(t.createdAt);
                        return d.getMonth() === (month - 1) && d.getFullYear() === year;
                     });
                     if (selectedWeek) {
                        filteredTasks = filteredTasks.filter(t => getDecadeOfMonth(new Date(t.createdAt)) === selectedWeek);
                     }
                     return (
                        <TasksPage
                           chats={clientSearchChats}
                           targetUserId={selectedClientSearchUser.id}
                           readOnly={true}
                           tasks={filteredTasks}
                           onNavigateChat={() => { }}
                           onSelectChat={() => { }}
                           onCreateChat={() => { }}
                           onDeleteTask={async (taskId) => {
                              await deleteSalesTask(taskId);
                              await loadSalesTasks();
                           }}
                        />
                     );
                  })()}
               </div>
            </div>
         )}
      </div>
   );
};
