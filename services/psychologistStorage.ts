import { PsychologistChatSession } from '../types';

const STORAGE_KEY_PREFIX = 'korda_psych_chats_';
const PIN_VERIFIER_KEY = 'korda_psych_pin_verifier';
const SALT_KEY = 'korda_psych_salt';

// ------------------------------------------------------------------
// Web Crypto Utils
// ------------------------------------------------------------------

/**
 * Generate a random salt and store it, or retrieve existing.
 * We use the same salt for the user's PIN derivation to keep things simple.
 */
const getOrGenerateSalt = (): Uint8Array => {
    let saltHex = localStorage.getItem(SALT_KEY);
    if (!saltHex) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(SALT_KEY, saltHex);
        return salt;
    }
    const chars = saltHex.match(/.{1,2}/g) || [];
    return new Uint8Array(chars.map(c => parseInt(c, 16)));
};

/**
 * Derives an AES-GCM encryption key from a 4-digit PIN.
 */
const deriveKeyFromPin = async (pin: string): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(pin),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );

    const salt = getOrGenerateSalt();

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
};

// ------------------------------------------------------------------
// Encryption / Decryption
// ------------------------------------------------------------------

const encryptData = async (data: string, pin: string): Promise<string> => {
    const key = await deriveKeyFromPin(pin);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    
    const ciphertextBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        enc.encode(data)
    );

    // Combine IV and Ciphertext for storage
    const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertextBuffer), iv.length);

    // Convert to Base64
    return btoa(String.fromCharCode(...combined));
};

const decryptData = async (encryptedBase64: string, pin: string): Promise<string> => {
    const key = await deriveKeyFromPin(pin);
    
    // Decode Base64
    const binaryStr = atob(encryptedBase64);
    const combined = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        combined[i] = binaryStr.charCodeAt(i);
    }

    // Extract IV and Ciphertext
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
};

// ------------------------------------------------------------------
// App Logic
// ------------------------------------------------------------------

/**
 * Checks if a PIN is already set.
 */
export const hasPinSet = (): boolean => {
    return !!localStorage.getItem(PIN_VERIFIER_KEY);
};

/**
 * Validates the entered PIN by attempting to decrypt the verifier.
 */
export const validatePin = async (pin: string): Promise<boolean> => {
    if (!hasPinSet()) return false;
    try {
        const encryptedVerifier = localStorage.getItem(PIN_VERIFIER_KEY);
        if (!encryptedVerifier) return false;
        const decrypted = await decryptData(encryptedVerifier, pin);
        return decrypted === 'korda_psych_valid';
    } catch (e) {
        return false; // Decryption failed = wrong PIN
    }
};

/**
 * Sets the initial PIN and creates the verifier.
 */
export const setInitialPin = async (pin: string): Promise<void> => {
    if (hasPinSet()) throw new Error('PIN already set');
    const encryptedVerifier = await encryptData('korda_psych_valid', pin);
    localStorage.setItem(PIN_VERIFIER_KEY, encryptedVerifier);
};

/**
 * Erases all psychologist data locally.
 */
export const resetAllPsychologistData = (): void => {
    localStorage.removeItem(PIN_VERIFIER_KEY);
    localStorage.removeItem(SALT_KEY);
    
    // Remove all user psych chats
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
};

const getChatsKey = (userId: string) => `${STORAGE_KEY_PREFIX}${userId}`;

/**
 * Retrieves and decrypts all chats for a user.
 */
export const getPsychologistChats = async (userId: string, pin: string): Promise<PsychologistChatSession[]> => {
    const key = getChatsKey(userId);
    const encryptedData = localStorage.getItem(key);
    if (!encryptedData) return [];

    try {
        const decryptedJson = await decryptData(encryptedData, pin);
        return JSON.parse(decryptedJson) as PsychologistChatSession[];
    } catch (e) {
        console.error("Failed to decrypt chats:", e);
        return [];
    }
};

/**
 * Encrypts and saves the full chat array for a user.
 */
const saveAllChats = async (userId: string, chats: PsychologistChatSession[], pin: string): Promise<void> => {
    const key = getChatsKey(userId);
    const jsonStr = JSON.stringify(chats);
    const encryptedData = await encryptData(jsonStr, pin);
    localStorage.setItem(key, encryptedData);
};

/**
 * Saves or updates a single chat session.
 */
export const savePsychologistChat = async (userId: string, chat: PsychologistChatSession, pin: string): Promise<void> => {
    const allChats = await getPsychologistChats(userId, pin);
    const existingIndex = allChats.findIndex(c => c.id === chat.id);
    
    if (existingIndex >= 0) {
        allChats[existingIndex] = chat;
    } else {
        allChats.unshift(chat);
    }
    
    await saveAllChats(userId, allChats, pin);
};

/**
 * Deletes a single chat session.
 */
export const deletePsychologistChat = async (userId: string, chatId: string, pin: string): Promise<void> => {
    let allChats = await getPsychologistChats(userId, pin);
    allChats = allChats.filter(c => c.id !== chatId);
    await saveAllChats(userId, allChats, pin);
};
