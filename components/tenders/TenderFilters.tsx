import React from 'react';
import { TenderWorkflowStatus, User } from '../../types';

interface TenderFiltersProps {
   statusFilter: { ApplicationSubmission: boolean; CommissionWork: boolean; Completed: boolean };
   onSetStatusFilter: (v: any) => void;
   fzFilter: { fz44: boolean; fz223: boolean; commercial: boolean };
   onSetFzFilter: (v: any) => void;
   priceFrom: string;
   onSetPriceFrom: (v: string) => void;
   priceTo: string;
   onSetPriceTo: (v: string) => void;
   regionCode: string;
   onSetRegionCode: (v: string) => void;
   applicationDeadlineFrom: string;
   onSetApplicationDeadlineFrom: (v: string) => void;
   applicationDeadlineTo: string;
   onSetApplicationDeadlineTo: (v: string) => void;
   advance: { advance44: boolean; advance223: boolean; nonAdvance: boolean };
   onSetAdvance: (v: any) => void;
   smp: boolean;
   onSetSmp: (v: boolean) => void;
   electronicPlaces: number[];
   onTogglePlace: (id: number) => void;
   // Result filters
   filterAssignedTo: string;
   onSetFilterAssignedTo: (v: string) => void;
   filterMinScore: number;
   onSetFilterMinScore: (v: number) => void;
   filterWorkflowStatus: string;
   onSetFilterWorkflowStatus: (v: string) => void;
   allUsers: User[];
   statusLabels: Record<TenderWorkflowStatus, { label: string; color: string }>;
}

export const TenderFilters: React.FC<TenderFiltersProps> = ({
   statusFilter, onSetStatusFilter,
   fzFilter, onSetFzFilter,
   priceFrom, onSetPriceFrom, priceTo, onSetPriceTo,
   regionCode, onSetRegionCode,
   applicationDeadlineFrom, onSetApplicationDeadlineFrom,
   applicationDeadlineTo, onSetApplicationDeadlineTo,
   advance, onSetAdvance, smp, onSetSmp,
   electronicPlaces, onTogglePlace,
   filterAssignedTo, onSetFilterAssignedTo,
   filterMinScore, onSetFilterMinScore,
   filterWorkflowStatus, onSetFilterWorkflowStatus,
   allUsers, statusLabels,
}) => (
   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 animate-in slide-in-from-top-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6 xl:col-span-1">
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Текст и ограничения</h3>
         <div className="flex flex-col gap-3 relative">
            <div className="mt-1">
               <input type="text" placeholder="Код региона (напр. 77, 78)" className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none" value={regionCode} onChange={e => onSetRegionCode(e.target.value)} />
               <p className="text-xs text-slate-400 leading-tight mt-1">Регион поставки</p>
            </div>
         </div>
      </div>
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Стадия закупки</h3>
         <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={statusFilter.ApplicationSubmission} onChange={e => onSetStatusFilter({ ...statusFilter, ApplicationSubmission: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Подача заявок</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={statusFilter.CommissionWork} onChange={e => onSetStatusFilter({ ...statusFilter, CommissionWork: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Работа комиссии</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={statusFilter.Completed} onChange={e => onSetStatusFilter({ ...statusFilter, Completed: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Завершена</label>
         </div>
      </div>
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Законодательство</h3>
         <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={fzFilter.fz44} onChange={e => onSetFzFilter({ ...fzFilter, fz44: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> 44-ФЗ (Госзакупки)</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={fzFilter.fz223} onChange={e => onSetFzFilter({ ...fzFilter, fz223: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> 223-ФЗ (Госкомпании)</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={fzFilter.commercial} onChange={e => onSetFzFilter({ ...fzFilter, commercial: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Коммерческие торги</label>
         </div>
      </div>
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Цена (НМЦК), руб.</h3>
         <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2"><span className="text-sm text-slate-500 w-6">От</span><input type="number" min="0" step="1000" placeholder="0" className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none" value={priceFrom} onChange={e => onSetPriceFrom(e.target.value)} /></div>
            <div className="flex items-center gap-2"><span className="text-sm text-slate-500 w-6">До</span><input type="number" min="0" step="1000" placeholder="∞" className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none" value={priceTo} onChange={e => onSetPriceTo(e.target.value)} /></div>
            <div className="flex flex-wrap gap-1 mt-1">
               {[
                  { label: 'Без цены', from: '0', to: '0' },
                  { label: 'до 100К', from: '0', to: '100000' },
                  { label: '100К–500К', from: '100000', to: '500000' },
                  { label: '500К–1М', from: '500000', to: '1000000' },
                  { label: '1М–10М', from: '1000000', to: '10000000' },
                  { label: '10М+', from: '10000000', to: '' },
               ].map(p => {
                  const isActive = priceFrom === p.from && priceTo === p.to;
                  return (
                     <button key={p.label} onClick={() => { if (isActive) { onSetPriceFrom(''); onSetPriceTo(''); } else { onSetPriceFrom(p.from); onSetPriceTo(p.to); } }} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${isActive ? 'bg-korda-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {p.label}
                     </button>
                  );
               })}
            </div>
         </div>
      </div>
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Прием заявок</h3>
         <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1"><span className="text-xs text-slate-500">От</span><input type="date" className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none" value={applicationDeadlineFrom} onChange={e => onSetApplicationDeadlineFrom(e.target.value)} /></div>
            <div className="flex flex-col gap-1"><span className="text-xs text-slate-500">До</span><input type="date" className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none" value={applicationDeadlineTo} onChange={e => onSetApplicationDeadlineTo(e.target.value)} /></div>
         </div>
      </div>
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Аванс и СМП</h3>
         <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={advance.advance44} onChange={e => onSetAdvance({ ...advance, advance44: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Аванс по 44-ФЗ</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={advance.advance223} onChange={e => onSetAdvance({ ...advance, advance223: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Аванс по 223-ФЗ</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={advance.nonAdvance} onChange={e => onSetAdvance({ ...advance, nonAdvance: e.target.checked })} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Без авансового обеспечения</label>
            <div className="my-1 border-t border-slate-200"></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={smp} onChange={e => onSetSmp(e.target.checked)} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Только для СМП</label>
         </div>
      </div>
      <div>
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Топ-5 ЭТП</h3>
         <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={electronicPlaces.includes(2)} onChange={() => onTogglePlace(2)} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> Сбербанк-АСТ</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={electronicPlaces.includes(3)} onChange={() => onTogglePlace(3)} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> РТС-тендер</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={electronicPlaces.includes(4)} onChange={() => onTogglePlace(4)} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> ЕЭТП (Росэлторг)</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={electronicPlaces.includes(5)} onChange={() => onTogglePlace(5)} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> НЭП (ММВБ)</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-korda-700"><input type="checkbox" checked={electronicPlaces.includes(8)} onChange={() => onTogglePlace(8)} className="rounded text-korda-600 focus:ring-korda-500 w-4 h-4" /> АГЗРТ (Заказ РФ)</label>
         </div>
      </div>

      {/* Result filters */}
      <div className="md:col-span-2 xl:col-span-6 border-t border-slate-200 pt-4 mt-2">
         <h3 className="text-sm font-semibold mb-3 text-slate-700">Фильтры по результатам</h3>
         <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
               <span className="text-xs text-slate-500">Ответственный</span>
               <select value={filterAssignedTo} onChange={e => onSetFilterAssignedTo(e.target.value)} className="p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none min-w-[160px]">
                  <option value="">Все</option>
                  {allUsers.map(u => (<option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>))}
               </select>
            </div>
            <div className="flex flex-col gap-1">
               <span className="text-xs text-slate-500">Мин. звёзды ИИ</span>
               <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                     <button key={n} onClick={() => onSetFilterMinScore(n)} className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${filterMinScore === n ? 'bg-yellow-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {n === 0 ? 'Все' : `${n}★`}
                     </button>
                  ))}
               </div>
            </div>
            <div className="flex flex-col gap-1">
               <span className="text-xs text-slate-500">Стадия работы</span>
               <select value={filterWorkflowStatus} onChange={e => onSetFilterWorkflowStatus(e.target.value)} className="p-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-korda-500 outline-none min-w-[160px]">
                  <option value="">Все стадии</option>
                  {Object.entries(statusLabels).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}
               </select>
            </div>
            {(filterAssignedTo || filterMinScore > 0 || filterWorkflowStatus) && (
               <button onClick={() => { onSetFilterAssignedTo(''); onSetFilterMinScore(0); onSetFilterWorkflowStatus(''); }} className="text-xs text-red-500 hover:text-red-700 underline pb-2">
                  Сбросить фильтры
               </button>
            )}
         </div>
      </div>
   </div>
);
