import React, { useMemo, useState } from 'react';
import { User } from '../../types';
import { Button } from '../Button';
import { X, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface UserKpiAnalyticsModalProps {
   user: User;
   reports: any[];
   onClose: () => void;
}

export const UserKpiAnalyticsModal: React.FC<UserKpiAnalyticsModalProps> = ({ user, reports, onClose }) => {
   const [hoveredData, setHoveredData] = useState<any | null>(null);

   const chartData = useMemo(() => {
      const uFirst = (user.firstName || "").toLowerCase();
      const uLast = (user.lastName || "").toLowerCase();
      const targetBitrixId = user.bitrixUserId ? String(user.bitrixUserId) : null;

      const userReports = reports.filter((r: any) => {
         const reportBitrixId = r.bitrixId || r.userId;
         if (targetBitrixId && reportBitrixId) return String(reportBitrixId) === targetBitrixId;
         const reportName = (r.name || "").toLowerCase();
         return reportName.includes(uLast) || (uFirst && reportName.includes(uFirst));
      });

      const days = 30;
      const data = [];
      const today = new Date();
      
      const calcSum = (reps: any[]) => reps.reduce((sum, r) => {
         const outTel = Array.isArray(r.telephony) ? r.telephony.filter((t: any) => String(t.direction) === '2' && (Number(t.duration) || 0) >= 30).length : 0;
         const outEm = Array.isArray(r.emails) ? r.emails.filter((e: any) => String(e.direction) === '2').length : 0;
         return sum + outTel + outEm;
      }, 0);

      // We go backwards from 29 days ago up to today
      for (let i = days - 1; i >= 0; i--) {
         const d = new Date(today);
         d.setDate(d.getDate() - i);
         d.setHours(23, 59, 59, 999);

         const current7Days = userReports.filter((r: any) => {
            const rd = new Date(r.date);
            const diff = (d.getTime() - rd.getTime()) / (1000 * 3600 * 24);
            return diff >= 0 && diff <= 7;
         });

         const prev7Days = userReports.filter((r: any) => {
            const rd = new Date(r.date);
            const diff = (d.getTime() - rd.getTime()) / (1000 * 3600 * 24);
            return diff > 7 && diff <= 14;
         });

         const currentKPI = calcSum(current7Days);
         const prevKPI = calcSum(prev7Days);

         let trend = 0;
         if (prevKPI === 0) {
            if (currentKPI > 0) trend = 100;
         } else {
            trend = Math.round(((currentKPI - prevKPI) / prevKPI) * 100);
         }

         data.push({
            dateObj: d,
            dateLabel: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
            dateFull: d.toLocaleDateString('ru-RU'),
            kpi: currentKPI,
            trend
         });
      }
      return data;
   }, [user, reports]);

   const maxKpi = Math.max(...chartData.map(d => d.kpi), 10); // Minimum max of 10 to avoid tall empty charts

   return (
      <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
         <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-korda-100 flex items-center justify-center text-korda-600">
                     <Activity size={24} />
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-slate-800">Аналитика Эффективности (KPI)</h2>
                     <p className="text-sm text-slate-500 font-medium mt-0.5">
                        {user.lastName} {user.firstName} <span className="text-slate-300 mx-2">|</span> Динамика за последние 30 дней
                     </p>
                  </div>
               </div>
               <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={24} />
               </button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
               <div className="flex items-end justify-between mb-8">
                  <div>
                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">ОБЩИЙ ТРЕНД (Исходящие)</h3>
                     <div className="flex items-center gap-3">
                        <span className="text-4xl font-black text-slate-800">{chartData[chartData.length - 1].kpi}</span>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-bold ${
                           chartData[chartData.length - 1].trend > 0 ? 'bg-emerald-100 text-emerald-700' :
                           chartData[chartData.length - 1].trend < 0 ? 'bg-rose-100 text-rose-700' :
                           'bg-slate-100 text-slate-500'
                        }`}>
                           {chartData[chartData.length - 1].trend > 0 ? <TrendingUp size={16} strokeWidth={3} /> : chartData[chartData.length - 1].trend < 0 ? <TrendingDown size={16} strokeWidth={3} /> : <Minus size={16} strokeWidth={3} />}
                           {chartData[chartData.length - 1].trend > 0 ? '+' : ''}{chartData[chartData.length - 1].trend}%
                        </div>
                     </div>
                     <p className="text-xs text-slate-400 mt-1 font-medium">Текущий KPI на основе последних 7 дней</p>
                  </div>
               </div>

               {/* Chart Container */}
               <div className="relative h-64 w-full bg-slate-50/50 rounded-xl border border-slate-100 p-4 pb-12 flex items-end gap-1 sm:gap-2">
                  {/* Grid Lines */}
                  <div className="absolute inset-x-4 inset-y-4 flex flex-col justify-between pointer-events-none">
                     <div className="border-b border-dashed border-slate-200/60 flex-1"></div>
                     <div className="border-b border-dashed border-slate-200/60 flex-1"></div>
                     <div className="border-b border-dashed border-slate-200/60 flex-1"></div>
                     <div className="border-b border-slate-300"></div>
                  </div>
                  
                  {/* Max / Mid Value Labels */}
                  <div className="absolute left-4 top-2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{maxKpi}</div>
                  <div className="absolute left-4 top-[50%] -translate-y-1/2 text-[10px] font-bold text-slate-400">{Math.round(maxKpi / 2)}</div>
                  <div className="absolute left-4 bottom-12 translate-y-1/2 text-[10px] font-bold text-slate-400">0</div>

                  {/* Bars */}
                  {chartData.map((d, idx) => (
                     <div 
                        key={idx} 
                        className="relative flex-1 flex flex-col items-center justify-end h-full z-10 group"
                        onMouseEnter={() => setHoveredData(d)}
                        onMouseLeave={() => setHoveredData(null)}
                     >
                        {/* Bar Segment */}
                        <div 
                           className={`w-full max-w-[20px] rounded-t-sm transition-all duration-500 shadow-sm ${
                              hoveredData?.dateFull === d.dateFull ? 'bg-korda-500' : 
                              d.trend > 0 ? 'bg-emerald-400/80 hover:bg-emerald-500' : 
                              d.trend < 0 ? 'bg-rose-400/80 hover:bg-rose-500' : 
                              'bg-slate-300 hover:bg-slate-400'
                           }`}
                           style={{ height: `${Math.max((d.kpi / maxKpi) * 100, 2)}%` }} // min 2% height for visibility
                        ></div>
                        
                        {/* X-Axis Label (Only show every 3rd day roughly or first/last for smaller screens) */}
                        <span className="absolute -bottom-8 text-[10px] font-semibold text-slate-400 -rotate-45 origin-top-left whitespace-nowrap hidden md:block">
                           {idx % 3 === 0 || idx === chartData.length - 1 ? d.dateLabel : ''}
                        </span>
                        
                        {/* Tooltip */}
                        {hoveredData?.dateFull === d.dateFull && (
                           <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white p-3 rounded-xl shadow-xl w-40 pointer-events-none animate-in zoom-in-95 duration-100">
                              <div className="text-xs text-slate-300 font-medium mb-1 drop-shadow-sm">{d.dateFull}</div>
                              <div className="flex items-center justify-between mb-2">
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">KPI</span>
                                 <span className="text-xl font-black">{d.kpi}</span>
                              </div>
                              <div className={`flex items-center justify-between pt-2 border-t border-slate-700/50`}>
                                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Тренд</span>
                                 <span className={`text-xs font-bold flex items-center gap-1 ${d.trend > 0 ? 'text-emerald-400' : d.trend < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                    {d.trend > 0 ? '+' : ''}{d.trend}%
                                 </span>
                              </div>
                              {/* Arrow pointing down */}
                              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45"></div>
                           </div>
                        )}
                     </div>
                  ))}
               </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
               <Button variant="secondary" onClick={onClose}>Закрыть аналитику</Button>
            </div>
         </div>
      </div>
   );
};
