import { PortableProfile } from './types';

// Try to load real profile, fallback to null profile if not found
let realProfile: unknown = null;
try {
    // This file is gitignored and contains user-specific data
    realProfile = require('./realProfile.json');
} catch {
    // File doesn't exist in CI or fresh installs
}

const NULL_PROFILE: PortableProfile = {
    identity: {
        displayName: "User",
        fullName: "Identity Report User",
        email: "",
        location: "",
        role: "User",
        avatarUrl: ""
    },
    preferences: [],
    shortTermMemory: [],
    longTermMemory: [],
    projects: [],
    conversations: [],
    insights: [],
    activeGrants: []
};

// Use real profile if it has conversations, otherwise fallback to empty profile
export const CURRENT_PROFILE: PortableProfile = (realProfile as unknown as PortableProfile).conversations?.length > 0
    ? (realProfile as unknown as PortableProfile)
    : NULL_PROFILE;
