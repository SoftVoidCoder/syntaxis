import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const KONTUR_API_KEY = process.env.KONTUR_API_KEY;
    console.log("KONTUR_API_KEY:", KONTUR_API_KEY ? "EXISTS" : "MISSING");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const konturPayload = {
        dateTimeFrom: thirtyDaysAgo.toISOString(),
        dateTimeTo: thirtyDaysAhead.toISOString(),
        text: ["Термочехлы"],
        filter: {
            price: { from: 1000000 }
        }
    };

    console.log("Payload:", JSON.stringify(konturPayload, null, 2));

    const fetchUrl = 'https://api-zakupki.kontur.ru/external/v1/search';
    const fetchOptions = {
        method: 'POST',
        headers: {
            'X-Kontur-Apikey': KONTUR_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(konturPayload)
    };

    try {
        const response = await fetch(fetchUrl, fetchOptions);
        const text = await response.text();
        console.log("Response status:", response.status);
        console.log("Response body:", text.substring(0, 500));
    } catch (e) {
        console.error(e);
    }
}
run();
