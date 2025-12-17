// This is a simplified wrapper around the Web Crypto API for the PoC.
// In a real app, we would use 'ethers.js' or 'tweetnacl' for easier key management.

export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return window.crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign", "verify"]
    );
}

export async function derivedKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as any,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

export async function encryptData(data: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encodedData = enc.encode(data);
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
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
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivBuffer,
            },
            key,
            encryptedData
        );
        return dec.decode(decrypted);
    } catch (e) {
        throw new Error("Decryption failed: Invalid key or corrupted data");
    }
}

export async function signMessage(privateKey: CryptoKey, message: string): Promise<string> {
    const enc = new TextEncoder();
    const signature = await window.crypto.subtle.sign(
        {
            name: "ECDSA",
            hash: { name: "SHA-256" },
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
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
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
        return await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
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
