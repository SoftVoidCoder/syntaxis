import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { Button } from '../../components/Button';
import { Pencil, Lock, Unlock, Shield, Search } from 'lucide-react';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { CreateUserForm } from '../../components/admin/CreateUserForm';
import { AllowedIpsBlock } from '../../components/admin/AllowedIpsBlock';

interface AdminUsersProps {
   users: User[];
   setUsers: React.Dispatch<React.SetStateAction<User[]>>;
   allowedIps: string[];
   setAllowedIps: React.Dispatch<React.SetStateAction<string[]>>;
}

const ROLE_BADGE: Record<string, { label: string; classes: string }> = {
   [UserRole.DIRECTOR]:   { label: 'ВЛАДЕЛЕЦ',   classes: 'bg-rose-100 text-rose-700 border-rose-200' },
   [UserRole.ADMIN]:      { label: 'ADMIN',       classes: 'bg-purple-100 text-purple-700 border-purple-200' },
   [UserRole.SUPERVISOR]: { label: 'УПРАВЛЕНЕЦ',  classes: 'bg-teal-100 text-teal-700 border-teal-200' },
   [UserRole.MANAGER]:    { label: 'MANAGER',      classes: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
   [UserRole.USER]:       { label: 'СОТРУДНИК',   classes: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
   [UserRole.CONSTRUCTOR]:{ label: 'СМЕТЧИК', classes: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const ROLE_FILTERS = [
   { value: 'ALL', label: 'Все' },
   { value: UserRole.DIRECTOR, label: 'Владельцы' },
   { value: UserRole.ADMIN, label: 'Админы' },
   { value: UserRole.SUPERVISOR, label: 'Управленцы' },
   { value: UserRole.MANAGER, label: 'Менеджеры' },
   { value: UserRole.CONSTRUCTOR, label: 'Сметчики' },
   { value: UserRole.USER, label: 'Сотрудники' },
];

export const AdminUsers: React.FC<AdminUsersProps> = ({ users, setUsers, allowedIps, setAllowedIps }) => {
   const [usersRoleFilter, setUsersRoleFilter] = useState<string>('ALL');
   const [searchQuery, setSearchQuery] = useState('');
   const [editingUser, setEditingUser] = useState<User | null>(null);

   const handleUserUpdated = (userId: string, updates: Partial<User>) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
   };

   return (
      <>
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* User List */}
            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                     <h2 className="text-xl font-bold text-slate-800">Список сотрудников</h2>
                     <div className="flex items-center gap-4 flex-wrap">
                        <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                           <input
                              type="text"
                              className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-korda-500 outline-none w-full sm:w-64"
                              placeholder="Поиск по имени или логину..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                           />
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Роль:</span>
                           <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                              {ROLE_FILTERS.map(r => (
                                 <button key={r.value} onClick={() => setUsersRoleFilter(r.value)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${usersRoleFilter === r.value ? 'bg-white text-korda-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {r.label}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                     <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                        <tr>
                           <th className="px-6 py-4">Сотрудник</th>
                           <th className="px-6 py-4">Логин</th>
                           <th className="px-6 py-4">Роль</th>
                           <th className="px-6 py-4">Статус</th>
                           <th className="px-6 py-4">Действия</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {users.filter(u => {
                           const matchesRole = usersRoleFilter === 'ALL' || u.role === usersRoleFilter;
                           const searchLower = searchQuery.toLowerCase();
                           const matchesSearch = !searchQuery || 
                              u.username.toLowerCase().includes(searchLower) ||
                              u.firstName.toLowerCase().includes(searchLower) ||
                              u.lastName.toLowerCase().includes(searchLower);
                           return matchesRole && matchesSearch;
                        }).sort((a, b) => {
                           if (a.isBlocked && !b.isBlocked) return 1;
                           if (!a.isBlocked && b.isBlocked) return -1;
                           return a.lastName.localeCompare(b.lastName);
                        }).map(u => {
                           const badge = ROLE_BADGE[u.role];
                           return (
                              <tr key={u.id} className="hover:bg-slate-50">
                                 <td className="px-6 py-4 font-bold text-slate-800">{u.lastName} {u.firstName}</td>
                                 <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                    <div className="flex items-center gap-2">
                                       {u.username}
                                       {u.isIpRestricted && (
                                          <span title="Доступ только с корпоративных IP">
                                             <Shield size={14} className="text-korda-500" />
                                          </span>
                                       )}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    {badge && <span className={`px-2 py-1 text-xs font-bold rounded-md border ${badge.classes}`}>{badge.label}</span>}
                                 </td>
                                 <td className="px-6 py-4">
                                    {u.isBlocked
                                       ? <span className="text-red-500 flex items-center gap-1 font-medium"><Lock size={12} /> Заблок.</span>
                                       : <span className="text-korda-600 flex items-center gap-1 font-medium"><Unlock size={12} /> Активен</span>}
                                 </td>
                                 <td className="px-6 py-4">
                                    <Button variant="secondary"
                                       className="py-1 px-3 text-xs border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 flex items-center gap-1"
                                       onClick={() => setEditingUser(u)} title="Редактировать профиль и настройки">
                                       <Pencil size={12} /> Редактировать
                                    </Button>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Right Column */}
            <div className="xl:col-span-1 space-y-6">
               <CreateUserForm onUsersRefresh={setUsers} />
               <AllowedIpsBlock allowedIps={allowedIps} setAllowedIps={setAllowedIps} />
            </div>
         </div>

         {/* Edit User Modal */}
         {editingUser && (
            <EditUserModal
               user={editingUser}
               onClose={() => setEditingUser(null)}
               onUserUpdated={handleUserUpdated}
            />
         )}
      </>
   );
};
