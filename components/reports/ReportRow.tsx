/**
 * Expandable report table row with detail blocks for calls, emails, tasks, and deals.
 */
import React, { useState } from 'react';

const LinkIcon = ({ size }: { size: number }) => (
   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
   </svg>
);

const formatDuration = (seconds?: number) => {
   if (!seconds) return '';
   const m = Math.floor(seconds / 60);
   const s = seconds % 60;
   return m > 0 ? `${m}м ${s}с` : `${s}с`;
};

const getDurationColor = (seconds?: number) => {
   if (!seconds) return 'bg-slate-100 text-slate-500';
   if (seconds < 30) return 'bg-red-100 text-red-600';
   if (seconds < 60) return 'bg-yellow-100 text-yellow-700';
   return 'bg-green-100 text-green-600';
};

const DETAIL_COLORS: Record<string, string> = { blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500' };

const DetailBlock = ({ title, items, icon, color }: { title: string; items: any[]; icon: string; color: string }) => (
   <div>
      <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-2">
         <span className={`w-2 h-2 rounded-full ${DETAIL_COLORS[color]}`} />
         {title}
      </h4>
      <ul className="space-y-2">
         {items.map((item: any) => (
            <li key={item.id} className="text-sm bg-white p-2 rounded border border-slate-100 flex items-start gap-3">
               <span className="font-mono text-xs text-slate-400 mt-0.5 w-10 shrink-0">{item.time}</span>
               <div className="flex-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                     <div className="truncate font-medium text-slate-700 max-w-full flex items-center gap-2" title={item.subject}>
                        {icon === 'mail' ? (
                           item.direction === '1'
                              ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 uppercase tracking-wide shrink-0">Входящее</span>
                              : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 uppercase tracking-wide shrink-0">Исходящее</span>
                        ) : (
                           <span className="text-slate-400 font-bold shrink-0">{item.direction === '1' ? '←' : '→'}</span>
                        )}
                        <span className="truncate">{item.subject || 'Без темы'}</span>
                     </div>
                     {icon === 'phone' && item.duration !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${getDurationColor(item.duration)}`}>
                           {formatDuration(item.duration)}
                        </span>
                     )}
                  </div>
                  {item.entityName && (
                     <a href={item.entityUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1">
                        {item.entityName} <LinkIcon size={10} />
                     </a>
                  )}
               </div>
            </li>
         ))}
      </ul>
   </div>
);

interface ReportRowProps {
   report: any;
}

export const ReportRow: React.FC<ReportRowProps> = ({ report }) => {
   const [isExpanded, setIsExpanded] = useState(false);

   const summary = report.summary || {
      callsCount: report.calls || 0,
      emailsCount: report.emails || 0,
      tasksCount: report.tasks || report.meetings || 0,
      dealsCount: report.dealsCreated || 0,
      dealsAmount: report.dealsAmount || 0
   };

   const outCallsCount = Array.isArray(report.calls) ? report.calls.filter((t: any) => String(t.direction) === '2' && (Number(t.duration) || 0) >= 30).length : 0;
   const outTelCount = Array.isArray(report.telephony) ? report.telephony.filter((t: any) => String(t.direction) === '2' && (Number(t.duration) || 0) >= 30).length : 0;
   const outEmailsCount = Array.isArray(report.emails) ? report.emails.filter((t: any) => String(t.direction) === '2').length : 0;

   const hasDetails = Array.isArray(report.calls) || Array.isArray(report.deals);
   const currencyFmt = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });

   return (
      <>
         <tr className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
            onClick={() => hasDetails && setIsExpanded(!isExpanded)}>
            <td className="px-6 py-4 font-medium text-slate-800 flex items-center gap-2">
               {hasDetails && (
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                     <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                     </svg>
                  </div>
               )}
               {new Date(report.date).toLocaleDateString('ru-RU')}
            </td>
            <td className="px-6 py-4 text-slate-500 text-xs">{report.name}</td>
            <td className="px-6 py-4 text-center">
               <span className={`font-bold px-2 py-1 rounded text-xs ${summary.callsCount > 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}>{summary.callsCount}</span>
            </td>
            <td className="px-6 py-4 text-center">
               <span className={`font-bold px-2 py-1 rounded text-xs ${summary.telephonyCount > 0 ? 'text-cyan-600 bg-cyan-50' : 'text-slate-400'}`}>{summary.telephonyCount}</span>
            </td>
            <td className="px-6 py-4 text-center">
               <span className={`font-bold px-2 py-1 rounded text-xs ${summary.emailsCount > 0 ? 'text-green-600 bg-green-50' : 'text-slate-400'}`}>{summary.emailsCount}</span>
            </td>
            <td className="px-6 py-4 text-right font-bold text-slate-700">{summary.dealsCount}</td>
            <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{currencyFmt.format(summary.dealsAmount)}</td>
         </tr>
         {isExpanded && hasDetails && (
            <tr>
               <td colSpan={8} className="px-6 py-0 bg-slate-50/50">
                  <div className="p-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                     {report.calls?.length > 0 && <DetailBlock title="Звонки" items={report.calls} icon="phone" color="blue" />}
                     {report.emails?.length > 0 && <DetailBlock title="Письма" items={report.emails} icon="mail" color="green" />}
                     {report.deals?.length > 0 && (
                        <div className="md:col-span-2">
                           <h4 className="text-xs font-bold uppercase text-slate-400 mb-2 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Созданные Сделки
                           </h4>
                           <div className="bg-white rounded border border-slate-200 p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {report.deals.map((d: any) => (
                                 <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                                    className="block p-3 rounded hover:bg-slate-50 border border-transparent hover:border-emerald-200 transition-all group">
                                    <div className="font-medium text-slate-800 text-sm group-hover:text-emerald-700 truncate">{d.title}</div>
                                    <div className="flex justify-between items-center mt-1">
                                       <span className="text-xs text-emerald-600 font-bold">{currencyFmt.format(d.amount)}</span>
                                       <span className="text-[10px] text-slate-400">#{d.id}</span>
                                    </div>
                                 </a>
                              ))}
                           </div>
                        </div>
                     )}
                  </div>
               </td>
            </tr>
         )}
      </>
   );
};
