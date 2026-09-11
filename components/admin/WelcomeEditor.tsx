/**
 * Welcome message editor with Markdown preview.
 */
import React from 'react';
import { ChatMode } from '../../types';
import { Button } from '../../components/Button';
import { MessageCircle, Eye, HelpCircle, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface WelcomeEditorProps {
   welcomeMessages: Record<ChatMode, string>;
   setWelcomeMessages: React.Dispatch<React.SetStateAction<Record<ChatMode, string>>>;
   activeMode: ChatMode;
   onModeChange: (mode: ChatMode) => void;
   modeNames: Record<ChatMode, string>;
   onSave: () => void;
}

export const WelcomeEditor: React.FC<WelcomeEditorProps> = ({
   welcomeMessages, setWelcomeMessages, activeMode, onModeChange, modeNames, onSave
}) => {
   return (
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <MessageCircle className="text-korda-500" /> Редактор приветствий
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

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
               <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1 group relative w-fit">
                  Текст сообщения (Markdown)
                  <div className="relative group/help inline-block ml-1">
                     <HelpCircle size={14} className="text-slate-400 cursor-help hover:text-korda-500 transition-colors" />
                     <div className="absolute left-full top-0 ml-2 w-64 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-50 pointer-events-none opacity-0 group-hover/help:opacity-100 transition-opacity">
                        <h4 className="font-bold mb-2 text-slate-300 border-b border-slate-600 pb-1">Подсказка по Markdown</h4>
                        <ul className="space-y-1.5 font-mono">
                           <li className="flex justify-between"><span>**Жирный**</span> <span className="text-slate-400 opacity-70">**текст**</span></li>
                           <li className="flex justify-between"><span>*Курсив*</span> <span className="text-slate-400 opacity-70">*текст*</span></li>
                           <li className="flex justify-between"><span># Заголовок</span> <span className="text-slate-400 opacity-70"># Заг.</span></li>
                           <li className="flex justify-between"><span>- Список</span> <span className="text-slate-400 opacity-70">- Элем.</span></li>
                        </ul>
                     </div>
                  </div>
               </label>
               <textarea value={welcomeMessages[activeMode]}
                  onChange={(e) => setWelcomeMessages({ ...welcomeMessages, [activeMode]: e.target.value })}
                  className="w-full h-[300px] bg-slate-50 border border-slate-300 rounded-lg p-4 text-slate-700 text-sm font-mono focus:ring-2 focus:ring-korda-500 outline-none resize-none"
                  placeholder="Введите текст приветствия..." />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1">
                  <Eye size={12} /> Предпросмотр в чате
               </label>
               <div className="h-[300px] overflow-y-auto p-4 bg-white border border-slate-200 rounded-lg rounded-bl-none shadow-sm relative">
                  <div className="prose prose-sm max-w-none prose-slate">
                     <ReactMarkdown remarkPlugins={[remarkGfm]}
                        components={{
                           a: ({ node, ...props }) => (
                              <a {...props} className="text-blue-500 hover:text-blue-700 underline font-medium" target="_blank" rel="noopener noreferrer" />
                           )
                        }}>
                        {welcomeMessages[activeMode] || "*Пустое сообщение*"}
                     </ReactMarkdown>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex justify-end mt-4">
            <Button onClick={onSave} className="shadow-lg shadow-korda-500/10">
               <Save size={18} className="mr-2" /> Сохранить приветствие
            </Button>
         </div>
      </div>
   );
};
