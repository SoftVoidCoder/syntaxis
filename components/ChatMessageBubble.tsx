import React, { useState, useMemo } from 'react';
import { Message, ChatMode } from '../types';
import { FileText, ImageIcon, FileSpreadsheet, Presentation, Copy, Check, RefreshCw, Download, TerminalSquare, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AgentControlPanel } from './conveyor/AgentControlPanel';
import { formatTokenCost } from '../utils/costUtils';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Strip markdown formatting for clean clipboard copy
const stripMarkdown = (md: string): string => {
   return md
      .replace(/\*\*([^*]+)\*\*/g, '$1')     // **bold** → bold
      .replace(/\*([^*]+)\*/g, '$1')          // *italic* → italic
      .replace(/#{1,6}\s+/g, '')              // ### headers
      .replace(/^---$/gm, '')                 // horizontal rules
      .replace(/^\s*>\s?/gm, '')              // > blockquotes
      .replace(/^\s*\*\s+/gm, '• ')           // * bullets → •
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
      .replace(/`([^`]+)`/g, '$1')            // `code` → code
      .replace(/\n{3,}/g, '\n\n')             // collapse extra newlines
      .trim();
};

// Internal Copy Button
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
   const [isCopied, setIsCopied] = useState(false);

   const handleCopy = () => {
      navigator.clipboard.writeText(stripMarkdown(text));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
   };

   return (
      <button
         onClick={handleCopy}
         className="p-1.5 text-slate-400 hover:text-korda-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-all ml-2"
         title="Копировать ответ"
      >
         {isCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
      </button>
   );
};

const WordDownloadButton: React.FC<{ text: string, requestTitle?: string }> = ({ text, requestTitle }) => {
   const [isDownloading, setIsDownloading] = useState(false);

   const handleDownload = async () => {
      setIsDownloading(true);
      try {
         const response = await fetch('/api/export-docx', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ text })
         });
         if (!response.ok) throw new Error('Failed to download');
         
         const arrayBuffer = await response.arrayBuffer();
         const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.style.display = 'none';
         a.href = url;
         a.target = '_blank';
         const safeTitle = requestTitle 
             ? requestTitle.replace(/[\\/:*?"<>|]/g, '_').trim() 
             : Date.now();
         a.download = `КП_${safeTitle}.docx`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
      } catch (err) {
         console.error('Download error:', err);
         alert('Ошибка создания Word файла');
      } finally {
         setIsDownloading(false);
      }
   };

   return (
      <button
         onClick={handleDownload}
         disabled={isDownloading}
         className={`p-1.5 ml-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 rounded-md transition-all flex items-center gap-1 ${isDownloading ? 'opacity-50' : ''}`}
         title="Скачать в Word (.docx)"
      >
         {isDownloading ? <RefreshCw size={14} className="animate-spin text-blue-500" /> : <Download size={14} />}
         <span className="text-[10px] font-bold uppercase text-blue-500">Word</span>
      </button>
   );
};

interface ChatMessageBubbleProps {
   msg: Message;
   chatMode: ChatMode;
   requestTitle?: string;
   orderNumber?: string;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ msg, chatMode, requestTitle, orderNumber }) => {
   const cleanedText = msg.text
      .replace(/`?<<<(?:BITRIX_CALL|CHECKO_CALL|CHECKO_DEEP_CALL):[\s\S]*?>>>`?/g, '')
      .trim();
   const isEmptyAfterClean = !cleanedText;

   // Hide bubble if it only contains a tool call
   const isToolOnly =
      (msg.text.trim().startsWith('<<<BITRIX_CALL') ||
         msg.text.trim().startsWith('<<<CHECKO_CALL') ||
         msg.text.trim().startsWith('<<<CHECKO_DEEP_CALL')) &&
      !msg.text
         .replace(/`?<<<(?:BITRIX_CALL|CHECKO_CALL|CHECKO_DEEP_CALL):[\s\S]*?>>>`?/g, '')
         .trim();

   if (isToolOnly) return null;
   
   const [showLogs, setShowLogs] = useState(false);
   const [activeTab, setActiveTab] = useState<'internal' | 'client_table' | 'client_letter'>('internal');

   let internalText = cleanedText;
   let clientLetter = '';
   const hasTabs = msg.masterJson && msg.masterJson.length > 0 && cleanedText.includes('---SPLIT---');
   
   if (hasTabs) {
       const parts = cleanedText.split('---SPLIT---');
       internalText = parts[0].trim();
       clientLetter = parts[1] ? parts[1].trim() : '';
   }

   const displayedText = hasTabs 
       ? (activeTab === 'internal' ? internalText : (activeTab === 'client_letter' ? clientLetter : '')) 
       : cleanedText;

   return (
      <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
         <div
            className={`
             ${msg.masterJson && msg.masterJson.length > 0 ? 'max-w-full' : 'max-w-[85%] md:max-w-[75%]'} rounded-2xl p-4 shadow-sm relative group
            ${msg.role === 'user'
                  ? 'bg-korda-500 text-white rounded-br-none shadow-korda-500/20'
                  : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
               }
         `}
         >
            {/* Attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
               <div className="flex flex-wrap gap-2 mb-3">
                  {msg.attachments.map((att, idx) => (
                     <div
                        key={idx}
                        className={`rounded p-2 flex items-center gap-2 text-xs overflow-hidden max-w-full ${msg.role === 'user' ? 'bg-black/10' : 'bg-slate-100'
                           }`}
                     >
                        {att.mimeType.startsWith('image/') ? (
                           <ImageIcon size={14} />
                        ) : att.name.endsWith('.xlsx') ? (
                           <FileSpreadsheet size={14} />
                        ) : att.name.endsWith('.pptx') ? (
                           <Presentation size={14} />
                        ) : (
                           <FileText size={14} />
                        )}
                        <span className="truncate max-w-[150px]">{att.name}</span>
                     </div>
                  ))}
               </div>
            )}

            {/* Message Content */}
            <div className={`prose prose-sm max-w-none break-words leading-relaxed ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
               
               {/* Tabs Navigation */}
               {hasTabs && (
                  <div className="flex bg-slate-100/50 p-1 rounded-lg mb-4 w-max border border-slate-200/60 overflow-x-auto max-w-full">
                     <button 
                        onClick={() => setActiveTab('internal')}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${activeTab === 'internal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                        Внутренний расчет
                     </button>
                     <button 
                        onClick={() => setActiveTab('client_table')}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'client_table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                        <Sparkles size={12} className={activeTab === 'client_table' ? 'text-blue-500' : 'opacity-50'} />
                        Спецификация (КП)
                     </button>
                     <button 
                        onClick={() => setActiveTab('client_letter')}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${activeTab === 'client_letter' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                        <FileText size={12} className={activeTab === 'client_letter' ? 'text-indigo-500' : 'opacity-50'} />
                        Письмо клиенту
                     </button>
                  </div>
               )}

               {displayedText && (
                  <ReactMarkdown
                     remarkPlugins={[remarkGfm]}
                     components={{
                     a: ({ node, ...props }) => (
                        <a {...props} className="text-blue-500 hover:text-blue-700 underline font-medium" target="_blank" rel="noopener noreferrer" />
                     ),
                     p: ({ node, children, ...props }) => {
                        const pathRegex = /(?:[A-Za-zА-Яа-я]:\\[^\s,;)]+|\\\\[^\s,;)]+)/g;
                        const processChild = (child: any): any => {
                           if (typeof child !== 'string') return child;
                           const parts: any[] = [];
                           let lastIdx = 0;
                           let m;
                           while ((m = pathRegex.exec(child)) !== null) {
                              if (m.index > lastIdx) parts.push(child.slice(lastIdx, m.index));
                              const pathStr = m[0];
                              parts.push(
                                 <span
                                    key={m.index}
                                    className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-sm cursor-pointer hover:bg-amber-100 transition-colors font-mono"
                                    title="Нажмите, чтобы скопировать путь"
                                    onClick={() => {
                                       navigator.clipboard.writeText(pathStr);
                                       const el = document.getElementById(`path-${m!.index}-${pathStr.length}`);
                                       if (el) {
                                          el.textContent = '✅ Скопировано!';
                                          setTimeout(() => {
                                             el.textContent = '📂 ' + pathStr;
                                          }, 1500);
                                       }
                                    }}
                                    id={`path-${m.index}-${pathStr.length}`}
                                 >
                                    📂 {pathStr}
                                 </span>
                              );
                              lastIdx = m.index + m[0].length;
                           }
                           if (parts.length === 0) return child;
                           if (lastIdx < child.length) parts.push(child.slice(lastIdx));
                           return parts;
                        };
                        const processed = Array.isArray(children)
                           ? children.map((c, i) => <React.Fragment key={i}>{processChild(c)}</React.Fragment>)
                           : processChild(children);
                        return <p {...props}>{processed}</p>;
                     },
                     code: ({ node, className, children, ...props }: any) => {
                        const inline = !String(children).includes('\n') && !className;
                        const match = /language-(\w+)/.exec(className || '');
                        const lang = match ? match[1] : '';
                        const textContent = String(children).replace(/\n$/, '');

                        if (!inline && match) {
                           return (
                              <div className="rounded-lg overflow-hidden my-2 border border-slate-200">
                                 <div className="bg-slate-100 px-3 py-1.5 flex justify-between items-center border-b border-slate-200">
                                    <span className="text-xs font-mono text-slate-500 font-bold uppercase">{lang}</span>
                                    <div className="flex gap-2">
                                       <button
                                          onClick={() => navigator.clipboard.writeText(textContent)}
                                          className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
                                          title="Копировать"
                                       >
                                          <Copy size={14} />
                                       </button>
                                       <button
                                          onClick={() => {
                                             const content = (lang === 'csv' || lang === 'txt') ? '\uFEFF' + textContent : textContent;
                                             const mimeType = lang === 'csv' ? 'text/csv;charset=utf-8' :
                                                lang === 'json' ? 'application/json;charset=utf-8' :
                                                   'text/plain;charset=utf-8';
                                             const blob = new Blob([content], { type: mimeType });
                                             const url = URL.createObjectURL(blob);
                                             const a = document.createElement('a');
                                             a.href = url;
                                             a.download = `korda_export_${Date.now()}.${lang === 'csv' ? 'csv' : lang === 'json' ? 'json' : 'txt'}`;
                                             document.body.appendChild(a);
                                             a.click();
                                             document.body.removeChild(a);
                                             URL.revokeObjectURL(url);
                                          }}
                                          className="p-1 hover:bg-blue-100 text-blue-500 rounded transition-colors"
                                          title="Скачать файл"
                                       >
                                          <Download size={14} />
                                       </button>
                                       {(lang === 'csv' || lang === 'json') && (
                                          <button
                                             onClick={async () => {
                                                try {
                                                   const doc = new jsPDF();
                                                   const fontUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
                                                   const fontResponse = await fetch(fontUrl);
                                                   const fontBlob = await fontResponse.blob();
                                                   const reader = new FileReader();
                                                   reader.readAsDataURL(fontBlob);
                                                   reader.onloadend = function () {
                                                      const base64data = (reader.result as string).split(',')[1];
                                                      doc.addFileToVFS('Roboto-Regular.ttf', base64data);
                                                      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                                                      doc.setFont('Roboto');
                                                      doc.setFontSize(16);
                                                      doc.text('Korda Syntax Report', 14, 15);
                                                      doc.setFontSize(10);
                                                      const dateStr = new Date().toLocaleString('ru-RU');
                                                      doc.text(`Дата: ${dateStr}`, 14, 22);

                                                      let headers: string[] = [];
                                                      let body: string[][] = [];
                                                      try {
                                                         if (lang === 'json') {
                                                            const data = JSON.parse(textContent);
                                                            const items = Array.isArray(data) ? data : (data.result || data.leads || [data]);
                                                            if (items.length > 0) {
                                                               headers = Object.keys(items[0]);
                                                               body = items.map((item: any) => headers.map(h => String(item[h] || '')));
                                                            }
                                                         } else if (lang === 'csv') {
                                                            const lines = textContent.trim().split('\n');
                                                            if (lines.length > 0) {
                                                               headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                                                               body = lines.slice(1).map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
                                                            }
                                                         }
                                                      } catch (e) {
                                                         console.error('PDF Parse Error', e);
                                                         alert('Ошибка парсинга данных для PDF');
                                                         return;
                                                      }
                                                      if (headers.length > 0) {
                                                         autoTable(doc, {
                                                            head: [headers],
                                                            body,
                                                            startY: 25,
                                                            styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
                                                            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
                                                         });
                                                         doc.save(`korda_report_${Date.now()}.pdf`);
                                                      } else {
                                                         alert('Нет данных для таблицы');
                                                      }
                                                   };
                                                } catch (err) {
                                                   console.error('Error generating PDF:', err);
                                                   alert('Не удалось загрузить шрифты для PDF.');
                                                }
                                             }}
                                             className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors"
                                             title="Скачать PDF отчет"
                                          >
                                             <FileText size={14} />
                                          </button>
                                       )}
                                    </div>
                                 </div>
                                 <div className="p-3 bg-slate-50 overflow-x-auto">
                                    <code className={className} {...props}>
                                       {children}
                                    </code>
                                 </div>
                              </div>
                           );
                        }

                        // Inline code — detect Windows/UNC paths
                        const codeText = String(children).replace(/\n$/, '');
                        const isPath = /^[A-Za-z]:\\|^\\\\/.test(codeText);
                        if (isPath) {
                           return (
                              <code
                                 className={`${className} bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-sm cursor-pointer hover:bg-amber-100 transition-colors inline-flex items-center gap-1`}
                                 title="Нажмите, чтобы скопировать путь"
                                 onClick={(e) => {
                                    navigator.clipboard.writeText(codeText);
                                    const el = e.currentTarget;
                                    const origText = el.getAttribute('data-orig') || '';
                                    if (!el.getAttribute('data-orig')) el.setAttribute('data-orig', el.textContent || '');
                                    el.textContent = '✅ Скопировано!';
                                    setTimeout(() => { el.textContent = origText || codeText; }, 1500);
                                 }}
                                 {...props}
                              >
                                 📂 {children}
                              </code>
                           );
                        }
                        return <code className={`${className} bg-slate-100 px-1 py-0.5 rounded text-sm`} {...props}>{children}</code>;
                     },
                  }}
               >
                  {displayedText}
               </ReactMarkdown>
               )}



               {/* Pro mode recommendation banner for OSINT */}
               {msg.role === 'model' && chatMode !== ChatMode.DEEP_RESEARCH && /OSINT|глубокий анализ|глубокого анализа/i.test(cleanedText) && (
                  <div className="mt-3 p-3 border-2 border-red-400 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="text-red-500 text-lg">⚡</span>
                        <span className="font-bold text-red-600 text-sm">Рекомендация: переключитесь на PRO</span>
                     </div>
                     <p className="text-xs text-red-700 m-0">
                        Переключатель находится <strong>под окном набора текста, по центру</strong>. PRO-модель даёт значительно более глубокий и точный анализ.
                     </p>
                  </div>
               )}

               {/* Fallback for empty messages (tool operations) */}
               {isEmptyAfterClean && !msg.masterJson && (
                  <span className="text-slate-500 italic flex items-center gap-2 mt-1">
                     <RefreshCw size={14} className="animate-spin" />
                     Работаю с CRM...
                  </span>
               )}

               {/* Conveyor Master JSON Table */}
               {msg.masterJson && msg.masterJson.length > 0 && (!hasTabs || activeTab !== 'client_letter') && (
                  <div className="mt-4">
                      {hasTabs && activeTab === 'client_table' && orderNumber && (
                          <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-medium">
                              Данная спецификация является приложением к коммерческому предложению №{orderNumber}
                          </div>
                      )}
                  <div className="border border-slate-200 shadow-sm rounded-lg overflow-x-auto bg-white">
                      <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap">
                          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              <tr>
                                  <th className="px-2 py-2 text-center">№</th>
                                  <th className="px-2 py-2 w-full">Наименование по ТУ</th>
                                  <th className="px-2 py-2 text-center">Кол-во</th>
                                  {(!hasTabs || activeTab === 'internal') ? (
                                      <>
                                          <th className="px-2 py-2 text-right text-sky-700 bg-sky-50/50">S, м²</th>
                                          <th className="px-2 py-2 text-right text-indigo-700 bg-indigo-50/50">Материалы</th>
                                          <th className="px-2 py-2 text-right text-violet-700 bg-violet-50/50">Работа</th>
                                          <th className="px-2 py-2 text-right text-pink-700 bg-pink-50/50">Нитки</th>
                                          <th className="px-2 py-2 text-right text-slate-600 bg-slate-50/50">Эскиз</th>
                                          <th className="px-2 py-2 text-right text-amber-700 bg-amber-50/50">Себес/шт</th>
                                          <th className="px-2 py-2 text-right font-bold text-emerald-700 bg-emerald-50/50">Итого (без НДС)</th>
                                      </>
                                  ) : (
                                      <>
                                          <th className="px-2 py-2 text-right">Цена/шт (без НДС)</th>
                                          <th className="px-2 py-2 text-right">Цена/шт (с НДС)</th>
                                          <th className="px-2 py-2 text-right">Сумма (без НДС)</th>
                                          <th className="px-2 py-2 text-right">Сумма (с НДС)</th>
                                      </>
                                  )}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {msg.masterJson.map((item, idx) => {
                                  const price1WithVat = item.cost?.price_1_pcs ? (item.cost.price_1_pcs * 1.22).toFixed(2) : null;
                                  const qty = item.qty || 1;
                                  const rowTotalNoVat = item.cost?.cost_1_pcs ? (item.cost.cost_1_pcs * qty) : null;
                                  return (
                                      <tr key={item.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="px-2 py-2 text-slate-400 text-center">{idx + 1}</td>
                                          <td className="px-2 py-2 whitespace-normal min-w-[200px] font-medium leading-snug">
                                              {item.tu_name || 'Без названия'}
                                              {hasTabs && activeTab === 'client_table' && item.raw_name && (
                                                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                                      {item.raw_name}
                                                  </div>
                                              )}
                                              {(!hasTabs || activeTab === 'internal') && item.materials && (
                                                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                                      {item.materials.outer || item.materials.outer_layer || ''} / {item.materials.inner || item.materials.inner_layer || ''} / {item.materials.insulation || ''}
                                                  </div>
                                              )}
                                          </td>
                                          <td className="px-2 py-2 text-center font-mono bg-slate-50/30">{qty} шт</td>
                                          {(!hasTabs || activeTab === 'internal') ? (
                                              <>
                                                  <td className="px-2 py-2 text-right font-mono text-sky-700 bg-sky-50/20">
                                                      {item.geometry?.area ?? '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono text-indigo-700 bg-indigo-50/20">
                                                      {item.cost?.materials_total ? `${item.cost.materials_total.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono text-violet-700 bg-violet-50/20">
                                                      {item.cost?.work_total ? `${item.cost.work_total.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono text-pink-700 bg-pink-50/20">
                                                      {item.cost?.thread_total != null ? `${item.cost.thread_total.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono text-slate-600 bg-slate-50/20">
                                                      {item.cost?.sketch_cost ? `${item.cost.sketch_cost.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono text-amber-700 bg-amber-50/30 font-semibold">
                                                      {item.cost?.cost_1_pcs ? `${item.cost.cost_1_pcs.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-bold text-emerald-700 font-mono bg-emerald-50/30">
                                                      {rowTotalNoVat ? `${rowTotalNoVat.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                              </>
                                          ) : (
                                              <>
                                                  <td className="px-2 py-2 text-right font-mono text-slate-600">
                                                      {item.cost?.price_1_pcs ? `${item.cost.price_1_pcs.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono">
                                                      {price1WithVat ? `${Number(price1WithVat).toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-mono text-slate-700">
                                                      {item.cost?.row_total_no_vat ? `${item.cost.row_total_no_vat.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                                  <td className="px-2 py-2 text-right font-bold text-slate-800 font-mono bg-green-50/30">
                                                      {item.cost?.row_total_with_vat ? `${item.cost.row_total_with_vat.toLocaleString('ru-RU')} ₽` : '—'}
                                                  </td>
                                              </>
                                          )}
                                      </tr>
                                  );
                              })}
                              {/* Totals row for internal tab */}
                              {(!hasTabs || activeTab === 'internal') && (
                                  <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                                      <td className="px-2 py-2.5" colSpan={3}>ИТОГО</td>
                                      <td className="px-2 py-2.5 text-right text-sky-800">
                                          {msg.masterJson.reduce((s, i) => s + ((i.geometry?.area || 0) * (i.qty || 1)), 0).toFixed(2)} м²
                                      </td>
                                      <td className="px-2 py-2.5 text-right text-indigo-800">
                                          {msg.masterJson.reduce((s, i) => s + ((i.cost?.materials_total || 0) * (i.qty || 1)), 0).toLocaleString('ru-RU')} ₽
                                      </td>
                                      <td className="px-2 py-2.5 text-right text-violet-800">
                                          {msg.masterJson.reduce((s, i) => s + ((i.cost?.work_total || 0) * (i.qty || 1)), 0).toLocaleString('ru-RU')} ₽
                                      </td>
                                      <td className="px-2 py-2.5 text-right text-pink-800">
                                          {msg.masterJson.reduce((s, i) => s + ((i.cost?.thread_total || 0) * (i.qty || 1)), 0).toLocaleString('ru-RU')} ₽
                                      </td>
                                      <td className="px-2 py-2.5 text-right text-slate-700">
                                          {msg.masterJson.reduce((s, i) => s + (i.cost?.sketch_cost || 0), 0).toLocaleString('ru-RU')} ₽
                                      </td>
                                      <td className="px-2 py-2.5"></td>
                                      <td className="px-2 py-2.5 text-right text-emerald-800 text-sm">
                                          {msg.masterJson.reduce((s, i) => s + ((i.cost?.cost_1_pcs || 0) * (i.qty || 1)), 0).toLocaleString('ru-RU')} ₽
                                      </td>
                                  </tr>
                              )}
                              {/* Totals row for client KP tab */}
                              {hasTabs && activeTab === 'client_table' && (() => {
                                  const totalNoVat = msg.masterJson.reduce((s: number, i: any) => s + (i.cost?.row_total_no_vat || 0), 0);
                                  const totalWithVat = msg.masterJson.reduce((s: number, i: any) => s + (i.cost?.row_total_with_vat || 0), 0);
                                  const totalVat = totalWithVat - totalNoVat;
                                  return (
                                      <>
                                          <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                                              <td className="px-2 py-2.5" colSpan={3}>ИТОГО</td>
                                              <td></td>
                                              <td></td>
                                              <td className="px-2 py-2.5 text-right text-slate-700">
                                                  {totalNoVat.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                                              </td>
                                              <td className="px-2 py-2.5 text-right text-emerald-800 text-sm">
                                                  {totalWithVat.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽
                                              </td>
                                          </tr>
                                          <tr className="text-xs text-slate-500">
                                              <td colSpan={7} className="px-2 py-2">
                                                  <div className="flex gap-6">
                                                      <span>Итого без НДС: <b className="text-slate-700">{totalNoVat.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</b></span>
                                                      <span>Сумма НДС (22%): <b className="text-slate-700">{totalVat.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</b></span>
                                                      <span>Итого с НДС: <b className="text-emerald-700">{totalWithVat.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</b></span>
                                                  </div>
                                              </td>
                                          </tr>
                                      </>
                                  );
                              })()}
                          </tbody>
                      </table>
                  </div>
                  </div>
               )}
            </div>

            {/* Logs Toggle & Panel */}
            {msg.telemetryLogs && msg.telemetryLogs.length > 0 && (
               <div className="mt-3">
                  <button 
                     onClick={() => setShowLogs(!showLogs)}
                     className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors"
                  >
                     <TerminalSquare size={14} />
                     {showLogs ? 'Скрыть логи телеметрии' : 'Показать логи телеметрии'}
                  </button>
                  {showLogs && (
                     <div className="mt-2">
                         <AgentControlPanel 
                             telemetryLogs={msg.telemetryLogs} 
                             isStatic={true} 
                         />
                     </div>
                  )}
               </div>
            )}

            {/* Timestamp + Copy */}
            <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100/50">
               <div className="flex items-center gap-2 text-[10px] opacity-60">
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.tokensUsed && (
                      <span className="flex items-center gap-1 bg-indigo-50/50 text-indigo-500 px-1.5 py-0.5 rounded font-mono" title={`Использовано токенов: ${msg.tokensUsed.toLocaleString()}`}>
                          <Sparkles size={10} /> {formatTokenCost(msg.tokensUsed)}
                      </span>
                  )}
               </div>
               <div className="flex items-center opacity-60 hover:opacity-100 transition-opacity">
                  <CopyButton text={msg.text} />
                  <WordDownloadButton text={msg.text} requestTitle={requestTitle} />
               </div>
            </div>
         </div>
      </div>
   );
};
