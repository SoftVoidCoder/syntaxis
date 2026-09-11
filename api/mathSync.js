import { google } from 'googleapis';

// Use same pattern as proxy.js to get auth client
async function getGoogleAuthClient() {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
    const credentials = JSON.parse(saJson);

    // We need read-only scopes for Drive and Sheets to pull reference data
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/spreadsheets.readonly'
        ],
    });
    
    return await auth.getClient();
}

/**
 * Endpoint for testing connection to Google Drive folder and parsing its tables.
 * Expected JSON Body: { "folderId": "1A2B3C..." }
 */
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { folderId } = req.body;
        
        if (!folderId) {
            return res.status(400).json({ error: 'Параметр folderId обязателен. Пожалуйста, укажите ID папки из Google Диска.' });
        }

        console.log(`[mathSync] Requesting folder: ${folderId}`);
        const authClient = await getGoogleAuthClient();
        
        // 1. Initialize Drive API
        const drive = google.drive({ version: 'v3', auth: authClient });
        
        // Find spreadsheets and documents inside the folder
        const driveResponse = await drive.files.list({
            q: `'${folderId}' in parents and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.document') and trashed=false`,
            fields: 'files(id, name, mimeType)',
        });
        
        const files = driveResponse.data.files || [];
        console.log(`[mathSync] Found ${files.length} spreadsheet files in folder ${folderId}.`);

        // If no files found, return early
        if (files.length === 0) {
            return res.status(200).json({
                success: true,
                folderId,
                filesFound: 0,
                message: 'В папке не найдено ни одной Google Таблицы. Проверьте ID папки или создайте там таблицу.',
                data: []
            });
        }

        const sheetsFiles = files.filter(f => f.mimeType === 'application/vnd.google-apps.spreadsheet');
        const docsFiles = files.filter(f => f.mimeType === 'application/vnd.google-apps.document');

        const spreadsheetResults = [];
        const docResults = [];
        
        // 2. Initialize Sheets API
        const sheetsAPI = google.sheets({ version: 'v4', auth: authClient });

        // Iterate over tables and read data
        for (const file of sheetsFiles) {
            console.log(`[mathSync] Reading sheet: ${file.name} (ID: ${file.id})`);
            
            try {
                // Get spreadsheet metadata to know sheet names
                const spreadsheetInfo = await sheetsAPI.spreadsheets.get({
                    spreadsheetId: file.id,
                });
                
                const sheetNames = spreadsheetInfo.data.sheets.map(s => s.properties.title);
                const fileData = {
                    fileId: file.id,
                    fileName: file.name,
                    sheets: []
                };

                // Read data for each sheet (up to 10 sheets for preview)
                for (const sheetName of sheetNames.slice(0, 10)) {
                    // Fetch data for each sheet (A1:Z500)
                    const rangeResponse = await sheetsAPI.spreadsheets.values.get({
                        spreadsheetId: file.id,
                        range: `${sheetName}!A1:Z500`,
                    });
                    
                    fileData.sheets.push({
                        sheetName,
                        rows: rangeResponse.data.values || []
                    });
                }
                spreadsheetResults.push(fileData);
            } catch (sheetError) {
                console.error(`[mathSync] Failed to read file ${file.id}:`, sheetError.message);
                spreadsheetResults.push({
                    fileId: file.id,
                    fileName: file.name,
                    error: `Ошибка чтения: ${sheetError.message}`
                });
            }
        }

        // Iterate over docs and read text
        for (const file of docsFiles) {
            console.log(`[mathSync] Reading doc: ${file.name} (ID: ${file.id})`);
            try {
                const exportResponse = await drive.files.export({
                    fileId: file.id,
                    mimeType: 'text/plain'
                });
                
                docResults.push({
                    fileId: file.id,
                    fileName: file.name,
                    text: exportResponse.data || ''
                });
            } catch (docError) {
                console.error(`[mathSync] Failed to read doc ${file.id}:`, docError.message);
                docResults.push({
                    fileId: file.id,
                    fileName: file.name,
                    error: `Ошибка экспорта документа: ${docError.message}`
                });
            }
        }

        res.status(200).json({
            success: true,
            folderId,
            filesFound: files.length,
            data: spreadsheetResults,
            docs: docResults
        });

    } catch (error) {
        console.error("[mathSync] Connection Error:", error.message, error.stack);
        // Better error message for auth issues
        if (error.message.includes('insufficient permissions') || error.message.includes('File not found')) {
            return res.status(403).json({ 
                error: 'Нет доступа к папке или файлу. Убедитесь, что вы выдали права на чтение для сервисного аккаунта.' 
            });
        }
        res.status(500).json({ error: error.message || 'Server error' });
    }
}
