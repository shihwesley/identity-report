import { PortableProfile } from './types';

export const MOCK_PROFILE: PortableProfile = {
    identity: {
        displayName: "QuarterShot",
        fullName: "Alex Rivera",
        email: "alex@example.com",
        location: "San Francisco, CA",
        role: "Senior Full Stack Dev",
        avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex"
    },
    preferences: [
        {
            id: "pref_1",
            key: "Response Style",
            value: "Concise, bullet-points, no fluff.",
            category: "communication",
            isEnabled: true
        },
        {
            id: "pref_2",
            key: "Tech Stack Default",
            value: "Next.js, Tailwind, TypeScript",
            category: "coding_style",
            isEnabled: true
        },
        {
            id: "pref_3",
            key: "Theme Preference",
            value: "Dark Mode with high contrast",
            category: "output_style",
            isEnabled: true
        }
    ],
    projects: [
        {
            id: "proj_1",
            name: "Vision Pro Subway App",
            description: "AR navigational aid for subway systems using Apple Vision Pro.",
            techStack: ["SwiftUI", "ARKit", "MapKit"],
            relatedMemories: ["mem_1", "mem_2"]
        },
        {
            id: "proj_2",
            name: "Umpire Strike Zone",
            description: "AR tool for amateur umpires to visualize strike zones.",
            techStack: ["Unity", "C#", "VisionOS"],
            relatedMemories: ["mem_3"]
        }
    ],
    shortTermMemory: [
        {
            id: "mem_recent_1",
            timestamp: "2023-12-05T10:00:00Z",
            content: "Researched Gemini 1.5 Pro context window limits.",
            tags: ["research", "llm"],
            type: "technical",
            sourceModel: "gemini-1.5",
            sourceProvider: "google",
            confidence: 0.9
        }
    ],
    longTermMemory: [
        {
            id: "mem_1",
            timestamp: "2023-11-22T20:54:00Z",
            content: "User prefers MapKit over generic graph approaches for city layouts.",
            tags: ["ios", "maps", "preference"],
            type: "technical",
            sourceModel: "gpt-4",
            sourceProvider: "openai",
            confidence: 0.95
        },
        {
            id: "mem_2",
            timestamp: "2023-11-20T10:00:00Z",
            content: "For AR apps, user prioritizes safety features (passthrough) over immersion.",
            tags: ["ar", "safety", "ux"],
            type: "preference",
            sourceModel: "claude-3",
            sourceProvider: "anthropic",
            confidence: 0.88
        },
        {
            id: "mem_3",
            timestamp: "2023-11-19T09:00:00Z",
            content: "Refactoring legacy Python code requires strict typing (MyPy) checks.",
            tags: ["python", "refactoring"],
            type: "technical",
            sourceModel: "gpt-4",
            sourceProvider: "openai",
            confidence: 0.92
        },
        {
            id: "mem_4",
            timestamp: "2023-05-10T14:30:00Z",
            content: "User is red-green colorblind; avoid relying solely on color for status indicators.",
            tags: ["accessibility", "health"],
            type: "fact",
            sourceModel: "gpt-4",
            sourceProvider: "openai",
            confidence: 0.99
        }
    ],
    conversations: [
        {
            id: "conv_demo_1",
            title: "Building a Vision Pro Subway App",
            messages: [
                {
                    id: "msg_1",
                    role: "user",
                    content: "I want to build an Apple Vision Pro app for subway navigation",
                    timestamp: 1700690067000
                },
                {
                    id: "msg_2",
                    role: "assistant",
                    content: "Great idea! Let's start with the core features...",
                    timestamp: 1700690070000
                }
            ],
            metadata: {
                provider: "anthropic",
                model: "claude-3-sonnet",
                createdAt: 1700690067000,
                updatedAt: 1700690070000,
                importedAt: Date.now(),
                messageCount: 2,
                wordCount: 25
            },
            tags: ["visionos", "subway", "ar"]
        }
    ],
    insights: [
        {
            id: "insight_1",
            category: "expertise",
            content: "Experienced with Apple platforms (SwiftUI, ARKit, VisionOS)",
            confidence: 0.95,
            derivedFrom: ["conv_demo_1"],
            createdAt: Date.now(),
            updatedAt: Date.now()
        },
        {
            id: "insight_2",
            category: "preference",
            content: "Prefers concise, technical explanations without fluff",
            confidence: 0.92,
            derivedFrom: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    ]
};
