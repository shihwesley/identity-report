// This is a simplified wrapper around the Web Crypto API for the PoC.
// In a real app, we would use 'ethers.js' or 'tweetnacl' for easier key management.
export async function generateKeyPair() {
    return window.crypto.subtle.generateKey({
        name: "ECDSA",
        namedCurve: "P-256",
    }, true, ["sign", "verify"]);
}
export async function derivedKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
    }, keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}
export async function encryptData(data, key) {
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = enc.encode(data);
    const encrypted = await window.crypto.subtle.encrypt({
        name: "AES-GCM",
        iv: iv,
    }, key, encodedData);
    return {
        ciphertext: Buffer.from(encrypted).toString('base64'),
        iv: Buffer.from(iv).toString('base64')
    };
}
export async function decryptData(ciphertext, iv, key) {
    const dec = new TextDecoder();
    const encryptedData = Buffer.from(ciphertext, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    try {
        const decrypted = await window.crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: ivBuffer,
        }, key, encryptedData);
        return dec.decode(decrypted);
    }
    catch (e) {
        throw new Error("Decryption failed: Invalid key or corrupted data");
    }
}
export async function signMessage(privateKey, message) {
    const enc = new TextEncoder();
    const signature = await window.crypto.subtle.sign({
        name: "ECDSA",
        hash: { name: "SHA-256" },
    }, privateKey, enc.encode(message));
    return Buffer.from(signature).toString('base64');
}
/**
 * Encrypt binary data (images, audio, files).
 */
export async function encryptBlob(data, key, metadata) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt({
        name: "AES-GCM",
        iv: iv,
    }, key, data);
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
export async function decryptBlob(blob, key) {
    const encryptedData = Buffer.from(blob.encryptedData, 'base64');
    const ivBuffer = Buffer.from(blob.iv, 'base64');
    try {
        return await window.crypto.subtle.decrypt({
            name: "AES-GCM",
            iv: ivBuffer,
        }, key, encryptedData);
    }
    catch (e) {
        throw new Error(`Decryption failed for blob ${blob.id}: Invalid key or corrupted data`);
    }
}
/**
 * Convert ArrayBuffer to Blob URL for display.
 */
export function arrayBufferToObjectUrl(buffer, mimeType) {
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
}
