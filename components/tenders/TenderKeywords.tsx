import React from 'react';
import { Search, Sparkles, X, ChevronDown, Loader2 } from 'lucide-react';

interface TenderKeywordsProps {
   showKeywords: boolean;
   onToggleKeywords: () => void;
   hardcodedKeywords: string[];
   activeKeywords: string[];
   onToggleKeyword: (word: string) => void;
   aiKeywords: string[];
   onRemoveAiKeyword: (word: string) => void;
   onClearAiKeywords: () => void;
   aiKeywordsEnabled: boolean;
   onSetAiKeywordsEnabled: (v: boolean) => void;
   aiTyposEnabled: boolean;
   onSetAiTyposEnabled: (v: boolean) => void;
   aiWordCount: number;
   onSetAiWordCount: (n: number) => void;
   isAiLoading: boolean;
   onGenerateAiKeywords: () => void;
   strictSearch: boolean;
   onSetStrictSearch: (v: boolean) => void;
   useBaseNegativeKeywords: boolean;
   onSetUseBaseNegativeKeywords: (v: boolean) => void;
}

export const TenderKeywords: React.FC<TenderKeywordsProps> = ({
   showKeywords, onToggleKeywords,
   hardcodedKeywords, activeKeywords, onToggleKeyword,
   aiKeywords, onRemoveAiKeyword, onClearAiKeywords,
   aiKeywordsEnabled, onSetAiKeywordsEnabled,
   aiTyposEnabled, onSetAiTyposEnabled,
   aiWordCount, onSetAiWordCount,
   isAiLoading, onGenerateAiKeywords,
   strictSearch, onSetStrictSearch,
   useBaseNegativeKeywords, onSetUseBaseNegativeKeywords,
}) => (
   <div className="bg-slate-50/80 border border-slate-200/50 rounded-xl overflow-hidden">
      <button
         onClick={onToggleKeywords}
         className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100/50 transition-colors"
      >
         <span className="flex items-center gap-2">
            <Search size={14} className="text-slate-400" />
            Ключевые слова для поиска
            <span className="text-xs text-slate-400 font-normal">({activeKeywords.length + aiKeywords.length} активных)</span>
         </span>
         <ChevronDown size={16} className={`text-slate-400 transition-transform ${showKeywords ? 'rotate-180' : ''}`} />
      </button>

      {showKeywords && (
         <div className="px-4 pb-4 space-y-3 border-t border-slate-200/50">
            <div className="flex flex-wrap gap-2 pt-3">
               {hardcodedKeywords.map(word => (
                  <button
                     key={word}
                     onClick={() => onToggleKeyword(word)}
                     className={`px-3 py-1.5 text-sm rounded-lg border transition-all font-medium ${activeKeywords.includes(word)
                        ? 'bg-korda-100 text-korda-700 border-korda-300 shadow-sm'
                        : 'bg-white text-slate-400 border-slate-200 line-through opacity-60 hover:opacity-80'
                        }`}
                  >
                     {word}
                  </button>
               ))}
               {aiKeywords.map(word => (
                  <span key={word} className="px-3 py-1.5 text-sm rounded-lg border bg-violet-50 text-violet-700 border-violet-200 font-medium flex items-center gap-1.5 shadow-sm">
                     <Sparkles size={12} />
                     {word}
                     <button onClick={() => onRemoveAiKeyword(word)} className="ml-0.5 hover:text-red-500 transition-colors">
                        <X size={12} />
                     </button>
                  </span>
               ))}
            </div>

            <div className="flex items-center gap-4 pt-1 border-t border-slate-200/50">
               <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
                  <input type="checkbox" checked={aiKeywordsEnabled} onChange={e => onSetAiKeywordsEnabled(e.target.checked)} className="rounded text-violet-600 focus:ring-violet-500 w-4 h-4" />
                  <Sparkles size={14} className="text-violet-500" />
                  AI подбор слов
               </label>

               {aiKeywordsEnabled && (
                  <>
                     <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0 border-l border-slate-200 pl-4">
                        <div onClick={() => onSetAiTyposEnabled(!aiTyposEnabled)} className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${aiTyposEnabled ? 'bg-violet-600' : 'bg-slate-300'}`}>
                           <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${aiTyposEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-xs text-slate-600">С ошибками</span>
                     </label>

                     <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                        <span className="text-xs text-slate-500 shrink-0">Слов:</span>
                        {[60, 120, 300].map(n => (
                           <button key={n} onClick={() => onSetAiWordCount(n)} className={`px-2 py-0.5 text-xs rounded-md transition-all font-medium ${aiWordCount === n ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                              {n}
                           </button>
                        ))}
                     </div>
                     <div className="flex gap-2 shrink-0">
                        <button onClick={onGenerateAiKeywords} disabled={isAiLoading} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                           {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                           Подобрать
                        </button>
                        {aiKeywords.length > 0 && (
                           <button onClick={onClearAiKeywords} className="px-2 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center shadow-sm" title="Очистить сгенерированные слова">
                              <X size={16} />
                           </button>
                        )}
                     </div>
                  </>
               )}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200/50">
               <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
                  <div onClick={() => onSetStrictSearch(!strictSearch)} className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${strictSearch ? 'bg-korda-500' : 'bg-slate-300'}`}>
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${strictSearch ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-slate-700 font-medium">Строгий поиск</span>
               </label>

               <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0 border-l border-slate-200 pl-4">
                  <div onClick={() => onSetUseBaseNegativeKeywords(!useBaseNegativeKeywords)} className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${useBaseNegativeKeywords ? 'bg-rose-500' : 'bg-slate-300'}`}>
                     <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${useBaseNegativeKeywords ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-slate-700 font-medium">Базовые минус-слова</span>
               </label>
            </div>
         </div>
      )}
   </div>
);
