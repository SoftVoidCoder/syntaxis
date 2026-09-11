/**
 * Client-side service for conveyor file management.
 * Calls proxy.js actions: uploadConveyorFile, deleteConveyorFile, listConveyorFiles
 */
import { ConveyorFile } from '../types';
import { callProxy } from './geminiCore';
import { isOfficeFile, extractTextFromOfficeFile } from '../utils/fileConverter';

/** Upload a file to permanent conveyor storage */
export async function uploadConveyorFile(
    requestId: string,
    file: File,
    uploadedBy: string
): Promise<ConveyorFile> {
    // Skip empty files
    if (file.size === 0) {
        throw new Error(`Файл "${file.name}" пустой (0 байт)`);
    }

    return new Promise(async (resolve, reject) => {
        let extractedText: string | undefined;

        // Try to extract text for Office files (DOCX, XLSX, etc.)
        if (isOfficeFile(file)) {
            try {
                extractedText = await extractTextFromOfficeFile(file);
                if (extractedText === await file.text()) {
                    extractedText = undefined; // if it wasn't actually converted, ignore it
                } else {
                    console.log(`[ConveyorFile] Extracted ${extractedText?.length || 0} characters from Office file`);
                }
            } catch (err) {
                console.warn("[ConveyorFile] Office extraction failed:", err);
            }
        }

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const base64Data = (reader.result as string).split(',')[1];
                const result = await callProxy('uploadConveyorFile', {
                    requestId,
                    fileData: base64Data,
                    mimeType: file.type || 'application/octet-stream',
                    displayName: file.name
                });
                resolve({
                    name: result.name,
                    gcsPath: result.gcsPath,
                    gsUri: result.gsUri,
                    mimeType: result.mimeType,
                    size: result.size,
                    uploadedBy,
                    uploadedAt: Date.now(),
                    extractedText
                });
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/** Delete a file from conveyor storage */
export async function deleteConveyorFile(gcsPath: string): Promise<void> {
    await callProxy('deleteConveyorFile', { gcsPath });
}

/** List all files for a conveyor request */
export async function listConveyorFiles(requestId: string): Promise<ConveyorFile[]> {
    const result = await callProxy('listConveyorFiles', { requestId });
    return result as ConveyorFile[];
}

/** Get a signed URL for viewing/downloading a file (valid 1 hour) */
export async function getConveyorFileUrl(gcsPath: string): Promise<string> {
    const result = await callProxy('getConveyorFileUrl', { gcsPath });
    return result.url;
}
