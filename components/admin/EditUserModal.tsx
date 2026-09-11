/**
 * Modal for editing user profile, permissions, and access controls.
 */
import React, { useState, useEffect } from 'react';
import { User, UserRole, UserCity } from '../../types';
import { Button } from '../../components/Button';
import { X, Lock, Unlock, KeyRound, AlertTriangle, Image as ImageIcon, Video, Briefcase, ClipboardList, BarChart3, Calculator, BookOpen, Search as SearchIcon, BrainCircuit, Factory, FlaskConical, FileText } from 'lucide-react';
import { updateUserProfile, toggleUserBlockInFirebase, updateUserPassword } from '../../services/firebaseService';

interface EditUserModalProps {
   user: User;
   onClose: () => void;
   onUserUpdated: (userId: string, updates: Partial<User>) => void;
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onUserUpdated }) => {
   const [editForm, setEditForm] = useState({
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      bitrixUserId: user.bitrixUserId || '',
      city: user.city || UserCity.SPB as UserCity,
      canGenerateImages: user.permissions?.canGenerateImages || false,
      canGenerateVideos: user.permissions?.canGenerateVideos || false,
      canSearchClients: user.permissions?.canSearchClients || false,
      canAccessTenders: user.permissions?.canAccessTenders || false,
      canAccessSales: user.permissions?.canAccessSales || false,
      canAccessAnalytics: user.permissions?.canAccessAnalytics || false,
      canAccessCalculation: user.permissions?.canAccessCalculation || false,
      canAccessConveyor: user.permissions?.canAccessConveyor || false,
      canAccessKnowledge: user.permissions?.canAccessKnowledge || false,
      canAccessDeepResearch: user.permissions?.canAccessDeepResearch || false,
      canAccessSandbox: user.permissions?.canAccessSandbox || false,
      sandboxApps: user.permissions?.sandboxApps || [] as string[],
      isIpRestricted: user.isIpRestricted || false
   });

   // Password Reset
   const [resetModal, setResetModal] = useState(false);
   const [newResetPassword, setNewResetPassword] = useState('');

   const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
         const updates: Partial<User> = {
            firstName: editForm.firstName,
            lastName: editForm.lastName,
            role: editForm.role,
            bitrixUserId: editForm.bitrixUserId,
            city: editForm.city,
            isIpRestricted: editForm.isIpRestricted,
            permissions: {
               canGenerateImages: editForm.canGenerateImages,
               canGenerateVideos: editForm.canGenerateVideos,
               canSearchClients: editForm.canSearchClients,
               canAccessTenders: editForm.canAccessTenders,
               canAccessSales: editForm.canAccessSales,
               canAccessAnalytics: editForm.canAccessAnalytics,
               canAccessCalculation: editForm.canAccessCalculation,
               canAccessConveyor: editForm.canAccessConveyor,
               canAccessKnowledge: editForm.canAccessKnowledge,
               canAccessDeepResearch: editForm.canAccessDeepResearch,
               canAccessSandbox: editForm.canAccessSandbox,
               sandboxApps: editForm.sandboxApps
            }
         };
         await updateUserProfile(user.id, updates);
         onUserUpdated(user.id, updates);
         onClose();
         alert("Пользователь успешно обновлен");
      } catch (err: any) {
         console.error("Failed to update user:", err);
         alert("Ошибка обновления: " + err.message);
      }
   };

   const handleBlockToggle = async () => {
      try {
         await toggleUserBlockInFirebase(user.id, !user.isBlocked);
         onUserUpdated(user.id, { isBlocked: !user.isBlocked });
         onClose();
      } catch (err) {
         console.error(err);
         alert("Ошибка при изменении статуса");
      }
   };

   const handleConfirmResetPassword = async () => {
      if (!newResetPassword) return;
      try {
         await updateUserPassword(user.id, newResetPassword);
         alert(`Пароль для ${user.username} успешно изменен!`);
         setResetModal(false);
      } catch (err: any) {
         console.error(err);
         alert("Ошибка смены пароля: " + err.message);
      }
   };

   const PERMISSIONS = [
      { id: 'perm_img', key: 'canGenerateImages' as const, label: 'Генерация изображений (Design Studio)', icon: ImageIcon },
      { id: 'perm_video', key: 'canGenerateVideos' as const, label: 'Генерация видео', icon: Video },
      { id: 'perm_search', key: 'canSearchClients' as const, label: 'Поиск клиентов (Lead Gen)', icon: SearchIcon },
      { id: 'perm_tenders', key: 'canAccessTenders' as const, label: 'Тендеры (Закупки Kontur)', icon: ClipboardList },
      { id: 'perm_sales', key: 'canAccessSales' as const, label: 'Доступ к разделу "Продажи"', icon: Briefcase },
      { id: 'perm_analytics', key: 'canAccessAnalytics' as const, label: 'Доступ к разделу "Аналитика"', icon: BarChart3 },
      { id: 'perm_calc', key: 'canAccessCalculation' as const, label: 'Доступ к разделу "Расчеты"', icon: Calculator },
      { id: 'perm_conveyor', key: 'canAccessConveyor' as const, label: 'Доступ к разделу "Конвейер" (НейроРасчеты)', icon: Factory },
      { id: 'perm_knowledge', key: 'canAccessKnowledge' as const, label: 'Доступ к разделу "База Знаний" (RAG)', icon: BookOpen },
      { id: 'perm_deep', key: 'canAccessDeepResearch' as const, label: 'Доступ к разделу "Глубокий Анализ"', icon: BrainCircuit },
      { id: 'perm_sandbox', key: 'canAccessSandbox' as const, label: 'Доступ к разделу "Лаба"', icon: FlaskConical },
   ];

   const SANDBOX_APPS = [
      { id: 'consilium', label: 'Консилиум — Площадь Шрёдингера', icon: FileText },
   ];

   const toggleSandboxApp = (appId: string) => {
      setEditForm(prev => {
         const current = prev.sandboxApps || [];
         const next = current.includes(appId) ? current.filter((id: string) => id !== appId) : [...current, appId];
         return { ...prev, sandboxApps: next };
      });
   };

   // Password Reset sub-modal
   if (resetModal) {
      return (
         <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
               <h3 className="text-xl font-bold text-slate-800 mb-4">
                  Смена пароля для {user.username}
               </h3>
               <div className="space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">Новый пароль</label>
                     <input type="text" value={newResetPassword} onChange={(e) => setNewResetPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-korda-500 outline-none"
                        placeholder="Введите новый пароль..." />
                  </div>
                  <div className="flex gap-3 justify-end pt-4">
                     <Button onClick={() => setResetModal(false)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 shadow-none border border-slate-200">Отмена</Button>
                     <Button onClick={handleConfirmResetPassword} disabled={!newResetPassword} className="shadow-lg shadow-korda-500/20">Сохранить</Button>
                  </div>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
         <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-slate-800">Редактирование пользователя</h3>
               <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">Имя</label>
                     <input type="text" required className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">Фамилия</label>
                     <input type="text" required className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} />
                  </div>
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Роль в системе</label>
                  <select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value as UserRole })}>
                     <option value={UserRole.USER}>Сотрудник</option>
                     <option value={UserRole.CONSTRUCTOR}>Сметчик</option>
                     <option value={UserRole.MANAGER}>Менеджер</option>
                     <option value={UserRole.SUPERVISOR}>Управленец</option>
                     <option value={UserRole.ADMIN}>Администратор</option>
                     <option value={UserRole.DIRECTOR}>Генеральный директор</option>
                  </select>
               </div>

               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Город</label>
                  <select className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none" value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value as UserCity })}>
                     <option value={UserCity.SPB}>Санкт-Петербург</option>
                     <option value={UserCity.PENZA}>Пенза</option>
                     <option value={UserCity.MOSCOW}>Москва</option>
                     <option value={UserCity.VELIKY_NOVGOROD}>Великий Новгород</option>
                  </select>
               </div>

               <div className="pt-2 border-t border-slate-100 mt-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                     Ограничение доступа
                     <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Безопасность</span>
                  </label>
                  <div className="flex items-center gap-2 mt-2">
                     <input type="checkbox" id="ip_restrict" className="w-4 h-4 text-korda-600 rounded border-slate-300 focus:ring-korda-500" checked={editForm.isIpRestricted || false} onChange={e => setEditForm({ ...editForm, isIpRestricted: e.target.checked })} />
                     <label htmlFor="ip_restrict" className="text-sm text-slate-700 cursor-pointer">Разрешить вход только с корпоративных IP</label>
                  </div>
               </div>

               <div className="pt-2 border-t border-slate-100 mt-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center justify-between">
                     Bitrix User ID
                     <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Для отчетов</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">Укажите числовой ID пользователя из Bitrix24, чтобы привязать отчетность к конкретному человеку. Если пусто — отчет ищется по Фамилии.</p>
                  <input type="text" placeholder="Например: 142" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none font-mono" value={editForm.bitrixUserId} onChange={e => setEditForm({ ...editForm, bitrixUserId: e.target.value })} />
               </div>

               <div className="pt-4 border-t border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Права доступа</label>
                  <div className="space-y-2">
                     {PERMISSIONS.map(perm => (
                        <div key={perm.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                           <input type="checkbox" id={perm.id} checked={(editForm as any)[perm.key]} onChange={e => setEditForm({ ...editForm, [perm.key]: e.target.checked })} className="w-4 h-4 text-korda-600 rounded border-slate-300 focus:ring-korda-500" />
                           <label htmlFor={perm.id} className="text-sm text-slate-700 flex-1 cursor-pointer">{perm.label}</label>
                           <perm.icon size={16} className="text-slate-400" />
                        </div>
                     ))}
                  </div>
               </div>

               {editForm.canAccessSandbox && (
                  <div className="pt-2 border-t border-slate-100">
                     <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
                        Приложения Лабы
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Enterprise</span>
                     </label>
                     <div className="space-y-2">
                        {SANDBOX_APPS.map(app => (
                           <div key={app.id} className="flex items-center gap-3 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                              <input type="checkbox" id={`sandbox_${app.id}`} checked={editForm.sandboxApps?.includes(app.id) || false} onChange={() => toggleSandboxApp(app.id)} className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" />
                              <label htmlFor={`sandbox_${app.id}`} className="text-sm text-slate-700 flex-1 cursor-pointer">{app.label}</label>
                              <app.icon size={16} className="text-emerald-500" />
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               <div className="pt-4 border-t border-slate-100">
                  <label className="block text-sm font-bold text-slate-700 mb-2 text-red-600 flex items-center gap-2">
                     <AlertTriangle size={16} /> Управление доступом
                  </label>
                  <div className="flex flex-wrap gap-2 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                     <Button type="button" onClick={handleBlockToggle} variant="secondary"
                        className={`text-xs ${user.isBlocked ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} hover:opacity-80`}>
                        {user.isBlocked ? <Unlock size={14} className="mr-1" /> : <Lock size={14} className="mr-1" />}
                        {user.isBlocked ? 'Разблокировать пользователя' : 'Заблокировать пользователя'}
                     </Button>
                     <Button type="button" onClick={() => setResetModal(true)} variant="secondary"
                        className="text-xs bg-white text-slate-600 border border-slate-200 hover:bg-slate-100">
                        <KeyRound size={14} className="mr-1" /> Сменить пароль
                     </Button>
                  </div>
               </div>

               <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" onClick={onClose} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200">Отмена</Button>
                  <Button type="submit" className="shadow-lg shadow-korda-500/20">Сохранить изменения</Button>
               </div>
            </form>
         </div>
      </div>
   );
};
