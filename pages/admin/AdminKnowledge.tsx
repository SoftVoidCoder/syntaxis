import React, { useState } from 'react';
import { KnowledgeFile, KnowledgeCategory } from '../../types';
import { Button } from '../../components/Button';
import { FileText, Trash2, Upload, Loader } from 'lucide-react';
import {
   saveKnowledgeFileToFirebase,
   deleteKnowledgeFileFromFirebase,
   getKnowledgeBaseFromFirebase
} from '../../services/firebaseService';

const CATEGORY_NAMES: Record<KnowledgeCategory, string> = {
   [KnowledgeCategory.GENERAL]: 'Общая',
   [KnowledgeCategory.SALES]: 'Продажи',
   [KnowledgeCategory.TRAINING]: 'Обучение',
   [KnowledgeCategory.DEEP_RESEARCH]: 'Глубокий Анализ',
   [KnowledgeCategory.CALCULATION]: 'Расчеты',
   [KnowledgeCategory.ANALYTICS]: 'Аналитика',
   [KnowledgeCategory.STRATEGY]: 'Стратегия Продаж (ICP)',
   [KnowledgeCategory.KNOWLEDGE]: 'База Знаний R&D'
};

interface AdminKnowledgeProps {
   knowledgeBase: KnowledgeFile[];
   setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeFile[]>>;
}

export const AdminKnowledge: React.FC<AdminKnowledgeProps> = ({ knowledgeBase, setKnowledgeBase }) => {
   const [uploadCategory, setUploadCategory] = useState<KnowledgeCategory>(KnowledgeCategory.GENERAL);
   const [filterCategory, setFilterCategory] = useState<string>('ALL');
   const [isUploading, setIsUploading] = useState(false);

   const extractTextFromFile = async (file: File): Promise<string> => {
      if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
         if ((window as any).mammoth) {
            const arrayBuffer = await file.arrayBuffer();
            const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
            return result.value || "";
         }
      }
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
         if ((window as any).XLSX) {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = (window as any).XLSX.read(arrayBuffer, { type: 'array' });
            let text = "";
            workbook.SheetNames.forEach((sheetName: string) => {
               const worksheet = workbook.Sheets[sheetName];
               const csv = (window as any).XLSX.utils.sheet_to_csv(worksheet);
               text += `--- Sheet: ${sheetName} ---\n${csv}\n`;
            });
            return text;
         }
      }
      if (file.name.endsWith('.pptx')) {
         if ((window as any).JSZip) {
            const zip = new (window as any).JSZip();
            const content = await zip.loadAsync(file);
            let text = "";
            const slideFiles = Object.keys(content.files).filter((f: string) => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));
            slideFiles.sort((a: string, b: string) => {
               const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
               const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
               return numA - numB;
            });
            for (const fileName of slideFiles) {
               const xmlStr = await content.file(fileName).async("string");
               const parser = new DOMParser();
               const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
               const textNodes = xmlDoc.getElementsByTagName("a:t");
               let slideText = "";
               for (let i = 0; i < textNodes.length; i++) {
                  slideText += textNodes[i].textContent + " ";
               }
               if (slideText.trim()) {
                  text += `--- Slide ${fileName} ---\n${slideText}\n`;
               }
            }
            return text || "(Empty Presentation)";
         }
      }
      if (file.type.startsWith('text/') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.md')) {
         return await file.text();
      }
      return `[Binary File: ${file.name}]`;
   };

   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
         const fileArray = Array.from(e.target.files);
         if (fileArray.some(f => f.name.toLowerCase().endsWith('.doc') || f.type === 'application/msword')) {
            alert("Файлы старого формата .doc не поддерживаются. Пожалуйста, пересохраните их в формате .docx или .pdf перед загрузкой.");
            e.target.value = '';
            return;
         }

         if (e.target.files.length > 5) {
            alert("Пожалуйста, загружайте не более 5 файлов за раз.");
            return;
         }
         setIsUploading(true);
         try {
            for (let i = 0; i < e.target.files.length; i++) {
               const file = e.target.files[i];
               const extractedText = await extractTextFromFile(file);
               if (extractedText) {
                  const kFile: KnowledgeFile = {
                     id: crypto.randomUUID(),
                     name: file.name,
                     mimeType: file.type || 'application/octet-stream',
                     content: extractedText,
                     category: uploadCategory,
                     createdAt: Date.now(),
                     originalSize: file.size
                  };
                  await saveKnowledgeFileToFirebase(kFile);
               }
            }
            const updated = await getKnowledgeBaseFromFirebase();
            setKnowledgeBase(updated);
         } catch (err) {
            console.error("Upload error", err);
            alert("Ошибка обработки/загрузки файлов.");
         } finally {
            setIsUploading(false);
            e.target.value = '';
         }
      }
   };

   const deleteFile = async (id: string) => {
      if (!window.confirm("Удалить этот файл из базы знаний?")) return;
      try {
         await deleteKnowledgeFileFromFirebase(id);
         setKnowledgeBase(knowledgeBase.filter(f => f.id !== id));
      } catch (err) {
         console.error(err);
         alert("Ошибка удаления файла");
      }
   };

   const getFilteredFiles = () => {
      if (filterCategory === 'ALL') return knowledgeBase;
      return knowledgeBase.filter(f => f.category === filterCategory);
   };

   return (
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
               <h2 className="text-xl font-bold text-slate-800">База знаний Korda</h2>
               <p className="text-slate-500 text-sm mt-1">
                  Контекст для ИИ. Файлы привязываются к категориям.
               </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
               <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Категория:</span>
                  <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as KnowledgeCategory)} className="bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-sm font-medium focus:ring-2 focus:ring-korda-500 outline-none">
                     {Object.values(KnowledgeCategory).map(cat => (
                        <option key={cat} value={cat}>{CATEGORY_NAMES[cat]}</option>
                     ))}
                  </select>
               </div>

               <div className="relative">
                  <input type="file" multiple id="context-upload" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                  <label htmlFor="context-upload" className={`cursor-pointer bg-korda-500 hover:bg-korda-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold transition-all shadow-md ${isUploading ? 'opacity-70 cursor-wait' : ''}`}>
                     {isUploading ? <Loader className="animate-spin" size={18} /> : <Upload size={18} />}
                     {isUploading ? 'Обработка...' : 'Загрузить'}
                  </label>
               </div>
            </div>
         </div>

         {/* Filter Bar */}
         <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button onClick={() => setFilterCategory('ALL')} className={`px-3 py-1 rounded-full text-xs font-bold border ${filterCategory === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
               Все
            </button>
            {Object.values(KnowledgeCategory).map(cat => (
               <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-3 py-1 rounded-full text-xs font-bold border ${filterCategory === cat ? 'bg-korda-500 text-white border-korda-500' : 'bg-white text-slate-500 border-slate-200'}`}>
                  {CATEGORY_NAMES[cat]}
               </button>
            ))}
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredFiles().length === 0 && (
               <p className="col-span-full text-center text-slate-400 py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">Файлы не найдены</p>
            )}
            {getFilteredFiles().map(file => (
               <div key={file.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                     <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                        <FileText className="text-korda-500" size={24} />
                     </div>
                     <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate" title={file.name}>{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                              {CATEGORY_NAMES[file.category]}
                           </span>
                           <span className="text-xs text-slate-500 font-medium">
                              {file.originalSize ? (file.originalSize / 1024 / 1024).toFixed(2) : (file.content.length / 1024).toFixed(1)} MB
                           </span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => deleteFile(file.id)} className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Trash2 size={18} />
                  </button>
               </div>
            ))}
         </div>
      </div>
   );
};
