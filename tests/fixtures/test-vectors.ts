/**
 * Test vectors and fixtures for IdentityReport testing
 *
 * These provide deterministic test data for consistent testing across
 * cryptographic operations, sync scenarios, and data imports.
 */

// BIP39 test mnemonics
export const MNEMONICS = {
  // Standard 12-word test mnemonic (DO NOT USE IN PRODUCTION)
  standard: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',

  // Alternative test mnemonic
  alternative: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',

  // 24-word mnemonic
  extended: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
}

// Test passwords
export const PASSWORDS = {
  simple: 'password123',
  complex: 'C0mpl3x!P@ssw0rd#2024',
  unicode: 'пароль密码🔐'
}

// Expected DID prefixes (for validation)
export const DID_PREFIXES = {
  key: 'did:key:z6Mk',
  web: 'did:web:'
}

// Mock profile data
export const MOCK_PROFILES = {
  minimal: {
    identity: {
      displayName: 'Test User',
      fullName: 'Test User',
      email: '',
      location: '',
      role: ''
    },
    preferences: [],
    shortTermMemory: [],
    longTermMemory: [],
    projects: [],
    conversations: [],
    insights: [],
    activeGrants: []
  },

  complete: {
    identity: {
      displayName: 'Alice Developer',
      fullName: 'Alice Jane Developer',
      email: 'alice@example.com',
      location: 'San Francisco, CA',
      role: 'Senior Software Engineer'
    },
    preferences: [
      { key: 'theme', value: 'dark' },
      { key: 'language', value: 'en-US' }
    ],
    shortTermMemory: [
      {
        id: 'mem-1',
        content: 'Working on identity system',
        timestamp: '2024-01-15T10:00:00Z',
        source: 'manual'
      }
    ],
    longTermMemory: [
      {
        id: 'mem-long-1',
        content: 'Expertise in cryptography and distributed systems',
        timestamp: '2023-06-01T00:00:00Z',
        source: 'inferred'
      }
    ],
    projects: [
      {
        id: 'proj-1',
        name: 'IdentityReport',
        description: 'Privacy-preserving identity management',
        status: 'active',
        technologies: ['TypeScript', 'React', 'Solidity']
      }
    ],
    conversations: [
      {
        id: 'conv-1',
        title: 'Architecture Discussion',
        provider: 'claude',
        timestamp: '2024-01-15T09:00:00Z',
        messages: [
          { role: 'user', content: 'How should we structure the vault?' },
          { role: 'assistant', content: 'I recommend a layered approach...' }
        ]
      }
    ],
    insights: [
      {
        id: 'insight-1',
        content: 'User prefers functional programming patterns',
        confidence: 0.85,
        source: 'conversation-analysis'
      }
    ],
    activeGrants: [
      {
        id: 'grant-1',
        provider: 'claude',
        scopes: ['read:identity', 'read:memories'],
        expiresAt: '2025-01-15T00:00:00Z'
      }
    ]
  }
}

// Sync conflict scenarios
export const SYNC_SCENARIOS = {
  noConflict: {
    base: { version: 1, name: 'Alice' },
    local: { version: 2, name: 'Alice', email: 'alice@example.com' },
    remote: { version: 2, name: 'Alice', location: 'NYC' },
    expected: { version: 3, name: 'Alice', email: 'alice@example.com', location: 'NYC' }
  },

  fieldConflict: {
    base: { version: 1, name: 'Alice' },
    local: { version: 2, name: 'Alice Smith' },
    remote: { version: 2, name: 'Alice Jones' },
    hasConflict: true,
    conflictField: 'name'
  },

  deletionConflict: {
    base: { version: 1, name: 'Alice', email: 'alice@example.com' },
    local: { version: 2, name: 'Alice' }, // email deleted
    remote: { version: 2, name: 'Alice', email: 'alice.new@example.com' },
    hasConflict: true,
    conflictField: 'email'
  }
}

// OpenAI export format fixture
export const OPENAI_EXPORT = {
  conversations: [
    {
      title: 'Code Review Session',
      create_time: 1704067200,
      update_time: 1704153600,
      mapping: {
        'node-1': {
          message: {
            author: { role: 'user' },
            content: { parts: ['Please review this code'] },
            create_time: 1704067200
          },
          children: ['node-2']
        },
        'node-2': {
          message: {
            author: { role: 'assistant' },
            content: { parts: ['I see several areas for improvement...'] },
            create_time: 1704067260
          },
          parent: 'node-1'
        }
      }
    }
  ]
}

// Claude export format fixture
export const CLAUDE_EXPORT = {
  conversations: [
    {
      uuid: 'conv-uuid-1',
      name: 'Architecture Discussion',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: '2024-01-01T11:00:00Z',
      chat_messages: [
        {
          uuid: 'msg-1',
          sender: 'human',
          text: 'How should I structure my app?',
          created_at: '2024-01-01T10:00:00Z'
        },
        {
          uuid: 'msg-2',
          sender: 'assistant',
          text: 'Consider using a layered architecture...',
          created_at: '2024-01-01T10:01:00Z'
        }
      ]
    }
  ]
}

// Gemini export format fixture
export const GEMINI_EXPORT = {
  conversations: [
    {
      id: 'gemini-conv-1',
      title: 'Project Planning',
      createTime: '2024-01-02T09:00:00.000Z',
      messages: [
        {
          role: 'USER',
          text: 'Help me plan my project',
          createTime: '2024-01-02T09:00:00.000Z'
        },
        {
          role: 'MODEL',
          text: 'Let me help you create a project plan...',
          createTime: '2024-01-02T09:00:30.000Z'
        }
      ]
    }
  ]
}

// Guardian/Recovery test data
export const RECOVERY_SCENARIOS = {
  threeOfFive: {
    threshold: 3,
    total: 5,
    guardians: [
      { id: 'g1', name: 'Guardian 1', email: 'g1@example.com' },
      { id: 'g2', name: 'Guardian 2', email: 'g2@example.com' },
      { id: 'g3', name: 'Guardian 3', email: 'g3@example.com' },
      { id: 'g4', name: 'Guardian 4', email: 'g4@example.com' },
      { id: 'g5', name: 'Guardian 5', email: 'g5@example.com' }
    ]
  },

  twoOfThree: {
    threshold: 2,
    total: 3,
    guardians: [
      { id: 'g1', name: 'Guardian 1', email: 'g1@example.com' },
      { id: 'g2', name: 'Guardian 2', email: 'g2@example.com' },
      { id: 'g3', name: 'Guardian 3', email: 'g3@example.com' }
    ]
  }
}

// MCP protocol test messages
export const MCP_MESSAGES = {
  listResources: {
    jsonrpc: '2.0',
    id: 1,
    method: 'resources/list',
    params: {}
  },

  readResource: {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/read',
    params: { uri: 'profile://identity' }
  },

  callTool: {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'search_memory',
      arguments: { query: 'test query' }
    }
  }
}

// JWT tokens for auth testing (expired, for testing only)
export const TEST_TOKENS = {
  validFormat: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJzY29wZXMiOlsicmVhZDppZGVudGl0eSJdLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6OTk5OTk5OTk5OX0.fake-signature',

  expiredFormat: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJzY29wZXMiOlsicmVhZDppZGVudGl0eSJdLCJpYXQiOjE3MDQwNjcyMDAsImV4cCI6MTcwNDA2NzIwMX0.fake-signature',

  invalidSignature: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.invalid'
}
