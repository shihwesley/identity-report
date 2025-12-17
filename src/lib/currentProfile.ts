import { PortableProfile } from './types';
import { MOCK_PROFILE } from './mockData';
import realProfile from './realProfile.json';

// Use real profile if it has conversations, otherwise fallback to mock
export const CURRENT_PROFILE: PortableProfile = (realProfile as unknown as PortableProfile).conversations?.length > 0
    ? (realProfile as unknown as PortableProfile)
    : MOCK_PROFILE;
