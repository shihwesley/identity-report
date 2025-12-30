/**
 * MCP Server Configuration
 * 
 * Environment configuration and logging utilities for the MCP server.
 */

import * as path from 'path';

// --- Environment Configuration ---

/** Path to the vault data directory */
export const VAULT_PATH = process.env.VAULT_PATH ||
    path.join(process.env.HOME || '', '.profile-vault');

/** Enable debug logging */
export const DEBUG = process.env.DEBUG === 'true';

/** MCP transport mode: 'stdio' or 'sse' */
export const TRANSPORT_MODE = process.env.MCP_TRANSPORT || 'stdio';

/** SSE transport port */
export const SSE_PORT = parseInt(process.env.MCP_PORT || '3001', 10);

import { logger, LogLevel } from '../logger';

// --- Logging ---

/** Public logging methods re-exported for convenience */
export const log = (msg: string, meta?: any) => logger.info(msg, meta);
export const logError = (msg: string, meta?: any) => logger.error(msg, meta);
export const logDebug = (msg: string, meta?: any) => logger.debug(msg, meta);
export const logAudit = (msg: string, meta?: any) => logger.audit(msg, meta);

export { logger, LogLevel };
