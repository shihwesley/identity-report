import { PortableProfile } from './types';
import realProfile from './realProfile.json';

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
