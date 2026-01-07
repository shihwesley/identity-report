/**
 * Wallet Identity System
 * 
 * Creates a crypto-wallet-like identity for the Profile Vault.
 * Uses BIP39 mnemonic phrases for recovery, similar to MetaMask.
 */

import * as bip39 from 'bip39';
import * as ed from '@noble/ed25519';
import { AccessGrant } from '../types';

// Polyfill for @noble/ed25519 to work with Node.js crypto if needed, 
// strictly it uses the web crypto api which is available in Node 19+ globally
// or via require('crypto').webcrypto in older ones. 
// Assuming Node 20+ environment or standardized Web Crypto.

// Simple hash function using Web Crypto API
async function sha256(data: Uint8Array): Promise<Uint8Array> {
    // Pass Uint8Array directly for better cross-environment compatibility
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
}

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

export interface WalletIdentity {
    did: string;           // did:key:z... format
    publicKey: string;     // hex-encoded public key
    createdAt: number;
}

export interface WalletKeys {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}

/**
 * Generate a new wallet with a 12-word mnemonic phrase.
 * This is the user's "seed phrase" for recovery.
 */
export function generateMnemonic(): string {
    return bip39.generateMnemonic(128); // 128 bits = 12 words
}

/**
 * Validate a mnemonic phrase.
 */
export function validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
}

/**
 * Derive cryptographic keys from a mnemonic phrase.
 * Uses the mnemonic to generate a deterministic seed, then derives keys.
 */
export async function deriveKeysFromMnemonic(mnemonic: string): Promise<WalletKeys> {
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }

    // Convert mnemonic to seed (512-bit)
    const seed = await bip39.mnemonicToSeed(mnemonic);

    // Use the seed to generate Ed25519 private key
    // Standard Ed25519 private keys are 32 bytes.
    // We hash the seed to get a deterministic 32-byte key.
    const privateKey = (await sha256(new Uint8Array(seed))).slice(0, 32);

    // Derive public key
    const publicKey = await ed.getPublicKeyAsync(privateKey);

    return {
        privateKey,
        publicKey
    };
}

/**
 * Create a DID (Decentralized Identifier) from a public key.
 * Format: did:key:z<multibase-encoded-public-key>
 * 
 * This follows the did:key method specification.
 */
export function createDidFromPublicKey(publicKey: Uint8Array): string {
    // Multicodec prefix for Ed25519 public key is 0xed01
    const multicodecPrefix = new Uint8Array([0xed, 0x01]);
    const prefixedKey = new Uint8Array([...multicodecPrefix, ...publicKey]);

    // Use base58btc encoding (simplified - using hex for now)
    // In production, use proper multibase encoding
    // For now we will keep using the hex format prefixed with 'z' as per the simplified format used before
    // REAL WORLD NOTE: standard did:key z... uses Base58. 
    // We'll stick to hex for this demo consistency or upgrade if we add bs58 lib.
    const encoded = bytesToHex(prefixedKey);

    return `did:key:z${encoded}`;
}

/**
 * Create a complete wallet identity from a mnemonic.
 */
export async function createWalletIdentity(mnemonic: string): Promise<{
    identity: WalletIdentity;
    keys: WalletKeys;
}> {
    const keys = await deriveKeysFromMnemonic(mnemonic);
    const did = createDidFromPublicKey(keys.publicKey);

    return {
        identity: {
            did,
            publicKey: bytesToHex(keys.publicKey),
            createdAt: Date.now()
        },
        keys
    };
}

/**
 * Derive an encryption key from the wallet's private key and a password.
 * This provides two-factor protection: mnemonic + password.
 */
export async function deriveEncryptionKey(
    privateKey: Uint8Array,
    password: string
): Promise<CryptoKey> {
    const encoder = new TextEncoder();

    // Combine private key and password
    const combined = new Uint8Array([
        ...privateKey,
        ...encoder.encode(password)
    ]);

    // Use PBKDF2 for key derivation
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        combined,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    // Use a fixed salt derived from the private key for consistency
    const salt = await sha256(privateKey);

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Sign a message using the wallet's private key.
 * Used for creating verifiable access grants.
 */
export async function signMessage(
    privateKey: Uint8Array,
    message: string
): Promise<string> {
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    const signature = await ed.signAsync(messageBytes, privateKey);
    return bytesToHex(signature);
}

/**
 * Verify a signed message.
 */
export async function verifySignature(
    publicKey: Uint8Array | string,
    message: string,
    signature: string
): Promise<boolean> {
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    // Handle hex string inputs
    const pubKeyBytes = typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey;
    const sigBytes = hexToBytes(signature);

    return ed.verifyAsync(sigBytes, messageBytes, pubKeyBytes);
}

/**
 * Export wallet identity for backup (excludes private key).
 */
export function exportIdentity(identity: WalletIdentity): string {
    return JSON.stringify(identity, null, 2);
}

/**
 * Import a wallet identity from backup.
 */
export function importIdentity(json: string): WalletIdentity {
    const parsed = JSON.parse(json);

    if (!parsed.did || !parsed.publicKey || !parsed.createdAt) {
        throw new Error('Invalid identity format');
    }

    return parsed as WalletIdentity;
}

/**
 * Sign an access grant using the wallet's private key.
 */
export async function signAccessGrant(
    grant: Omit<AccessGrant, 'signature'>,
    privateKey: Uint8Array
): Promise<AccessGrant> {
    // Create deterministic definition of the grant for signing
    // Canonical JSON stringify is ideal, but here we enforce key order manually
    const payload = JSON.stringify({
        id: grant.id,
        grantee: grant.grantee,
        permissions: grant.permissions.sort(),
        expiresAt: grant.expiresAt
    });

    const signature = await signMessage(privateKey, payload);

    return {
        ...grant,
        signature
    };
}

// ============================================================
// JWT Key Derivation (Separate Path for MCP Authentication)
// ============================================================

/**
 * Derivation path constants for key isolation.
 * Using separate paths limits blast radius if one key is compromised.
 */
export const KEY_DERIVATION_PATHS = {
    ENCRYPTION: 0,  // m/44'/identity'/0' - Main encryption key
    JWT_SIGNING: 1, // m/44'/identity'/1' - JWT signing key
    RECOVERY: 2,    // m/44'/identity'/2' - Recovery key (future)
} as const;

export interface JwtKeyPair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    publicKeyHex: string;
}

/**
 * Derive a separate key pair for JWT signing from a mnemonic.
 * Uses a different derivation path than the main encryption key for isolation.
 */
export async function deriveJwtSigningKey(mnemonic: string): Promise<JwtKeyPair> {
    if (!validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
    }

    // Convert mnemonic to seed
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const seedBytes = new Uint8Array(seed);

    // Create path-specific derivation by hashing seed + path identifier
    // This ensures JWT key is cryptographically isolated from encryption key
    const pathMarker = new Uint8Array([
        0x4A, 0x57, 0x54, // "JWT" in ASCII
        KEY_DERIVATION_PATHS.JWT_SIGNING
    ]);

    const combinedForJwt = new Uint8Array([...seedBytes, ...pathMarker]);
    const jwtSeed = await sha256(combinedForJwt);

    // Derive Ed25519 key pair from JWT-specific seed
    const privateKey = jwtSeed.slice(0, 32);
    const publicKey = await ed.getPublicKeyAsync(privateKey);

    return {
        privateKey,
        publicKey,
        publicKeyHex: bytesToHex(publicKey)
    };
}

/**
 * JWT Token structure for MCP authentication.
 */
export interface JwtPayload {
    sub: string;        // DID (subject)
    iat: number;        // Issued at (Unix timestamp)
    exp: number;        // Expiry (Unix timestamp)
    jti: string;        // Unique token ID
    client: string;     // Client identifier (e.g., "claude-desktop")
    scope: string[];    // Allowed operation scopes
}

export interface JwtHeader {
    alg: 'EdDSA';
    typ: 'JWT';
}

/**
 * Create a signed JWT token for MCP authentication.
 */
export async function createJwt(
    payload: Omit<JwtPayload, 'iat' | 'jti'>,
    privateKey: Uint8Array
): Promise<string> {
    const header: JwtHeader = {
        alg: 'EdDSA',
        typ: 'JWT'
    };

    const fullPayload: JwtPayload = {
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID()
    };

    // Base64URL encode header and payload
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(fullPayload));

    // Create signature
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = await ed.signAsync(
        new TextEncoder().encode(signingInput),
        privateKey
    );
    const signatureB64 = base64UrlEncode(String.fromCharCode(...signature));

    return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Verify and decode a JWT token.
 */
export async function verifyJwt(
    token: string,
    publicKey: Uint8Array | string
): Promise<JwtPayload> {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header
    const header = JSON.parse(base64UrlDecode(headerB64)) as JwtHeader;
    if (header.alg !== 'EdDSA') {
        throw new Error('Unsupported algorithm');
    }

    // Verify signature
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Uint8Array.from(
        base64UrlDecode(signatureB64).split('').map(c => c.charCodeAt(0))
    );

    const pubKeyBytes = typeof publicKey === 'string'
        ? hexToBytes(publicKey)
        : publicKey;

    const isValid = await ed.verifyAsync(
        signature,
        new TextEncoder().encode(signingInput),
        pubKeyBytes
    );

    if (!isValid) {
        throw new Error('Invalid JWT signature');
    }

    // Decode and validate payload
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
        throw new Error('JWT has expired');
    }

    return payload;
}

// Base64URL encoding helpers (RFC 4648)
function base64UrlEncode(str: string): string {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
        base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf-8');
}
