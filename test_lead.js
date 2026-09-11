import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function testLead() {
  const project = process.env.FIREBASE_PROJECT_ID;
  const location = process.env.FIREBASE_LOCATION || 'us-central1';
  
  const ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
      credentials: {
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }
  });

  const prompt = `
    Find 2 distinct real-world construction companies in Moscow.
    Return a JSON object:
    {
      "leads": [
        {
          "companyName": "String",
          "inn": "String (10-12 digits)",
          "url": "String",
          "reason": "String",
          "status": "NEW"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
    });
    
    console.log("Raw Response Text:");
    console.log(response.text);
    
    const finishReason = response.candidates?.[0]?.finishReason;
    console.log("Finish Reason:", finishReason);

  } catch (err) {
    console.error("Error:", err);
  }
}

testLead().catch(console.error);
