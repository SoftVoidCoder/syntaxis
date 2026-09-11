import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) {
        console.error('FIREBASE_SERVICE_ACCOUNT env var missing');
        process.exit(1);
    }
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    try {
        const driveResponse = await drive.files.list({
            q: "name = 'используемые материалы' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
            fields: 'files(id, name, mimeType, parents)',
        });
        
        const files = driveResponse.data.files || [];
        console.log("Found files:", files);
    } catch (err) {
        console.error("Error:", err.message);
    }
}

run();
