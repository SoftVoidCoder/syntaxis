/**
 * Form for creating new users in the admin panel.
 */
import React, { useState } from 'react';
import { User, UserRole, UserCity } from '../../types';
import { Button } from '../../components/Button';
import { UserPlus } from 'lucide-react';
import { createUserInFirebase, getAllUsersFromFirebase } from '../../services/firebaseService';

interface CreateUserFormProps {
   onUsersRefresh: (users: User[]) => void;
}

export const CreateUserForm: React.FC<CreateUserFormProps> = ({ onUsersRefresh }) => {
   const [newUser, setNewUser] = useState({ username: '', firstName: '', lastName: '', password: '', role: UserRole.MANAGER, bitrixUserId: '', city: UserCity.SPB as UserCity });

   const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUser.username || !newUser.password) return;

      const email = newUser.username.includes('@') ? newUser.username : `${newUser.username}@korda.spb.ru`;

      const u: User = {
         id: '',
         username: newUser.username,
         email: email,
         firstName: newUser.firstName || newUser.username,
         lastName: newUser.lastName || '',
         password: newUser.password,
         role: newUser.role,
         isBlocked: false,
         permissions: { canGenerateImages: false, canGenerateVideos: false },
         bitrixUserId: newUser.bitrixUserId,
         city: newUser.city,
         isIpRestricted: true // Default to true as requested
      };

      try {
         await createUserInFirebase(u, newUser.password);
         const updatedUsers = await getAllUsersFromFirebase();
         onUsersRefresh(updatedUsers);
         setNewUser({ username: '', firstName: '', lastName: '', password: '', role: UserRole.MANAGER, bitrixUserId: '', city: UserCity.SPB });
         alert("Пользователь успешно создан");
      } catch (err: any) {
         console.error(err);
         alert("Ошибка при создании: " + err.message);
      }
   };

   return (
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm h-fit">
         <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
            <UserPlus size={20} className="text-korda-500" /> Создать пользователя
         </h2>
         <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Имя</label>
                  <input type="text" required className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Фамилия</label>
                  <input type="text" required className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} />
               </div>
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">ID в Bitrix24 (для отчетов)</label>
               <input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" placeholder="Например: 123" value={newUser.bitrixUserId} onChange={e => setNewUser({ ...newUser, bitrixUserId: e.target.value })} />
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Город</label>
               <select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={newUser.city} onChange={e => setNewUser({ ...newUser, city: e.target.value as UserCity })}>
                  <option value={UserCity.SPB}>Санкт-Петербург</option>
                  <option value={UserCity.PENZA}>Пенза</option>
                  <option value={UserCity.MOSCOW}>Москва</option>
                  <option value={UserCity.VELIKY_NOVGOROD}>Великий Новгород</option>
               </select>
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Логин</label>
               <input type="text" required className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Пароль</label>
               <input type="text" required className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Роль</label>
               <select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}>
                  <option value={UserRole.USER}>Сотрудник</option>
                  <option value={UserRole.CONSTRUCTOR}>Сметчик</option>
                  <option value={UserRole.MANAGER}>Менеджер</option>
                  <option value={UserRole.SUPERVISOR}>Управленец</option>
                  <option value={UserRole.ADMIN}>Администратор</option>
               </select>
            </div>
            <Button type="submit" className="w-full mt-2 shadow-lg shadow-korda-500/20">Создать</Button>
         </form>
      </div>
   );
};
