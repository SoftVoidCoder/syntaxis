/**
 * IP whitelist management block for admin panel.
 */
import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Shield, Plus, Trash2 } from 'lucide-react';
import { saveSystemSettings } from '../../services/firebaseService';

interface AllowedIpsBlockProps {
   allowedIps: string[];
   setAllowedIps: React.Dispatch<React.SetStateAction<string[]>>;
}

export const AllowedIpsBlock: React.FC<AllowedIpsBlockProps> = ({ allowedIps, setAllowedIps }) => {
   const [newAllowedIp, setNewAllowedIp] = useState('');

   const handleAddIp = async () => {
      const trimmed = newAllowedIp.trim();
      if (!trimmed) return;
      const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
      if (!ipRegex.test(trimmed)) {
         alert('Неверный формат IP-адреса. Пример: 192.168.1.1');
         return;
      }
      if (allowedIps.map(ip => ip.trim()).includes(trimmed)) {
         alert('Этот IP уже есть в списке.');
         return;
      }
      const updated = [...allowedIps, trimmed];
      setAllowedIps(updated);
      setNewAllowedIp('');
      await saveSystemSettings({ allowedIps: updated });
   };

   const handleRemoveIp = async (ip: string) => {
      const updated = allowedIps.filter(item => item !== ip);
      setAllowedIps(updated);
      await saveSystemSettings({ allowedIps: updated });
   };

   return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
         <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="text-korda-500" size={20} />
            Разрешенные IP адреса
         </h3>
         <p className="text-xs text-slate-500 mb-4">
            Пользователи с галочкой "Ограничить по IP" смогут войти только с этих IP.
         </p>
         <div className="flex gap-2 mb-4">
            <input type="text" placeholder="Например: 123.45.67.89"
               className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-korda-500"
               value={newAllowedIp} onChange={e => setNewAllowedIp(e.target.value)} />
            <Button onClick={handleAddIp} className="bg-slate-800 text-white hover:bg-slate-700">
               <Plus size={16} />
            </Button>
         </div>
         <div className="space-y-2 max-h-40 overflow-y-auto">
            {allowedIps.map((ip, idx) => (
               <div key={idx} className="flex items-center justify-between text-sm bg-slate-50 p-2 rounded border border-slate-100">
                  <span className="font-mono text-slate-700">{ip}</span>
                  <button onClick={() => handleRemoveIp(ip)} className="text-red-400 hover:text-red-600">
                     <Trash2 size={14} />
                  </button>
               </div>
            ))}
            {allowedIps.length === 0 && (
               <p className="text-xs text-center text-slate-400 py-2">Список пуст</p>
            )}
         </div>
      </div>
   );
};
