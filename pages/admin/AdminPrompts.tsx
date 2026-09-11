import React, { useState } from 'react';
import { ChatMode, ModePrompts, QuickPrompt } from '../../types';
import { Button } from '../../components/Button';
import { Save, RefreshCw, Globe, HelpCircle } from 'lucide-react';
import { saveSystemSettings } from '../../services/firebaseService';
import { DEFAULT_WELCOME_MESSAGES, DEFAULT_SALES_PROMPT, DEFAULT_TRAINING_PROMPT, DEFAULT_CALCULATION_PROMPT, DEFAULT_DEEP_RESEARCH_PROMPT, DEFAULT_ANALYTICS_PROMPT, DEFAULT_FREE_PROMPT, DEFAULT_KNOWLEDGE_PROMPT } from '../../constants';
import { PromptViewer, MODE_NAMES } from '../../components/admin/PromptViewer';
import { WelcomeEditor } from '../../components/admin/WelcomeEditor';
import { QuickPromptsEditor } from '../../components/admin/QuickPromptsEditor';

interface AdminPromptsProps {
   prompts: ModePrompts;
   setPrompts: React.Dispatch<React.SetStateAction<ModePrompts>>;
   welcomeMessages: Record<ChatMode, string>;
   setWelcomeMessages: React.Dispatch<React.SetStateAction<Record<ChatMode, string>>>;
   quickPrompts: QuickPrompt[];
   setQuickPrompts: React.Dispatch<React.SetStateAction<QuickPrompt[]>>;
   bitrixWebhook: string;
   setBitrixWebhook: React.Dispatch<React.SetStateAction<string>>;
   tenderContext: string;
   setTenderContext: React.Dispatch<React.SetStateAction<string>>;
   baseNegativeKeywords: string;
   setBaseNegativeKeywords: React.Dispatch<React.SetStateAction<string>>;
   searchChips: string;
   setSearchChips: React.Dispatch<React.SetStateAction<string>>;
   searchChipPrompt: string;
   setSearchChipPrompt: React.Dispatch<React.SetStateAction<string>>;
}

export const AdminPrompts: React.FC<AdminPromptsProps> = ({
   prompts, setPrompts,
   welcomeMessages, setWelcomeMessages,
   quickPrompts, setQuickPrompts,
   bitrixWebhook, setBitrixWebhook,
   tenderContext, setTenderContext,
   baseNegativeKeywords, setBaseNegativeKeywords,
   searchChips, setSearchChips,
   searchChipPrompt, setSearchChipPrompt
}) => {
   const [activePromptMode, setActivePromptMode] = useState<ChatMode>(ChatMode.SALES);
   const [activeWelcomeMode, setActiveWelcomeMode] = useState<ChatMode>(ChatMode.SALES);

   const handleSaveSettings = async () => {
      try {
         await saveSystemSettings({
            prompts, welcomeMessages, bitrixWebhook, tenderContext, baseNegativeKeywords,
            searchChips: searchChips.split(',').map(s => s.trim()).filter(Boolean),
            searchChipPrompt
         });
         alert("Настройки успешно сохранены на сервере!");
      } catch (error: any) {
         console.error(error);
         alert("Ошибка сохранения: " + error.message);
      }
   };

   const handleResetDefaults = async () => {
      if (!window.confirm("Вы уверены? Это перезапишет текущие промты и приветствия значениями по умолчанию.")) return;
      const defaultPrompts: ModePrompts = {
         sales: DEFAULT_SALES_PROMPT, training: DEFAULT_TRAINING_PROMPT,
         calculation: DEFAULT_CALCULATION_PROMPT, analytics: DEFAULT_ANALYTICS_PROMPT,
         deep_research: DEFAULT_DEEP_RESEARCH_PROMPT, free: DEFAULT_FREE_PROMPT,
         knowledge: DEFAULT_KNOWLEDGE_PROMPT
      };
      try {
         await saveSystemSettings({ prompts: defaultPrompts, welcomeMessages: DEFAULT_WELCOME_MESSAGES });
         setWelcomeMessages(DEFAULT_WELCOME_MESSAGES);
         setPrompts(defaultPrompts);
         alert("Настройки сброшены до рекомендованных значений Korda!");
      } catch (err: any) {
         console.error(err);
         alert("Ошибка сброса настроек: " + err.message);
      }
   };

   return (
      <div className="space-y-8">
         <div className="flex justify-end mb-4">
            <Button onClick={handleResetDefaults} variant="secondary" className="bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm text-xs">
               <RefreshCw size={14} className="mr-2" /> Сбросить настройки к стандартам Korda
            </Button>
         </div>

         {/* Integrations */}
         <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6">
               <Globe className="text-korda-500" /> Интеграции и Сервисы
            </h2>
            <div>
               <label className="block text-xs font-bold text-slate-500 mb-2 uppercase flex items-center gap-1 group relative w-fit">
                  Глобальный Webhook Bitrix24
                  <div className="relative group/help inline-block ml-1">
                     <HelpCircle size={14} className="text-slate-400 cursor-help hover:text-korda-500 transition-colors" />
                     <div className="absolute left-full top-0 ml-2 w-64 p-4 bg-slate-800 text-white text-xs rounded-xl shadow-xl z-50 pointer-events-none opacity-0 group-hover/help:opacity-100 transition-opacity whitespace-normal font-sans normal-case">
                        <h4 className="font-bold mb-2 text-slate-300 border-b border-slate-600 pb-1">Зачем это нужно?</h4>
                        <p className="text-slate-300">Используется сервером для получения отчетов о звонках и задачах по всей компании.</p>
                     </div>
                  </div>
               </label>
               <div className="flex items-center gap-2">
                  <input type="text" value={bitrixWebhook} onChange={(e) => setBitrixWebhook(e.target.value)}
                     className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-700 text-sm font-mono focus:ring-2 focus:ring-korda-500 outline-none"
                     placeholder="https://test.bitrix24.ru/rest/1/xxxxxxxx/" />
                  <Button onClick={handleSaveSettings} className="shadow-sm">
                     <Save size={18} className="mr-2" /> Сохранить
                  </Button>
               </div>
            </div>
         </div>

         {/* Welcome Messages */}
         <WelcomeEditor
            welcomeMessages={welcomeMessages} setWelcomeMessages={setWelcomeMessages}
            activeMode={activeWelcomeMode} onModeChange={setActiveWelcomeMode}
            modeNames={MODE_NAMES} onSave={handleSaveSettings}
         />

         {/* System Prompt Viewer */}
         <PromptViewer prompts={prompts} activeMode={activePromptMode} onModeChange={setActivePromptMode} />

         {/* Quick Prompts */}
         <QuickPromptsEditor
            quickPrompts={quickPrompts} setQuickPrompts={setQuickPrompts}
            activeMode={activePromptMode} onModeChange={setActivePromptMode}
            modeNames={MODE_NAMES}
         />

         {/* Tender & Search Settings */}
         <div className="space-y-8">
            <SettingsBlock title="📋 Контекст компании для тендеров"
               description="Опишите специфику вашей компании — эта информация используется AI для подбора ключевых слов в разделе Тендеры."
               value={tenderContext} onChange={setTenderContext} onSave={handleSaveSettings}
               placeholder="Например: Компания Корда — инжиниринговая компания по производству теплоизоляции..." height="h-40" />

            <SettingsBlock title="🚫 Базовые минус-слова для тендеров"
               description="Эти слова будут по умолчанию исключаться из результатов поиска тендеров. Вводите через запятую или пробел."
               value={baseNegativeKeywords} onChange={setBaseNegativeKeywords} onSave={handleSaveSettings}
               placeholder="Например: ремонт, запчасти, проектирование, реконструкция..." height="h-32" />

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
               <div className="p-6 border-b border-slate-100">
                  <h2 className="text-xl font-bold text-slate-800">Чипы для поиска клиентов</h2>
                  <p className="text-sm text-slate-500 mt-1">Базовые чипы (кнопки быстрого выбора). Вводите через запятую.</p>
               </div>
               <div className="p-6 space-y-4">
                  <textarea value={searchChips} onChange={(e) => setSearchChips(e.target.value)}
                     placeholder="Строительство, Энергетика ТЭЦ, Нефтегаз, Пищевая промышленность"
                     className="w-full bg-slate-50 border border-slate-300 rounded-lg p-4 text-sm h-20 resize-y focus:ring-2 focus:ring-korda-500 outline-none" />
                  {searchChips && (
                     <div className="flex flex-wrap gap-1.5">
                        {searchChips.split(',').map(s => s.trim()).filter(Boolean).map((chip, i) => (
                           <span key={i} className="text-xs px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-600 font-medium">{chip}</span>
                        ))}
                     </div>
                  )}
                  <Button onClick={handleSaveSettings} className="shadow-sm">💾 Сохранить чипы</Button>
               </div>
            </div>

            <SettingsBlock title="✨ Промпт AI-подсказок (Поиск клиентов)"
               description="Этот промпт используется когда менеджер нажимает «Подсказать варианты»."
               value={searchChipPrompt} onChange={setSearchChipPrompt} onSave={handleSaveSettings}
               placeholder="Ты — эксперт по поиску целевых клиентов для компании..." height="h-48" mono />
         </div>
      </div>
   );
};

/** Reusable settings textarea block */
const SettingsBlock: React.FC<{
   title: string; description: string; value: string;
   onChange: (v: string) => void; onSave: () => void;
   placeholder: string; height?: string; mono?: boolean;
}> = ({ title, description, value, onChange, onSave, placeholder, height = 'h-32', mono }) => (
   <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="p-6 border-b border-slate-100">
         <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">{title}</h2>
         <p className="text-sm text-slate-500 mt-1">{description}</p>
      </div>
      <div className="p-6 space-y-4">
         <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
            className={`w-full bg-slate-50 border border-slate-300 rounded-lg p-4 text-sm ${height} resize-y focus:ring-2 focus:ring-korda-500 outline-none ${mono ? 'font-mono' : ''}`} />
         <Button onClick={onSave} className="shadow-sm">💾 Сохранить</Button>
      </div>
   </div>
);
