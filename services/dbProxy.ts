/**
 * Shared DB proxy helper used by all Firebase domain services.
 */
import { auth } from "./firebaseConfig";

export const callDbProxy = async (action: string, payload: any = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    let token = payload.authToken;
    if (auth?.currentUser) {
      try { token = await auth.currentUser.getIdToken(); }
      catch (e) { console.warn("getIdToken() failed (custom auth in use):", e); }
    }

    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action, authToken: token }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown");
      if (response.status === 404) throw new Error("Proxy Endpoint Not Found (Localhost?)");
      if (response.status === 500) throw new Error(`Proxy Server Error: ${errText}`);
      throw new Error(`Proxy Status ${response.status}: ${errText}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`DB Proxy Timeout (8s) for ${action}`);
      throw new Error("Proxy Timeout");
    }
    console.error(`DB Proxy Call Failed (${action}):`, error);
    throw error;
  }
};
