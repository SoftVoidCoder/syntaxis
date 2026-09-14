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

const DWG_VERSION_LABELS: Record<string, string> = {
   AC1009: 'AutoCAD R12',
   AC1012: 'AutoCAD R13',
   AC1014: 'AutoCAD R14',
   AC1015: 'AutoCAD 2000/2000i/2002',
   AC1018: 'AutoCAD 2004/2005/2006',
   AC1021: 'AutoCAD 2007/2008/2009',
   AC1024: 'AutoCAD 2010/2011/2012',
   AC1027: 'AutoCAD 2013/2014/2015/2016/2017',
   AC1032: 'AutoCAD 2018/2019/2020/2021/2022/2023/2024',
   AC1036: 'AutoCAD 2025+'
};

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

function fileBaseName(name: string): string {
   return name.replace(/\.[^.]+$/, '') || name;
}

function decodeBytes(bytes: Uint8Array, encoding: string): string {
   try {
      return new TextDecoder(encoding, { fatal: false }).decode(bytes);
   } catch {
      return new TextDecoder('latin1', { fatal: false }).decode(bytes);
   }
}

function extractPrintableRuns(text: string): string[] {
   const normalized = text
      .replace(/\u0000+/g, '\n')
      .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]+/g, '\n');

   const matches = normalized.match(/[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 _.,:;+\-/#№()[\]{}"'=%<>|\\@!?*&\r\n\t]{3,}/g) || [];

   const seen = new Set<string>();
   const cleaned: string[] = [];
   for (const match of matches) {
      const value = match.replace(/\s+/g, ' ').trim();
      if (value.length < 4 || seen.has(value)) continue;
      seen.add(value);
      cleaned.push(value);
   }
   return cleaned;
}

function collectDwgStrings(bytes: Uint8Array): string[] {
   const singleByteText = decodeBytes(bytes, 'windows-1251');
   const utf16Text = decodeBytes(bytes, 'utf-16le');
   const candidates = [...extractPrintableRuns(singleByteText), ...extractPrintableRuns(utf16Text)];

   const seen = new Set<string>();
   return candidates
      .map(s => s.trim())
      .filter(s => {
         if (s.length < 4 || seen.has(s)) return false;
         seen.add(s);
         return true;
      })
      .slice(0, 400);
}

function findPngEnd(bytes: Uint8Array, start: number): number | null {
   let offset = start + 8;
   while (offset + 12 <= bytes.length) {
      const length =
         (bytes[offset] << 24) |
         (bytes[offset + 1] << 16) |
         (bytes[offset + 2] << 8) |
         bytes[offset + 3];
      if (length < 0 || offset + 12 + length > bytes.length) return null;

      const type = String.fromCharCode(
         bytes[offset + 4],
         bytes[offset + 5],
         bytes[offset + 6],
         bytes[offset + 7]
      );
      offset += 12 + length;
      if (type === 'IEND') return offset;
   }
   return null;
}

function extractEmbeddedPngs(bytes: Uint8Array, sourceName: string): File[] {
   const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
   const files: File[] = [];

   for (let i = 0; i <= bytes.length - signature.length; i++) {
      let isPng = true;
      for (let j = 0; j < signature.length; j++) {
         if (bytes[i + j] !== signature[j]) {
            isPng = false;
            break;
         }
      }
      if (!isPng) continue;

      const end = findPngEnd(bytes, i);
      if (!end) continue;

      const pngBytes = bytes.slice(i, end);
      files.push(new File(
         [new Blob([pngBytes], { type: 'image/png' })],
         `${fileBaseName(sourceName)}-dwg-preview-${files.length + 1}.png`,
         { type: 'image/png' }
      ));

      i = end - 1;
   }

   return files.slice(0, 3);
}

function convertDwgBytesToText(file: File, bytes: Uint8Array, previewCount: number): File {
   const header = decodeBytes(bytes.slice(0, 6), 'latin1').replace(/\u0000/g, '').trim();
   const versionLabel = DWG_VERSION_LABELS[header] || 'неизвестная версия DWG';
   const strings = collectDwgStrings(bytes);

   const content = [
      `Файл "${file.name}" прочитан как бинарный CAD-чертеж DWG.`,
      `Формат/версия: ${header || 'не определено'} (${versionLabel}).`,
      `Размер файла: ${file.size} байт.`,
      previewCount > 0
         ? `Из DWG извлечено встроенное изображение предпросмотра: ${previewCount} шт. Оно приложено отдельным image/png файлом рядом с этим отчетом.`
         : 'Встроенное изображение предпросмотра в DWG не найдено.',
      '',
      'Используй этот отчет и изображение предпросмотра как данные для анализа. Не отвечай, что файл не прочитан: он обработан в доступном для браузера режиме. Если для расчета не хватает точной векторной геометрии, перечисли, каких размеров или обозначений не хватает, но сначала проанализируй уже извлеченные данные.',
      '',
      strings.length > 0
         ? `--- НАЙДЕННЫЕ ТЕКСТОВЫЕ ДАННЫЕ (${strings.length}) ---\n${strings.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
         : 'Читаемые текстовые строки в DWG не найдены.'
   ].join('\n');

   return textFileFromContent(file.name, content);
}

async function convertDwgToText(file: File): Promise<File> {
   const arrayBuffer = await file.arrayBuffer();
   const bytes = new Uint8Array(arrayBuffer);
   const previews = extractEmbeddedPngs(bytes, file.name);
   return convertDwgBytesToText(file, bytes, previews.length);
}

async function convertDwgToChatFiles(file: File): Promise<File[]> {
   const arrayBuffer = await file.arrayBuffer();
   const bytes = new Uint8Array(arrayBuffer);
   const previews = extractEmbeddedPngs(bytes, file.name);
   return [convertDwgBytesToText(file, bytes, previews.length), ...previews];
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

   if (ext === 'dwg') {
      return convertDwgToText(file);
   }

   if (ext === 'pdf' && !file.type) {
      return withMimeType(file, 'application/pdf');
   }

   return file.type ? file : withMimeType(file, 'application/octet-stream');
}

export async function prepareFilesForChatAttachment(file: File): Promise<File[]> {
   const ext = getFileExtension(file);
   if (ext === 'dwg') {
      return convertDwgToChatFiles(file);
   }
   return [await prepareFileForChatAttachment(file)];
}

/**
 * Extracts raw text from an Office file (for knowledge base indexing).
 * Returns the text content as a string.
 */
export async function extractTextFromOfficeFile(file: File): Promise<string> {
   const ext = getFileExtension(file);
   const textFile = ext === 'dwg' ? await convertDwgToText(file) : await convertOfficeFileToText(file);
   if (textFile === file) {
      // Not converted — try reading as text
      return await file.text();
   }
   return await textFile.text();
}
