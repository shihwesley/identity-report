/**
 * Shared Constants
 * 
 * Centralized configuration values and magic numbers used across the application.
 */

export const VAULT_CONSTANTS = {
    /** Maximum memories in short-term before rotation to long-term */
    SHORT_TERM_MEMORY_LIMIT: 50,
    /** Number of memories to move when rotating */
    MEMORY_ROTATION_BATCH: 20,
    /** Default limit for search results */
    DEFAULT_SEARCH_LIMIT: 10,
    /** PBKDF2 iteration count for key derivation */
    PBKDF2_ITERATIONS: 100000,
    /** AES key length in bits */
    AES_KEY_LENGTH: 256,
    /** Initialization vector length in bytes */
    IV_LENGTH: 12,
    /** Minimum significant conversation length for memory extraction */
    MIN_CONVERSATION_LENGTH: 4,
} as const;

export const MCP_CONSTANTS = {
    /** MCP protocol version */
    PROTOCOL_VERSION: '2024-11-05',
    /** Server name for MCP handshake */
    SERVER_NAME: 'profile-context-protocol',
    /** Server version */
    SERVER_VERSION: '1.0.0',
    /** Default SSE port */
    DEFAULT_PORT: 3001,
    /** Server description */
    SERVER_DESCRIPTION: "User's portable AI profile with conversation history and preferences",
} as const;

export const CRYPTO_CONSTANTS = {
    /** Algorithm for symmetric encryption */
    SYMMETRIC_ALGORITHM: 'AES-GCM',
    /** Hash algorithm for key derivation */
    HASH_ALGORITHM: 'SHA-256',
    /** Curve for ECDSA signing */
    ECDSA_CURVE: 'P-256',
} as const;
