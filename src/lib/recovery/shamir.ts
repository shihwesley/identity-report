/**
 * Shamir's Secret Sharing Implementation
 *
 * Splits a secret into N shares where K shares are needed to reconstruct.
 * Uses GF(256) for byte-level operations.
 */

// ============================================================
// Galois Field GF(256) Operations
// ============================================================

// GF(256) with irreducible polynomial x^8 + x^4 + x^3 + x + 1 (0x11B)
const GF256_EXP: number[] = new Array(512);
const GF256_LOG: number[] = new Array(256);

// Initialize lookup tables
(function initGF256() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        GF256_EXP[i] = x;
        GF256_LOG[x] = i;
        x = x << 1;
        if (x >= 256) {
            x ^= 0x11B;  // Reduce by irreducible polynomial
        }
    }
    // Extend exp table for easier multiplication
    for (let i = 255; i < 512; i++) {
        GF256_EXP[i] = GF256_EXP[i - 255];
    }
    GF256_LOG[0] = 0;  // log(0) is undefined, but we set to 0 for convenience
})();

/**
 * Multiply two numbers in GF(256).
 */
function gfMul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return GF256_EXP[GF256_LOG[a] + GF256_LOG[b]];
}

/**
 * Divide two numbers in GF(256).
 */
function gfDiv(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero');
    if (a === 0) return 0;
    return GF256_EXP[(GF256_LOG[a] - GF256_LOG[b] + 255) % 255];
}

/**
 * Add two numbers in GF(256) (XOR).
 */
function gfAdd(a: number, b: number): number {
    return a ^ b;
}

/**
 * Evaluate polynomial at x using Horner's method in GF(256).
 */
function evalPolynomial(coefficients: number[], x: number): number {
    let result = 0;
    for (let i = coefficients.length - 1; i >= 0; i--) {
        result = gfAdd(gfMul(result, x), coefficients[i]);
    }
    return result;
}

// ============================================================
// Shamir's Secret Sharing
// ============================================================

export interface Share {
    index: number;  // x-coordinate (1-255)
    data: Uint8Array;  // y-coordinates for each byte
}

export interface SplitConfig {
    totalShares: number;  // N: total number of shares to create
    threshold: number;    // K: minimum shares needed to reconstruct
}

/**
 * Split a secret into shares using Shamir's Secret Sharing.
 *
 * @param secret - The secret bytes to split
 * @param config - Configuration with totalShares (N) and threshold (K)
 * @returns Array of N shares, any K of which can reconstruct the secret
 */
export function splitSecret(secret: Uint8Array, config: SplitConfig): Share[] {
    const { totalShares, threshold } = config;

    // Validation
    if (threshold < 2) {
        throw new Error('Threshold must be at least 2');
    }
    if (totalShares < threshold) {
        throw new Error('Total shares must be >= threshold');
    }
    if (totalShares > 255) {
        throw new Error('Maximum 255 shares supported');
    }

    const shares: Share[] = [];

    // Initialize shares
    for (let i = 0; i < totalShares; i++) {
        shares.push({
            index: i + 1,  // x-coordinates are 1 to N (0 is reserved for secret)
            data: new Uint8Array(secret.length)
        });
    }

    // For each byte of the secret, create a random polynomial and evaluate
    for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
        // Create polynomial coefficients
        // coefficients[0] = secret byte (constant term)
        // coefficients[1..threshold-1] = random bytes
        const coefficients: number[] = new Array(threshold);
        coefficients[0] = secret[byteIdx];

        // Generate random coefficients for higher-degree terms
        const randomBytes = new Uint8Array(threshold - 1);
        crypto.getRandomValues(randomBytes);
        for (let i = 1; i < threshold; i++) {
            coefficients[i] = randomBytes[i - 1];
        }

        // Evaluate polynomial at each share's x-coordinate
        for (let shareIdx = 0; shareIdx < totalShares; shareIdx++) {
            const x = shares[shareIdx].index;
            shares[shareIdx].data[byteIdx] = evalPolynomial(coefficients, x);
        }
    }

    return shares;
}

/**
 * Reconstruct a secret from shares using Lagrange interpolation.
 *
 * @param shares - Array of at least K shares
 * @returns The reconstructed secret bytes
 */
export function combineShares(shares: Share[]): Uint8Array {
    if (shares.length < 2) {
        throw new Error('Need at least 2 shares to reconstruct');
    }

    // Verify all shares have same length
    const dataLength = shares[0].data.length;
    if (!shares.every(s => s.data.length === dataLength)) {
        throw new Error('All shares must have same data length');
    }

    // Verify unique indices
    const indices = new Set(shares.map(s => s.index));
    if (indices.size !== shares.length) {
        throw new Error('Duplicate share indices');
    }

    const secret = new Uint8Array(dataLength);

    // Reconstruct each byte using Lagrange interpolation
    for (let byteIdx = 0; byteIdx < dataLength; byteIdx++) {
        secret[byteIdx] = lagrangeInterpolate(
            shares.map(s => ({ x: s.index, y: s.data[byteIdx] })),
            0  // Evaluate at x=0 to get the secret (constant term)
        );
    }

    return secret;
}

/**
 * Lagrange interpolation at a point in GF(256).
 */
function lagrangeInterpolate(points: Array<{ x: number; y: number }>, evalX: number): number {
    let result = 0;

    for (let i = 0; i < points.length; i++) {
        let term = points[i].y;

        for (let j = 0; j < points.length; j++) {
            if (i !== j) {
                // term *= (evalX - points[j].x) / (points[i].x - points[j].x)
                const num = gfAdd(evalX, points[j].x);
                const den = gfAdd(points[i].x, points[j].x);
                term = gfMul(term, gfDiv(num, den));
            }
        }

        result = gfAdd(result, term);
    }

    return result;
}

// ============================================================
// Share Encoding/Decoding
// ============================================================

/**
 * Encode a share to a base64 string for storage/transmission.
 */
export function encodeShare(share: Share): string {
    // Format: version (1 byte) + index (1 byte) + data
    const encoded = new Uint8Array(2 + share.data.length);
    encoded[0] = 1;  // Version 1
    encoded[1] = share.index;
    encoded.set(share.data, 2);

    return btoa(String.fromCharCode(...encoded));
}

/**
 * Decode a share from a base64 string.
 */
export function decodeShare(encoded: string): Share {
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));

    if (bytes.length < 3) {
        throw new Error('Invalid share encoding: too short');
    }

    const version = bytes[0];
    if (version !== 1) {
        throw new Error(`Unsupported share version: ${version}`);
    }

    return {
        index: bytes[1],
        data: bytes.slice(2)
    };
}

/**
 * Verify that a set of shares can reconstruct a secret with known hash.
 */
export async function verifyShares(
    shares: Share[],
    expectedHash: string
): Promise<boolean> {
    try {
        const reconstructed = combineShares(shares);
        const hash = await hashBytes(reconstructed);
        return hash === expectedHash;
    } catch {
        return false;
    }
}

/**
 * Hash bytes using SHA-256.
 */
export async function hashBytes(data: Uint8Array): Promise<string> {
    // Create a fresh copy to satisfy strict TypeScript BufferSource requirements
    const buffer = new Uint8Array(data).buffer as ArrayBuffer;
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ============================================================
// Key-Specific Functions
// ============================================================

/**
 * Split an encryption key into shares.
 * The key should be exported as raw bytes first.
 */
export async function splitEncryptionKey(
    key: CryptoKey,
    config: SplitConfig
): Promise<{ shares: Share[]; verificationHash: string }> {
    // Export key to raw bytes
    const keyBytes = new Uint8Array(await crypto.subtle.exportKey('raw', key));

    // Split the key
    const shares = splitSecret(keyBytes, config);

    // Create verification hash
    const verificationHash = await hashBytes(keyBytes);

    // Clear key bytes from memory (best effort)
    keyBytes.fill(0);

    return { shares, verificationHash };
}

/**
 * Reconstruct an encryption key from shares.
 */
export async function reconstructEncryptionKey(
    shares: Share[],
    verificationHash?: string
): Promise<CryptoKey> {
    // Reconstruct the raw key bytes
    const keyBytes = combineShares(shares);

    // Verify hash if provided
    if (verificationHash) {
        const actualHash = await hashBytes(keyBytes);
        if (actualHash !== verificationHash) {
            keyBytes.fill(0);
            throw new Error('Key verification failed: hash mismatch');
        }
    }

    // Import as AES-GCM key (cast buffer to satisfy strict TypeScript)
    const key = await crypto.subtle.importKey(
        'raw',
        new Uint8Array(keyBytes).buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    // Clear key bytes from memory (best effort)
    keyBytes.fill(0);

    return key;
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Generate a random share index that hasn't been used.
 */
export function generateUniqueIndex(existingIndices: number[]): number {
    const existing = new Set(existingIndices);
    let index: number;
    do {
        index = Math.floor(Math.random() * 254) + 1;  // 1-255
    } while (existing.has(index));
    return index;
}

/**
 * Check if a set of shares meets the threshold requirement.
 */
export function meetsThreshold(shares: Share[], threshold: number): boolean {
    if (shares.length < threshold) return false;

    // Check for unique indices
    const indices = new Set(shares.map(s => s.index));
    return indices.size >= threshold;
}
