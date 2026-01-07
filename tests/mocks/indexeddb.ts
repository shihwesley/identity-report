import 'fake-indexeddb/auto'
import { vi } from 'vitest'

// Re-export fake-indexeddb for explicit usage
export { indexedDB, IDBKeyRange } from 'fake-indexeddb'

// Helper to create a fresh database for each test
export function createTestDatabase(name: string = 'test-identity-vault') {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object stores matching the app's schema
      if (!db.objectStoreNames.contains('vault')) {
        db.createObjectStore('vault', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' })
        convStore.createIndex('timestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('memories')) {
        const memStore = db.createObjectStore('memories', { keyPath: 'id' })
        memStore.createIndex('type', 'type')
        memStore.createIndex('timestamp', 'timestamp')
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

// Helper to clear all test databases
export async function clearTestDatabases() {
  const databases = await indexedDB.databases()
  for (const db of databases) {
    if (db.name?.startsWith('test-')) {
      indexedDB.deleteDatabase(db.name)
    }
  }
}

// Mock storage interface for testing
export const mockStorage = {
  data: new Map<string, unknown>(),

  get: vi.fn((key: string) => mockStorage.data.get(key)),
  set: vi.fn((key: string, value: unknown) => {
    mockStorage.data.set(key, value)
  }),
  delete: vi.fn((key: string) => mockStorage.data.delete(key)),
  clear: vi.fn(() => mockStorage.data.clear()),

  reset() {
    this.data.clear()
    this.get.mockClear()
    this.set.mockClear()
    this.delete.mockClear()
    this.clear.mockClear()
  }
}
