/**
 * Design Studio services — image generation (Imagen) and video generation (Veo).
 */
import { Attachment } from "../types";
import { callProxy, cleanBase64 } from "./geminiCore";

// --- Image Generation ---
interface GenerateDesignProps {
  prompt: string;
  referenceImages: Attachment[];
  aspectRatio: string;
  imageSize?: '1K' | '2K';
  model?: string;
}

export const generateDesignImage = async ({
  prompt, referenceImages, aspectRatio, imageSize = '1K', model = 'gemini-3-pro-image'
}: GenerateDesignProps): Promise<string | null> => {
  const parts: any[] = [];
  referenceImages.forEach(img => {
    parts.push({ inlineData: { mimeType: img.mimeType, data: cleanBase64(img.data) } });
  });
  parts.push({ text: prompt });

  try {
    const result = await callProxy('generateImages', {
      model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { aspectRatio: aspectRatio as any, imageSize }
      }
    });
    return result.image || null;
  } catch (error: any) {
    console.error("Design Generation Error:", error);
    throw new Error(error.message || "Ошибка генерации изображения");
  }
};

// --- Video Generation (Veo) ---
interface GenerateVideoProps {
  prompt: string;
  image: Attachment;
  aspectRatio: string;
  resolution: '720p' | '1080p';
}

export const generateDesignVideo = async ({
  prompt, image, aspectRatio, resolution
}: GenerateVideoProps): Promise<string | null> => {
  try {
    const initResult = await callProxy('generateVideos', {
      model: 'veo-3.1-generate-preview',
      prompt,
      image: { imageBytes: cleanBase64(image.data), mimeType: image.mimeType },
      config: { numberOfVideos: 1, resolution, aspectRatio: aspectRatio as any }
    });

    if (!initResult.operationName) {
      if (initResult.videoData) return initResult.videoData;
      throw new Error("No Operation ID returned");
    }

    const { operationName } = initResult;
    const POLLING_INTERVAL = 30000;
    const MAX_ATTEMPTS = 20;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      try {
        const statusResult = await callProxy('getVideoStatus', { operationName });
        if (statusResult.done) {
          if (statusResult.videoData) return statusResult.videoData;
          throw new Error("Generation done but no video data returned");
        }
      } catch (pollErr: any) {
        console.warn("Polling error (retrying):", pollErr);
        const msg = pollErr.message || "";
        if (msg.includes("Operation done") || msg.includes("Video Gen Failed") || msg.includes("Google API Error: 4") || msg.includes("No Operation ID")) {
          throw pollErr;
        }
      }
    }
    throw new Error("Video Generation timed out (Client Limit)");
  } catch (error: any) {
    console.error("Video Generation Error:", error);
    throw new Error(error.message || "Ошибка генерации видео");
  }
};
