/**
 * Shared utility for converting Office files (DOCX, XLSX, PPTX) to plain text.
 * Used by both ChatInterface (file uploads) and AdminKnowledge (knowledge base uploads).
 * 
 * Uses bundled parsers when available, with legacy window.* globals as fallback.
 */

declare global {
   interface Window {
      mammoth?: any;
      XLSX?: any;
      JSZip?: any;
   }
}

const TEXT_LIKE_EXTENSIONS = new Set([
   'txt', 'csv', 'json', 'md', 'xml', 'html', 'htm', 'log',
   'lsp', 'scr', 'dxf', 'step', 'stp', 'iges', 'igs'
]);

const UNSUPPORTED_BINARY_ENGINEERING_EXTENSIONS = new Set([
   'dwg'
]);

function getFileExtension(file: File): string {
   const match = file.name.toLowerCase().match(/\.([^.]+)$/);
   return match?.[1] || '';
}

function withMimeType(file: File, mimeType: string): File {
   if (file.type === mimeType) return file;
   return new File([file], file.name, { type: mimeType });
}

function textFileFromContent(name: string, content: string): File {
   return new File([new Blob([content], { type: 'text/plain;charset=utf-8' })], `${name}.txt`, { type: 'text/plain' });
}

async function getMammoth() {
   if (window.mammoth) return window.mammoth;
   try {
      const mod: any = await import('mammoth/mammoth.browser');
      return mod.default || mod;
   } catch {
      return null;
   }
}

async function getXlsx() {
   if (window.XLSX) return window.XLSX;
   try {
      const mod: any = await import('xlsx');
      return mod.default || mod;
   } catch {
      return null;
   }
}

/**
 * Checks if a file is a supported Office format.
 */
export function isOfficeFile(file: File): boolean {
   const name = file.name.toLowerCase();
   return (
      name.endsWith('.docx') ||
      file.type.includes('wordprocessingml') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls') ||
      name.endsWith('.doc') ||
      file.type === 'application/msword' ||
      name.endsWith('.pptx')
   );
}

/**
 * Converts an Office file to a plain text File object.
 * Returns the original file if it's not an Office format or conversion fails.
 */
export async function convertOfficeFileToText(file: File): Promise<File> {
   const name = file.name.toLowerCase();
   const isDocx = name.endsWith('.docx') || file.type.includes('wordprocessingml');
   const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
   const isPptx = name.endsWith('.pptx');
   const isLegacyDoc = name.endsWith('.doc') || file.type === 'application/msword';

   if (!isDocx && !isXlsx && !isPptx && !isLegacyDoc) return file;

   if (isLegacyDoc) {
      return textFileFromContent(file.name, [
         `Файл "${file.name}" приложен к запросу.`,
         'Это старый бинарный формат Microsoft Word (.doc), его невозможно надежно извлечь в браузере.',
         'Попроси пользователя пересохранить документ в .docx или .pdf, если нужен полный анализ содержимого.',
         `Размер файла: ${file.size} байт.`
      ].join('\n'));
   }

   let convertedText = '';

   const mammoth = isDocx ? await getMammoth() : null;
   const xlsx = isXlsx ? await getXlsx() : null;

   if (isDocx && mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      convertedText = result.value || '(Empty DOCX)';
   } else if (isXlsx && xlsx) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = xlsx.read(arrayBuffer, { type: 'array' });
      workbook.SheetNames.forEach((sheetName: string) => {
         const worksheet = workbook.Sheets[sheetName];
         const csv = xlsx.utils.sheet_to_csv(worksheet);
         convertedText += `--- Sheet: ${sheetName} ---\n${csv}\n`;
      });
   } else if (isPptx && window.JSZip) {
      const zip = new window.JSZip();
      const content = await zip.loadAsync(file);
      const slideFiles = Object.keys(content.files)
         .filter((f: string) => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));

      slideFiles.sort((a: string, b: string) => {
         const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0');
         const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0');
         return numA - numB;
      });

      for (const fileName of slideFiles) {
         const xmlStr = await content.file(fileName).async('string');
         const parser = new DOMParser();
         const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');
         const textNodes = xmlDoc.getElementsByTagName('a:t');
         let slideText = '';
         for (let k = 0; k < textNodes.length; k++) {
            slideText += textNodes[k].textContent + ' ';
         }
         if (slideText.trim()) {
            convertedText += `--- Slide ${fileName} ---\n${slideText}\n`;
         }
      }
   } else {
      // Library not loaded — return original file
      return file;
   }

   if (!convertedText) {
      convertedText = '(Empty file)';
   }

   const blob = new Blob([convertedText], { type: 'text/plain;charset=utf-8' });
   return new File([blob], file.name + '.txt', { type: 'text/plain' });
}

export async function prepareFileForChatAttachment(file: File): Promise<File> {
   const ext = getFileExtension(file);

   if (isOfficeFile(file)) {
      return convertOfficeFileToText(file);
   }

   if (TEXT_LIKE_EXTENSIONS.has(ext) || file.type.startsWith('text/')) {
      const text = await file.text();
      return textFileFromContent(file.name, text || '(Empty text file)');
   }

   if (UNSUPPORTED_BINARY_ENGINEERING_EXTENSIONS.has(ext)) {
      return textFileFromContent(file.name, [
         `Файл "${file.name}" приложен к запросу.`,
         'Это бинарный CAD-чертеж DWG. Gemini не может напрямую прочитать геометрию DWG через чат-вложение.',
         'Файл принят без ошибки, но для анализа чертежа попроси пользователя экспортировать его в PDF или DXF.',
         `Размер файла: ${file.size} байт.`
      ].join('\n'));
   }

   if (ext === 'pdf' && !file.type) {
      return withMimeType(file, 'application/pdf');
   }

   return file.type ? file : withMimeType(file, 'application/octet-stream');
}

/**
 * Extracts raw text from an Office file (for knowledge base indexing).
 * Returns the text content as a string.
 */
export async function extractTextFromOfficeFile(file: File): Promise<string> {
   const textFile = await convertOfficeFileToText(file);
   if (textFile === file) {
      // Not converted — try reading as text
      return await file.text();
   }
   return await textFile.text();
}
