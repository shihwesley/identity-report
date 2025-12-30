/**
 * Unified Logging System
 * 
 * A high-performance, structured logging utility for Identity Report.
 * Designed to be zero-dependency and cross-platform (Node.js & Browser).
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    AUDIT = 4
}

const LogLevelNames = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.AUDIT]: 'AUDIT'
};

const LogLevelColors = {
    [LogLevel.DEBUG]: '\x1b[90m', // Gray
    [LogLevel.INFO]: '\x1b[34m',  // Blue
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.AUDIT]: '\x1b[35m'  // Magenta
};

const RESET_COLOR = '\x1b[0m';

export interface LogMetadata {
    [key: string]: unknown;
}

class Logger {
    private env: 'development' | 'production' | 'test';
    private isNode: boolean;
    private currentLevel: LogLevel;

    constructor() {
        this.isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
        const nodeEnv = (typeof process !== 'undefined' && process.env.NODE_ENV) || 'development';
        this.env = nodeEnv as 'development' | 'production' | 'test';

        // Default levels: Switch to INFO in production by default
        this.currentLevel = (this.env === 'production') ? LogLevel.INFO : LogLevel.DEBUG;

        // Override from env if available (Node.js only)
        if (this.isNode && process.env.LOG_LEVEL) {
            const envLevel = process.env.LOG_LEVEL.toUpperCase();
            const level = (LogLevel as any)[envLevel];
            if (typeof level === 'number') {
                this.currentLevel = level;
            }
        }
    }

    setLevel(level: LogLevel) {
        this.currentLevel = level;
    }

    private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): void {
        if (level < this.currentLevel) return;

        const timestamp = new Date().toISOString();
        const levelName = LogLevelNames[level];

        if (this.isNode && this.env === 'production') {
            // Structured JSON logging for production/backend
            const logEntry = {
                timestamp,
                level: levelName,
                message,
                ...metadata
            };
            process.stderr.write(JSON.stringify(logEntry) + '\n');
        } else {
            // Colorized/Readable logging for development
            const color = LogLevelColors[level] || '';
            const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';

            if (this.isNode) {
                process.stderr.write(`${color}[${timestamp}] ${levelName}: ${message}${metaStr}${RESET_COLOR}\n`);
            } else {
                // Browser console logging
                const consoleMethod = this.getConsoleMethod(level);
                (console as any)[consoleMethod](`[${levelName}] ${message}`, metadata || '');
            }
        }
    }

    private getConsoleMethod(level: LogLevel): string {
        switch (level) {
            case LogLevel.DEBUG: return 'debug';
            case LogLevel.INFO: return 'info';
            case LogLevel.WARN: return 'warn';
            case LogLevel.ERROR: return 'error';
            case LogLevel.AUDIT: return 'info'; // Use info for audit in console
            default: return 'log';
        }
    }

    debug(message: string, metadata?: LogMetadata) {
        this.formatMessage(LogLevel.DEBUG, message, metadata);
    }

    info(message: string, metadata?: LogMetadata) {
        this.formatMessage(LogLevel.INFO, message, metadata);
    }

    warn(message: string, metadata?: LogMetadata) {
        this.formatMessage(LogLevel.WARN, message, metadata);
    }

    error(message: string, metadata?: LogMetadata) {
        this.formatMessage(LogLevel.ERROR, message, metadata);
    }

    /**
     * Audit logging for security-sensitive events.
     * These logs should ideally never be filtered or removed.
     */
    audit(message: string, metadata?: LogMetadata) {
        this.formatMessage(LogLevel.AUDIT, message, metadata);
    }
}

export const logger = new Logger();
