/**
 * Read-only system prompt viewer with mode tabs and copy button.
 */
import React, { useState } from 'react';
import { ChatMode, ModePrompts } from '../../types';
import { FileCode, Copy, AlertTriangle, Briefcase, GraduationCap, Calculator, Search, BarChart3, BookOpen, Zap, Brain, Factory } from 'lucide-react';

const MODE_NAMES: Record<ChatMode, string> = {
   [ChatMode.FREE]: 'Свободный',
   [ChatMode.SALES]: 'Продажи',
   [ChatMode.TRAINING]: 'Обучение',
   [ChatMode.DEEP_RESEARCH]: 'Исследование',
   [ChatMode.CALCULATION]: 'Расчет',
   [ChatMode.ANALYTICS]: 'Аналитика',
   [ChatMode.KNOWLEDGE]: 'База Знаний',
   [ChatMode.NEUROMENTOR]: 'Нейроментор',
   [ChatMode.CONVEYOR]: 'Конвейер'
};

const MODE_ICONS: Record<ChatMode, React.ComponentType<any>> = {
   [ChatMode.SALES]: Briefcase,
   [ChatMode.TRAINING]: GraduationCap,
   [ChatMode.CALCULATION]: Calculator,
   [ChatMode.DEEP_RESEARCH]: Search,
   [ChatMode.ANALYTICS]: BarChart3,
   [ChatMode.KNOWLEDGE]: BookOpen,
   [ChatMode.FREE]: Zap,
   [ChatMode.NEUROMENTOR]: Brain,
   [ChatMode.CONVEYOR]: Factory,
};

const MODE_TO_KEY: Record<ChatMode, keyof ModePrompts> = {
   [ChatMode.SALES]: 'sales',
   [ChatMode.TRAINING]: 'training',
   [ChatMode.CALCULATION]: 'calculation',
   [ChatMode.DEEP_RESEARCH]: 'deep_research',
   [ChatMode.ANALYTICS]: 'analytics',
   [ChatMode.KNOWLEDGE]: 'knowledge',
   [ChatMode.FREE]: 'free',
   [ChatMode.NEUROMENTOR]: 'free',
   [ChatMode.CONVEYOR]: 'calculation',
};

interface PromptViewerProps {
   prompts: ModePrompts;
   activeMode: ChatMode;
   onModeChange: (mode: ChatMode) => void;
}

export const PromptViewer: React.FC<PromptViewerProps> = ({ prompts, activeMode, onModeChange }) => {
   const currentText = prompts[MODE_TO_KEY[activeMode]] || 'Промт не найден';

   return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center gap-2">
               <FileCode size={20} className="text-slate-500" />
               <h3 className="font-bold text-slate-700">Просмотр системного промта</h3>
            </div>
            <div className="flex bg-slate-200 p-1 rounded-lg gap-1 overflow-x-auto max-w-full">
               {Object.values(ChatMode).map(mode => {
                  const Icon = MODE_ICONS[mode];
                  return (
                     <button key={mode} onClick={() => onModeChange(mode)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${activeMode === mode ? 'bg-white text-korda-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-300/50'}`}>
                        {Icon && <Icon size={12} />}
                        {MODE_NAMES[mode]}
                     </button>
                  );
               })}
            </div>
         </div>
         <div className="p-0 relative group">
            <textarea readOnly value={currentText} className="w-full h-[500px] p-6 text-sm font-mono text-slate-600 bg-white outline-none resize-none" />
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 p-1 rounded-lg border border-slate-200 shadow-sm backdrop-blur-sm">
               <button onClick={() => { navigator.clipboard.writeText(currentText); alert("Скопировано!"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs font-bold transition-colors">
                  <Copy size={14} /> Копировать
               </button>
               <div className="w-px bg-slate-300 mx-1" />
               <span className="px-2 py-1.5 text-xs font-mono text-slate-400">READ-ONLY</span>
            </div>
         </div>
         <div className="bg-amber-50 border-t border-amber-100 p-3 text-xs text-amber-800 flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" />
            <span>
               Редактирование отключено для безопасности.
               Чтобы изменить логику работы, обратитесь к разработчику (изменения в файле <code>prompts.ts</code>).
               Для восстановления эталонных значений используйте кнопку "Сбросить настройки" выше.
            </span>
         </div>
      </div>
   );
};

export { MODE_NAMES };
