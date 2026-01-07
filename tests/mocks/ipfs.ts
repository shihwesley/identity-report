import { vi } from 'vitest'

// Mock IPFS responses
export const MOCK_IPFS = {
  // Mock CID responses
  cids: new Map<string, unknown>(),

  // Track upload calls
  uploads: [] as Array<{ content: unknown; timestamp: number }>,

  // Pin status tracking
  pins: new Set<string>(),

  // Simulate network conditions
  networkDelay: 0,
  shouldFail: false,
  failureRate: 0
}

// Mock Pinata-style responses
export const mockPinataAPI = {
  pinJSONToIPFS: vi.fn(async (content: unknown) => {
    if (MOCK_IPFS.shouldFail || Math.random() < MOCK_IPFS.failureRate) {
      throw new Error('Pinata upload failed')
    }

    await new Promise(r => setTimeout(r, MOCK_IPFS.networkDelay))

    const cid = `Qm${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
    MOCK_IPFS.cids.set(cid, content)
    MOCK_IPFS.uploads.push({ content, timestamp: Date.now() })
    MOCK_IPFS.pins.add(cid)

    return {
      IpfsHash: cid,
      PinSize: JSON.stringify(content).length,
      Timestamp: new Date().toISOString()
    }
  }),

  unpin: vi.fn(async (cid: string) => {
    MOCK_IPFS.pins.delete(cid)
    return { success: true }
  }),

  pinList: vi.fn(async () => {
    return {
      rows: Array.from(MOCK_IPFS.pins).map(cid => ({
        ipfs_pin_hash: cid,
        date_pinned: new Date().toISOString()
      }))
    }
  }),

  reset() {
    MOCK_IPFS.cids.clear()
    MOCK_IPFS.uploads.length = 0
    MOCK_IPFS.pins.clear()
    MOCK_IPFS.networkDelay = 0
    MOCK_IPFS.shouldFail = false
    MOCK_IPFS.failureRate = 0
    this.pinJSONToIPFS.mockClear()
    this.unpin.mockClear()
    this.pinList.mockClear()
  }
}

// Mock IPFS gateway fetch
export const mockIPFSFetch = vi.fn(async (cid: string) => {
  if (MOCK_IPFS.shouldFail) {
    throw new Error('IPFS fetch failed')
  }

  await new Promise(r => setTimeout(r, MOCK_IPFS.networkDelay))

  const content = MOCK_IPFS.cids.get(cid)
  if (!content) {
    throw new Error(`CID not found: ${cid}`)
  }

  return content
})

// Helper to set up IPFS mock conditions
export function configureIPFSMock(options: {
  delay?: number
  shouldFail?: boolean
  failureRate?: number
}) {
  MOCK_IPFS.networkDelay = options.delay ?? 0
  MOCK_IPFS.shouldFail = options.shouldFail ?? false
  MOCK_IPFS.failureRate = options.failureRate ?? 0
}
