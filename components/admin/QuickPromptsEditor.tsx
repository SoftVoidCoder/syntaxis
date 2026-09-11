/**
 * Quick prompts list and add form.
 */
import React, { useState } from 'react';
import { ChatMode, QuickPrompt } from '../../types';
import { Button } from '../../components/Button';
import { Zap, MessageSquare, Trash2, Plus } from 'lucide-react';
import { saveSystemSettings } from '../../services/firebaseService';

interface QuickPromptsEditorProps {
   quickPrompts: QuickPrompt[];
   setQuickPrompts: React.Dispatch<React.SetStateAction<QuickPrompt[]>>;
   activeMode: ChatMode;
   onModeChange: (mode: ChatMode) => void;
   modeNames: Record<ChatMode, string>;
}

export const QuickPromptsEditor: React.FC<QuickPromptsEditorProps> = ({
   quickPrompts, setQuickPrompts, activeMode, onModeChange, modeNames
}) => {
   const [newTitle, setNewTitle] = useState('');
   const [newContent, setNewContent] = useState('');

   const handleAdd = async () => {
      if (!newTitle || !newContent) return;
      const newPrompt: QuickPrompt = { id: crypto.randomUUID(), title: newTitle, content: newContent, mode: activeMode };
      const updated = [...quickPrompts, newPrompt];
      setQuickPrompts(updated);
      setNewTitle(''); setNewContent('');
      try { await saveSystemSettings({ quickPrompts: updated }); }
      catch (err) { console.error("Failed to save quick prompts", err); alert("Ошибка сохранения шаблона на сервере"); }
   };

   const handleDelete = async (id: string) => {
      const updated = quickPrompts.filter(p => p.id !== id);
      setQuickPrompts(updated);
      try { await saveSystemSettings({ quickPrompts: updated }); }
      catch (err) { console.error("Failed to save quick prompts", err); alert("Ошибка удаления шаблона с сервера"); }
   };

   const filtered = quickPrompts.filter(p => p.mode === activeMode);

   return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <Zap className="text-yellow-500" /> Шаблоны сообщений (Quick Prompts)
            </h2>
            <div className="flex items-center gap-2">
               <span className="text-sm font-bold text-slate-600">Для режима:</span>
               <select value={activeMode} onChange={(e) => onModeChange(e.target.value as ChatMode)}
                  className="bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-korda-500 outline-none">
                  {Object.values(ChatMode).map(mode => (
                     <option key={mode} value={mode}>{modeNames[mode]}</option>
                  ))}
               </select>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-3">
               <h3 className="font-bold text-slate-800 mb-2">Существующие шаблоны</h3>
               {filtered.length === 0 && (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-400">
                     Нет шаблонов для этого режима
                  </div>
               )}
               {filtered.map(prompt => (
                  <div key={prompt.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-between items-start group hover:shadow-md transition-all">
                     <div className="flex-1 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                           <MessageSquare size={14} className="text-slate-400" />
                           <h4 className="font-bold text-slate-800">{prompt.title}</h4>
                        </div>
                        <p className="text-sm text-slate-600 line-clamp-2">{prompt.content}</p>
                     </div>
                     <button onClick={() => handleDelete(prompt.id)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                     </button>
                  </div>
               ))}
            </div>

            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 h-fit">
               <h3 className="font-bold text-slate-800 mb-4">Добавить новый шаблон</h3>
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Заголовок (кнопка)</label>
                     <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Например: Запрос КП"
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-korda-500 outline-none" />
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Текст сообщения</label>
                     <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Текст, который вставится в чат..."
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm h-32 resize-none focus:ring-2 focus:ring-korda-500 outline-none" />
                  </div>
                  <Button onClick={handleAdd} className="w-full shadow-sm" disabled={!newTitle || !newContent}>
                     <Plus size={16} className="mr-2" /> Добавить
                  </Button>
               </div>
            </div>
         </div>
      </div>
   );
};
