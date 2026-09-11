/**
 * Shared utility for converting Office files (DOCX, XLSX, PPTX) to plain text.
 * Used by both ChatInterface (file uploads) and AdminKnowledge (knowledge base uploads).
 * 
 * Depends on global libraries loaded via CDN:
 * - window.mammoth (DOCX)
 * - window.XLSX (XLSX/XLS)
 * - window.JSZip (PPTX)
 */

declare global {
   interface Window {
      mammoth?: any;
      XLSX?: any;
      JSZip?: any;
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

   if (!isDocx && !isXlsx && !isPptx) return file;

   let convertedText = '';

   if (isDocx && window.mammoth) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      convertedText = result.value || '(Empty DOCX)';
   } else if (isXlsx && window.XLSX) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
      workbook.SheetNames.forEach((sheetName: string) => {
         const worksheet = workbook.Sheets[sheetName];
         const csv = window.XLSX.utils.sheet_to_csv(worksheet);
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
