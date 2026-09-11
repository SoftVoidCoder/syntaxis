import fs from 'fs';

const filePath = 'pages/admin/AdminFileMonitor.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `                                     return (
                                        <div key={idx} className={\`flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-bold \${bgColor} group relative cursor-pointer\`}>
                                           <div className={\`w-1.5 h-1.5 rounded-full \${dotColor}\`}></div>
                                           {brk.startStr} - {brk.endStr}
                                           <span className="opacity-60 ml-1">({brk.durationMinutes} мин)</span>
                                        </div>
                                     );`;

const replacement1 = `                                     return (
                                        <div key={idx} className="flex flex-col">
                                           <div 
                                              onClick={() => setExpandedBreakIdx(expandedBreakIdx === idx ? null : idx)}
                                              className={\`flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-bold \${bgColor} cursor-pointer hover:brightness-95 transition-all\`}
                                           >
                                              <div className={\`w-1.5 h-1.5 rounded-full \${dotColor}\`}></div>
                                              {brk.startStr} - {brk.endStr}
                                              <span className="opacity-60 ml-1">({brk.durationMinutes} мин)</span>
                                           </div>
                                           {expandedBreakIdx === idx && (
                                              <div className="mt-1 bg-white border border-slate-200 rounded-lg p-2 text-xs shadow-sm max-w-md animate-in fade-in zoom-in-95">
                                                 <span className="text-slate-400 uppercase tracking-widest text-[9px] block mb-1">Файлы перед уходом:</span>
                                                 <ul className="space-y-1">
                                                    {brk.filesBefore.map((fb, fbidx) => (
                                                       <li key={fbidx} className="text-slate-700 font-medium break-all flex items-start gap-1">
                                                          <span className="text-slate-300 select-none mt-0.5">•</span> 
                                                          {fb}
                                                       </li>
                                                    ))}
                                                 </ul>
                                              </div>
                                           )}
                                        </div>
                                     );`;

content = content.replace(target1, replacement1);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Replaced target1");
