import handler from './api/mathSync.js';
import dotenv from 'dotenv';
dotenv.config();

const req = {
    method: 'POST',
    body: {
        folderId: '1uKDDGZudO3qfUSlzU2O8kkJ3ppiXndTT'
    }
};

const res = {
    setHeader: (k, v) => {},
    status: (code) => ({
        json: (data) => {
            console.log("Status:", code);
            console.log("Response:", JSON.stringify(data, null, 2));
        },
        end: () => {
            console.log("Status:", code);
        }
    })
};

console.log("Starting MathSync test with Folder ID...");
handler(req, res).then(() => {
    console.log("Test finished.");
}).catch(err => {
    console.error("Test error:", err);
});
