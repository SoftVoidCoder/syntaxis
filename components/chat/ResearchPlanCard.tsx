import React, { useState } from 'react';
import { CheckSquare, Square, Trash2, Rocket, Clock, ListChecks, Edit3, Plus, X, Check } from 'lucide-react';

interface ResearchSection {
   id: string;
   title: string;
   questions: string[];
   search_queries: string[];
   enabled?: boolean;
}

interface ResearchPlan {
   title: string;
   estimated_time: string;
   sections: ResearchSection[];
}

interface ResearchPlanCardProps {
   plan: ResearchPlan;
   onApprove: (plan: ResearchPlan) => void;
   isApproved?: boolean;
}

export const ResearchPlanCard: React.FC<ResearchPlanCardProps> = ({ plan: initialPlan, onApprove, isApproved = false }) => {
   const [plan, setPlan] = useState<ResearchPlan>(() => ({
      ...initialPlan,
      sections: initialPlan.sections.map(s => ({ ...s, enabled: s.enabled !== false }))
   }));
   const [editingSection, setEditingSection] = useState<string | null>(null);
   const [editTitle, setEditTitle] = useState('');
   const [editingQuestion, setEditingQuestion] = useState<{ sectionId: string; qIdx: number } | null>(null);
   const [editQuestionText, setEditQuestionText] = useState('');
   const [addingQuestionTo, setAddingQuestionTo] = useState<string | null>(null);
   const [newQuestionText, setNewQuestionText] = useState('');
   const [showAddSection, setShowAddSection] = useState(false);
   const [newSectionTitle, setNewSectionTitle] = useState('');

   const toggleSection = (id: string) => {
      if (isApproved) return;
      setPlan(prev => ({
         ...prev,
         sections: prev.sections.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
      }));
   };

   const removeSection = (id: string) => {
      if (isApproved) return;
      setPlan(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== id) }));
   };

   const startEditingTitle = (section: ResearchSection) => {
      if (isApproved) return;
      setEditingSection(section.id);
      setEditTitle(section.title);
   };

   const saveTitle = (id: string) => {
      if (!editTitle.trim()) return;
      setPlan(prev => ({
         ...prev,
         sections: prev.sections.map(s => s.id === id ? { ...s, title: editTitle.trim() } : s)
      }));
      setEditingSection(null);
   };

   // Question editing
   const startEditingQuestion = (sectionId: string, qIdx: number, text: string) => {
      if (isApproved) return;
      setEditingQuestion({ sectionId, qIdx });
      setEditQuestionText(text);
   };

   const saveQuestion = () => {
      if (!editingQuestion || !editQuestionText.trim()) return;
      setPlan(prev => ({
         ...prev,
         sections: prev.sections.map(s => {
            if (s.id !== editingQuestion.sectionId) return s;
            const newQ = [...s.questions];
            newQ[editingQuestion.qIdx] = editQuestionText.trim();
            return { ...s, questions: newQ };
         })
      }));
      setEditingQuestion(null);
   };

   const removeQuestion = (sectionId: string, qIdx: number) => {
      if (isApproved) return;
      setPlan(prev => ({
         ...prev,
         sections: prev.sections.map(s => {
            if (s.id !== sectionId) return s;
            return { ...s, questions: s.questions.filter((_, i) => i !== qIdx) };
         })
      }));
   };

   const addQuestion = (sectionId: string) => {
      if (!newQuestionText.trim()) return;
      setPlan(prev => ({
         ...prev,
         sections: prev.sections.map(s => {
            if (s.id !== sectionId) return s;
            return { ...s, questions: [...s.questions, newQuestionText.trim()] };
         })
      }));
      setNewQuestionText('');
      setAddingQuestionTo(null);
   };

   // Add new section
   const addSection = () => {
      if (!newSectionTitle.trim()) return;
      const newId = String(Date.now());
      setPlan(prev => ({
         ...prev,
         sections: [...prev.sections, {
            id: newId,
            title: newSectionTitle.trim(),
            questions: [],
            search_queries: [],
            enabled: true
         }]
      }));
      setNewSectionTitle('');
      setShowAddSection(false);
   };

   const enabledCount = plan.sections.filter(s => s.enabled !== false).length;

   return (
      <div className={`rounded-2xl border-2 overflow-hidden transition-all ${isApproved
         ? 'border-emerald-200 bg-emerald-50/30'
         : 'border-indigo-200 bg-gradient-to-b from-indigo-50/80 to-white'
         }`}>
         {/* Header */}
         <div className={`px-5 py-4 flex items-center justify-between ${isApproved ? 'bg-emerald-100/50' : 'bg-indigo-100/50'}`}>
            <div className="flex items-center gap-3">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isApproved ? 'bg-emerald-500' : 'bg-indigo-500'}`}>
                  <ListChecks size={20} className="text-white" />
               </div>
               <div>
                  <h3 className="font-bold text-slate-800 text-base">{plan.title}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                     <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={10} /> ~{plan.estimated_time}
                     </span>
                     <span className="text-xs text-slate-500">
                        {enabledCount} из {plan.sections.length} секций
                     </span>
                  </div>
               </div>
            </div>
            {isApproved && (
               <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                  ✓ Запущено
               </span>
            )}
         </div>

         {/* Sections */}
         <div className="p-4 space-y-2">
            {plan.sections.map((section, idx) => (
               <div
                  key={section.id}
                  className={`rounded-xl border p-3 transition-all ${section.enabled !== false
                     ? 'bg-white border-slate-200 shadow-sm'
                     : 'bg-slate-50 border-slate-100 opacity-50'
                     }`}
               >
                  <div className="flex items-start gap-3">
                     {/* Checkbox */}
                     {!isApproved && (
                        <button
                           onClick={() => toggleSection(section.id)}
                           className={`mt-0.5 shrink-0 transition-colors ${section.enabled !== false ? 'text-indigo-500' : 'text-slate-300'}`}
                        >
                           {section.enabled !== false ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                     )}

                     <div className="flex-1 min-w-0">
                        {/* Section Title */}
                        {editingSection === section.id ? (
                           <div className="flex items-center gap-1">
                              <input
                                 type="text"
                                 value={editTitle}
                                 onChange={(e) => setEditTitle(e.target.value)}
                                 onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(section.id); if (e.key === 'Escape') setEditingSection(null); }}
                                 className="flex-1 px-2 py-1 text-sm font-semibold border border-indigo-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                                 autoFocus
                              />
                              <button onClick={() => saveTitle(section.id)} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded"><Check size={14} /></button>
                              <button onClick={() => setEditingSection(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14} /></button>
                           </div>
                        ) : (
                           <div className="flex items-center gap-2 group">
                              <span className="text-xs font-bold text-indigo-400 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                              <span className={`text-sm font-semibold ${section.enabled !== false ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                 {section.title}
                              </span>
                              {!isApproved && (
                                 <button onClick={() => startEditingTitle(section)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-indigo-500 transition-all">
                                    <Edit3 size={12} />
                                 </button>
                              )}
                           </div>
                        )}

                        {/* Questions — Editable */}
                        {section.enabled !== false && (
                           <div className="mt-1.5 space-y-1 pl-6">
                              {section.questions.map((q, qi) => (
                                 <div key={qi} className="group flex items-start gap-1">
                                    {editingQuestion?.sectionId === section.id && editingQuestion?.qIdx === qi ? (
                                       <div className="flex items-center gap-1 flex-1">
                                          <input
                                             type="text"
                                             value={editQuestionText}
                                             onChange={(e) => setEditQuestionText(e.target.value)}
                                             onKeyDown={(e) => { if (e.key === 'Enter') saveQuestion(); if (e.key === 'Escape') setEditingQuestion(null); }}
                                             className="flex-1 px-2 py-0.5 text-xs border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-400"
                                             autoFocus
                                          />
                                          <button onClick={saveQuestion} className="text-emerald-500 hover:bg-emerald-50 rounded p-0.5"><Check size={12} /></button>
                                          <button onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:bg-slate-100 rounded p-0.5"><X size={12} /></button>
                                       </div>
                                    ) : (
                                       <>
                                          <p
                                             className={`text-xs text-slate-500 flex-1 ${!isApproved ? 'cursor-pointer hover:text-slate-700' : ''}`}
                                             onClick={() => !isApproved && startEditingQuestion(section.id, qi, q)}
                                          >
                                             • {q}
                                          </p>
                                          {!isApproved && (
                                             <button
                                                onClick={() => removeQuestion(section.id, qi)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all p-0.5 shrink-0"
                                             >
                                                <X size={10} />
                                             </button>
                                          )}
                                       </>
                                    )}
                                 </div>
                              ))}

                              {/* Add question inline */}
                              {!isApproved && addingQuestionTo === section.id ? (
                                 <div className="flex items-center gap-1 mt-1">
                                    <input
                                       type="text"
                                       value={newQuestionText}
                                       onChange={(e) => setNewQuestionText(e.target.value)}
                                       onKeyDown={(e) => { if (e.key === 'Enter') addQuestion(section.id); if (e.key === 'Escape') { setAddingQuestionTo(null); setNewQuestionText(''); } }}
                                       placeholder="Новый вопрос..."
                                       className="flex-1 px-2 py-0.5 text-xs border border-indigo-200 rounded outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                       autoFocus
                                    />
                                    <button onClick={() => addQuestion(section.id)} className="text-emerald-500 hover:bg-emerald-50 rounded p-0.5"><Check size={12} /></button>
                                    <button onClick={() => { setAddingQuestionTo(null); setNewQuestionText(''); }} className="text-slate-400 hover:bg-slate-100 rounded p-0.5"><X size={12} /></button>
                                 </div>
                              ) : !isApproved && (
                                 <button
                                    onClick={() => setAddingQuestionTo(section.id)}
                                    className="text-[10px] text-indigo-400 hover:text-indigo-600 flex items-center gap-0.5 mt-1 transition-colors"
                                 >
                                    <Plus size={10} /> Добавить вопрос
                                 </button>
                              )}
                           </div>
                        )}
                     </div>

                     {/* Remove section */}
                     {!isApproved && (
                        <button
                           onClick={() => removeSection(section.id)}
                           className="shrink-0 p-1 text-slate-300 hover:text-red-400 transition-colors"
                        >
                           <Trash2 size={14} />
                        </button>
                     )}
                  </div>
               </div>
            ))}

            {/* Add new section */}
            {!isApproved && (
               showAddSection ? (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-dashed border-indigo-200 rounded-xl p-3">
                     <input
                        type="text"
                        value={newSectionTitle}
                        onChange={(e) => setNewSectionTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addSection(); if (e.key === 'Escape') { setShowAddSection(false); setNewSectionTitle(''); } }}
                        placeholder="Название новой секции..."
                        className="flex-1 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                        autoFocus
                     />
                     <button onClick={addSection} disabled={!newSectionTitle.trim()} className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-40 transition-colors"><Check size={14} /></button>
                     <button onClick={() => { setShowAddSection(false); setNewSectionTitle(''); }} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                  </div>
               ) : (
                  <button
                     onClick={() => setShowAddSection(true)}
                     className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors flex items-center justify-center gap-1"
                  >
                     <Plus size={14} /> Добавить секцию
                  </button>
               )
            )}
         </div>

         {/* Launch button */}
         {!isApproved && (
            <div className="px-4 pb-4">
               <button
                  onClick={() => onApprove(plan)}
                  disabled={enabledCount === 0}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
               >
                  <Rocket size={18} />
                  Запустить исследование ({enabledCount} секций)
               </button>
            </div>
         )}
      </div>
   );
};
