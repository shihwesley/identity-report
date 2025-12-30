// This is a simplified wrapper around the Web Crypto API for the PoC.
// In a real app, we would use 'ethers.js' or 'tweetnacl' for easier key management.

import { VAULT_CONSTANTS, CRYPTO_CONSTANTS } from '../constants';

/**
 * Get the crypto implementation for the current environment.
 * Works in both browser (window.crypto) and Node.js 20+ (globalThis.crypto).
 */
function getCrypto(): Crypto {
    // Browser environment
    if (typeof window !== 'undefined' && window.crypto) {
        return window.crypto;
    }
    // Node.js 20+ has globalThis.crypto
    if (typeof globalThis !== 'undefined' && globalThis.crypto) {
        return globalThis.crypto;
    }
    throw new Error('No crypto implementation available. Ensure you are running Node.js 20+ or a modern browser.');
}

/**
 * Get random values in a cross-platform way.
 */
function getRandomValues(array: Uint8Array): Uint8Array {
    return getCrypto().getRandomValues(array);
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return getCrypto().subtle.generateKey(
        {
            name: CRYPTO_CONSTANTS.ECDSA_CURVE === 'P-256' ? 'ECDSA' : 'ECDSA',
            namedCurve: CRYPTO_CONSTANTS.ECDSA_CURVE,
        },
        true,
        ['sign', 'verify']
    );
}

export async function derivedKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const crypto = getCrypto();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: VAULT_CONSTANTS.PBKDF2_ITERATIONS,
            hash: CRYPTO_CONSTANTS.HASH_ALGORITHM,
        },
        keyMaterial,
        { name: CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM, length: VAULT_CONSTANTS.AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptData(data: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
    const enc = new TextEncoder();
    const crypto = getCrypto();
    const iv = getRandomValues(new Uint8Array(VAULT_CONSTANTS.IV_LENGTH));

    const encodedData = enc.encode(data);
    const encrypted = await crypto.subtle.encrypt(
        {
            name: CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM,
            iv: iv as BufferSource,
        },
        key,
        encodedData
    );

    return {
        ciphertext: Buffer.from(encrypted).toString('base64'),
        iv: Buffer.from(iv).toString('base64')
    };
}

export async function decryptData(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
    const dec = new TextDecoder();
    const encryptedData = Buffer.from(ciphertext, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    try {
        const decrypted = await getCrypto().subtle.decrypt(
            {
                name: CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM,
                iv: ivBuffer,
            },
            key,
            encryptedData
        );
        return dec.decode(decrypted);
    } catch (e) {
        throw new Error('Decryption failed: Invalid key or corrupted data');
    }
}

export async function signMessage(privateKey: CryptoKey, message: string): Promise<string> {
    const enc = new TextEncoder();
    const signature = await getCrypto().subtle.sign(
        {
            name: 'ECDSA',
            hash: { name: CRYPTO_CONSTANTS.HASH_ALGORITHM },
        },
        privateKey,
        enc.encode(message)
    );
    return Buffer.from(signature).toString('base64');
}

// --- Binary Blob Encryption ---

export interface EncryptedBlob {
    id: string;
    type: 'image' | 'audio' | 'file' | 'video';
    name: string;
    mimeType: string;
    size: number;
    encryptedData: string; // Base64 encoded encrypted data
    iv: string;
}

/**
 * Encrypt binary data (images, audio, files).
 */
export async function encryptBlob(
    data: ArrayBuffer,
    key: CryptoKey,
    metadata: { id: string; type: EncryptedBlob['type']; name: string; mimeType: string }
): Promise<EncryptedBlob> {
    const crypto = getCrypto();
    const iv = getRandomValues(new Uint8Array(VAULT_CONSTANTS.IV_LENGTH));

    const encrypted = await crypto.subtle.encrypt(
        {
            name: CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM,
            iv: iv as BufferSource,
        },
        key,
        data
    );

    return {
        ...metadata,
        size: data.byteLength,
        encryptedData: Buffer.from(encrypted).toString('base64'),
        iv: Buffer.from(iv).toString('base64')
    };
}

/**
 * Decrypt binary blob back to ArrayBuffer.
 */
export async function decryptBlob(blob: EncryptedBlob, key: CryptoKey): Promise<ArrayBuffer> {
    const encryptedData = Buffer.from(blob.encryptedData, 'base64');
    const ivBuffer = Buffer.from(blob.iv, 'base64');

    try {
        return await getCrypto().subtle.decrypt(
            {
                name: CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM,
                iv: ivBuffer,
            },
            key,
            encryptedData
        );
    } catch (e) {
        throw new Error(`Decryption failed for blob ${blob.id}: Invalid key or corrupted data`);
    }
}

/**
 * Convert ArrayBuffer to Blob URL for display.
 */
export function arrayBufferToObjectUrl(buffer: ArrayBuffer, mimeType: string): string {
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
}
