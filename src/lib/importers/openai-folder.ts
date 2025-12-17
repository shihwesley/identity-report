/**
 * OpenAI Folder Importer
 * 
 * Imports a complete OpenAI/ChatGPT data export folder including:
 * - conversations.json - All chat history
 * - user.json - User profile
 * - Images and files uploaded by user
 * - DALL-E generations
 * - Voice session audio files
 */

import { ImportResult } from './base';
import { OpenAIImporter } from './openai';
import {
    Attachment,
    VoiceSession,
    DALLEGeneration,
    OpenAIUserProfile
} from '@/lib/types';

interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory';
    file?: File;
}

interface ExportFolderStructure {
    basePath: string;
    conversationsJson?: File;
    userJson?: File;
    sharedConversationsJson?: File;
    dalleGenerationsFolder?: FileEntry[];
    voiceFolders: Map<string, FileEntry[]>;  // conversationId -> audio files
    attachmentFiles: Map<string, File>;      // fileId -> File
}

/**
 * Parse a folder FileList to understand the export structure
 */
export function parseExportFolder(files: FileList): ExportFolderStructure {
    const structure: ExportFolderStructure = {
        basePath: '',
        voiceFolders: new Map(),
        attachmentFiles: new Map()
    };

    const dalleFiles: FileEntry[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = file.webkitRelativePath || file.name;
        const parts = path.split('/');

        // Set base path from first file
        if (!structure.basePath && parts.length > 1) {
            structure.basePath = parts[0];
        }

        const fileName = parts[parts.length - 1];
        const parentDir = parts.length > 2 ? parts[parts.length - 2] : '';

        // Identify key files
        if (fileName === 'conversations.json') {
            structure.conversationsJson = file;
        } else if (fileName === 'user.json') {
            structure.userJson = file;
        } else if (fileName === 'shared_conversations.json') {
            structure.sharedConversationsJson = file;
        }
        // DALL-E generations folder
        else if (parentDir === 'dalle-generations' && fileName.endsWith('.webp')) {
            dalleFiles.push({ name: fileName, path, type: 'file', file });
        }
        // Voice folders (UUID folders with audio subdirectory)
        else if (parentDir === 'audio' && fileName.endsWith('.wav')) {
            // The conversation ID is the grandparent folder
            const convId = parts.length > 3 ? parts[parts.length - 3] : '';
            if (convId) {
                if (!structure.voiceFolders.has(convId)) {
                    structure.voiceFolders.set(convId, []);
                }
                structure.voiceFolders.get(convId)!.push({ name: fileName, path, type: 'file', file });
            }
        }
        // Attachment files (file-* or file_* images in root)
        else if ((fileName.startsWith('file-') || fileName.startsWith('file_')) &&
            (fileName.endsWith('.jpeg') || fileName.endsWith('.jpg') ||
                fileName.endsWith('.png') || fileName.endsWith('.webp'))) {
            // Extract file ID from filename
            const fileId = fileName.replace(/\.[^.]+$/, '');
            structure.attachmentFiles.set(fileId, file);
        }
    }

    if (dalleFiles.length > 0) {
        structure.dalleGenerationsFolder = dalleFiles;
    }

    return structure;
}

/**
 * Import from a complete OpenAI export folder
 */
export async function importOpenAIFolder(files: FileList): Promise<ImportResult> {
    const importer = new OpenAIImporter();
    const structure = parseExportFolder(files);

    // Start with conversations.json
    if (!structure.conversationsJson) {
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
            errors: ['conversations.json not found in folder']
        };
    }

    // Parse conversations
    let result: ImportResult;

    // Use streaming if available to save memory (modern browsers)
    if (structure.conversationsJson.stream) {
        const stream = structure.conversationsJson.stream();
        result = await importer.parseStream(stream);
    } else {
        // Fallback for older environments
        const conversationsText = await structure.conversationsJson.text();
        result = importer.parse(conversationsText);
    }

    // Add user profile if available
    if (structure.userJson) {
        try {
            const userText = await structure.userJson.text();
            const profile = importer.parseUserProfile(userText);
            if (profile) {
                result.userProfile = profile;
            }
        } catch (e) {
            result.errors.push(`Error parsing user.json: ${(e as Error).message}`);
        }
    }

    // Match attachments to files in folder
    for (const attachment of result.attachments) {
        // Try to find matching file with various ID patterns
        const possibleIds = [
            attachment.id,
            attachment.id.replace('file_', 'file-'),
            attachment.name
        ];

        for (const id of possibleIds) {
            // Check against all attachment files
            for (const [fileId, file] of structure.attachmentFiles) {
                if (fileId.includes(id) || id.includes(fileId.split('-')[1] || '')) {
                    attachment.localPath = file.webkitRelativePath || file.name;
                    break;
                }
            }
        }
    }

    // Process DALL-E generations
    if (structure.dalleGenerationsFolder) {
        for (const entry of structure.dalleGenerationsFolder) {
            const dalle: DALLEGeneration = {
                id: entry.name.replace('.webp', ''),
                imagePath: entry.path,
                createdAt: Date.now() // Would need metadata for actual date
            };
            result.dalleGenerations.push(dalle);
        }
        result.stats.totalDALLEGenerations = result.dalleGenerations.length;
    }

    // Process voice sessions
    for (const [convId, audioEntries] of structure.voiceFolders) {
        // Find matching voice session
        const session = result.voiceSessions.find(s => {
            // Match by original conversation ID if we have it
            return true; // We'll match all for now, could improve matching
        });

        if (session) {
            // Add audio files to session
            for (const entry of audioEntries) {
                session.audioFiles.push({
                    id: entry.name.replace('.wav', ''),
                    type: 'audio',
                    name: entry.name,
                    mimeType: 'audio/wav',
                    size: 0, // Would need file.size
                    localPath: entry.path
                });
            }
        } else {
            // Create new voice session for orphaned audio
            const newSession: VoiceSession = {
                id: `voice_${convId.slice(0, 8)}`,
                conversationId: convId,
                voice: 'unknown',
                audioFiles: audioEntries.map(entry => ({
                    id: entry.name.replace('.wav', ''),
                    type: 'audio' as const,
                    name: entry.name,
                    mimeType: 'audio/wav',
                    size: 0,
                    localPath: entry.path
                })),
                createdAt: Date.now()
            };
            result.voiceSessions.push(newSession);
        }
    }
    result.stats.totalVoiceSessions = result.voiceSessions.length;

    return result;
}

/**
 * Check if a FileList appears to be an OpenAI export folder
 */
export function isOpenAIExportFolder(files: FileList): boolean {
    for (let i = 0; i < files.length; i++) {
        const path = files[i].webkitRelativePath || files[i].name;
        if (path.includes('conversations.json')) {
            return true;
        }
    }
    return false;
}
