/**
 * Unified Importer
 * 
 * Auto-detects the provider from the export data and uses the appropriate importer.
 * Supports both single file and folder imports.
 */

import { OpenAIImporter } from './openai';
import { ClaudeImporter } from './claude';
import { GeminiImporter } from './gemini';
import { ImportResult } from './base';
import { AIProvider } from '@/lib/types';

export type { ImportResult } from './base';
export { OpenAIImporter, openaiImporter } from './openai';
export { ClaudeImporter, claudeImporter } from './claude';
export { GeminiImporter, geminiImporter } from './gemini';
export { importOpenAIFolder, isOpenAIExportFolder, parseExportFolder } from './openai-folder';

const openaiImporter = new OpenAIImporter();
const claudeImporter = new ClaudeImporter();
const geminiImporter = new GeminiImporter();

export type DetectedProvider = AIProvider | 'unknown';

/**
 * Detect the provider from export data structure.
 */
export function detectProvider(data: string): DetectedProvider {
    try {
        const parsed = JSON.parse(data);

        // OpenAI has a "mapping" field with tree structure
        if (Array.isArray(parsed) && parsed[0]?.mapping) {
            return 'openai';
        }

        // Claude has "chat_messages" array
        if (Array.isArray(parsed) && parsed[0]?.chat_messages) {
            return 'anthropic';
        }
        if (parsed.conversations?.[0]?.chat_messages) {
            return 'anthropic';
        }

        // Gemini has "turns" or specific message structure
        if (parsed.turns || (Array.isArray(parsed) && parsed[0]?.turns)) {
            return 'google';
        }
        if (parsed.messages?.[0]?.author || parsed.messages?.[0]?.role === 'model') {
            return 'google';
        }

        // Check for HTML (Google Takeout)
        if (data.includes('<html') || data.includes('data-bard')) {
            return 'google';
        }

        return 'unknown';
    } catch {
        // Not valid JSON, might be HTML
        if (data.includes('<html') || data.includes('<!DOCTYPE')) {
            return 'google';
        }
        return 'unknown';
    }
}

/**
 * Create an empty result with proper structure
 */
function createEmptyResult(error?: string): ImportResult {
    return {
        conversations: [],
        memories: [],
        attachments: [],
        voiceSessions: [],
        dalleGenerations: [],
        stats: {
            totalConversations: 0,
            totalMessages: 0,
            totalWords: 0,
            totalAttachments: 0,
            totalVoiceSessions: 0,
            totalDALLEGenerations: 0,
            contentTypeDistribution: {},
            dateRange: { earliest: Date.now(), latest: Date.now() }
        },
        errors: error ? [error] : []
    };
}

/**
 * Import conversations with auto-detection.
 */
export function importConversations(data: string, provider?: AIProvider): ImportResult {
    const detectedProvider = provider || detectProvider(data);

    switch (detectedProvider) {
        case 'openai':
            return openaiImporter.parse(data);
        case 'anthropic':
            return claudeImporter.parse(data);
        case 'google':
            return geminiImporter.parse(data);
        default:
            return createEmptyResult(`Unknown or unsupported provider format. Detected: ${detectedProvider}`);
    }
}

/**
 * Get available importers with support info.
 */
export function getAvailableImporters() {
    return [
        {
            id: 'openai',
            name: 'OpenAI/ChatGPT',
            description: 'Full folder or conversations.json',
            supportsFolder: true,
            fileTypes: '.json, folder'
        },
        {
            id: 'anthropic',
            name: 'Claude',
            description: 'Import from Claude.ai export',
            supportsFolder: false,
            fileTypes: '.json'
        },
        {
            id: 'google',
            name: 'Google Gemini',
            description: 'Import from Google Takeout',
            supportsFolder: false,
            fileTypes: '.json, .html'
        }
    ];
}
