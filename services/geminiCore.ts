/**
 * Shared proxy helper and utilities used by all Gemini domain services.
 */

// Helper to sanitize base64
export const cleanBase64 = (b64: string) => {
  return b64.split(',')[1] || b64;
};

// --- PROXY HELPER ---
export const callProxy = async (action: string, payload: any, signal?: AbortSignal) => {
  // Five attempts allow one request to traverse a four-key server-side pool.
  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      let fetchSignal = signal;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (!signal) {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes default
        fetchSignal = controller.signal;
      }

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
        signal: fetchSignal
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const status = response.status;
        const errMsg = errData.error || `Server Error: ${status}`;

        if (status >= 500 && status < 600) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            console.warn(`Proxy call failed (${status}). Retrying ${attempt}/${MAX_RETRIES} in ${1000 * Math.pow(2, attempt)}ms...`);
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            continue;
          }
        }

        const httpError: any = new Error(typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg);
        httpError.status = status;
        httpError.noRetry = status >= 400 && status < 500;
        throw httpError;
      }

      return await response.json();

    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Generation Aborted by User') {
        throw new Error("Generation Aborted by User");
      }

      // The server already rotates all configured Gemini keys. A 4xx response
      // is final for this request and retrying it only leaves the UI spinning.
      if (error.noRetry || (error.status >= 400 && error.status < 500)) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        attempt++;
        console.warn(`Network failed. Retrying ${attempt}/${MAX_RETRIES}...`, error);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }

      console.error(`Proxy Call Failed (${action}):`, error);
      throw error;
    }
  }
};

/**
 * Robust JSON extraction — strips markdown fences and finds the outermost JSON object.
 */
export const extractJsonObject = (text: string): any => {
  let jsonString = text.trim();

  const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      // Fallback if parsing matched block fails
    }
  }

  jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstOpen = jsonString.indexOf('{');
  const lastClose = jsonString.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    const candidate = jsonString.substring(firstOpen, lastClose + 1);
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // If parsing fails (e.g. multiple JSON blocks), find the first valid closing brace
      let depth = 0;
      let endIdx = -1;
      for (let i = firstOpen; i <= lastClose; i++) {
        if (jsonString[i] === '{') depth++;
        else if (jsonString[i] === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      if (endIdx !== -1) {
        return JSON.parse(jsonString.substring(firstOpen, endIdx + 1));
      }
      throw e;
    }
  }
  return JSON.parse(jsonString);
};
