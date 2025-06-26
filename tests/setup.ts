/**
 * Test Setup and Configuration
 * 
 * Global setup for Vitest testing environment
 * AIDEV-NOTE: Test environment setup for absurd-sql migration testing
 */

import { vi } from 'vitest'

// Mock Web APIs that might not be available in test environment
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: vi.fn((arr: Uint8Array) => {
      // Simple mock for crypto.getRandomValues
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
    subtle: {
      importKey: vi.fn(),
      exportKey: vi.fn(),
      deriveKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      digest: vi.fn()
    }
  },
  configurable: true,
  writable: true
})

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
    subtle: {
      importKey: vi.fn(),
      exportKey: vi.fn(),
      deriveKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      digest: vi.fn()
    }
  },
  configurable: true,
  writable: true
})

// Mock performance APIs
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn()
  }
})

// Mock navigator APIs
Object.defineProperty(window, 'navigator', {
  value: {
    hardwareConcurrency: 4,
    onLine: true,
    getBattery: vi.fn(() => Promise.resolve({
      level: 1.0,
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity
    })),
    wakeLock: {
      request: vi.fn(() => Promise.resolve({
        released: false,
        type: 'screen',
        release: vi.fn()
      }))
    }
  }
})

// Mock Worker constructor
global.Worker = vi.fn().mockImplementation((scriptURL: string) => ({
  postMessage: vi.fn(),
  terminate: vi.fn(),
  onmessage: null,
  onerror: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn()
}))

// Mock SharedArrayBuffer for testing
global.SharedArrayBuffer = ArrayBuffer

// Mock File API
Object.defineProperty(window, 'File', {
  value: vi.fn().mockImplementation((bits: any[], name: string, options: any) => ({
    name,
    size: bits.reduce((acc, bit) => acc + (bit.length || bit.size || 0), 0),
    type: options?.type || '',
    lastModified: Date.now(),
    arrayBuffer: vi.fn(() => Promise.resolve(new ArrayBuffer(0))),
    text: vi.fn(() => Promise.resolve('')),
    stream: vi.fn()
  }))
})

// Mock FileReader
Object.defineProperty(window, 'FileReader', {
  value: vi.fn().mockImplementation(() => ({
    readAsArrayBuffer: vi.fn(),
    readAsText: vi.fn(),
    result: null,
    error: null,
    onload: null,
    onerror: null,
    onprogress: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
})

// Mock IndexedDB for testing
const mockIDB = {
  open: vi.fn(() => Promise.resolve({
    result: {
      createObjectStore: vi.fn(),
      deleteObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          add: vi.fn(() => Promise.resolve()),
          put: vi.fn(() => Promise.resolve()),
          get: vi.fn(() => Promise.resolve()),
          delete: vi.fn(() => Promise.resolve()),
          clear: vi.fn(() => Promise.resolve()),
          getAll: vi.fn(() => Promise.resolve([])),
          createIndex: vi.fn(),
          index: vi.fn()
        }))
      }))
    }
  })),
  deleteDatabase: vi.fn(() => Promise.resolve())
}

Object.defineProperty(window, 'indexedDB', { value: mockIDB })

// Mock fetch for cold storage testing
global.fetch = vi.fn()

// Mock URL.createObjectURL and revokeObjectURL
Object.defineProperty(window.URL, 'createObjectURL', {
  value: vi.fn(() => 'blob:mock-url')
})

Object.defineProperty(window.URL, 'revokeObjectURL', {
  value: vi.fn()
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock localStorage and sessionStorage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0
}

Object.defineProperty(window, 'localStorage', { value: mockStorage })
Object.defineProperty(window, 'sessionStorage', { value: mockStorage })

// Console suppression for cleaner test output
const originalConsole = global.console
global.console = {
  ...originalConsole,
  // Suppress debug/info during tests unless needed
  debug: vi.fn(),
  info: process.env.VITEST_VERBOSE ? originalConsole.info : vi.fn(),
  // Keep errors and warnings visible
  error: originalConsole.error,
  warn: originalConsole.warn,
  log: process.env.VITEST_VERBOSE ? originalConsole.log : vi.fn()
}

// Test timeout configuration
vi.setConfig({
  testTimeout: 10000, // 10 seconds for complex operations
  hookTimeout: 5000   // 5 seconds for setup/teardown
})

export {}