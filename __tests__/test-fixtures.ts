/**
 * Test Fixtures and Mocks
 *
 * Centralized fixtures to avoid duplication and reduce test overhead
 */

import { describe, beforeEach, afterEach } from "bun:test"
import { setExecutor, resetExecutor } from "../src/shell"
import {
  getMockExecutorWithHistory,
  resetMockShell,
  clearCommandHistory,
  configureMockShell,
  getCommandHistory,
  type MockShellConfig,
} from "./shell.mock"

// ============================================================================
// MOCK CONTEXT FACTORY
// ============================================================================

export interface MockContext {
  readonly $: object
  readonly client: object
  readonly project: object
  readonly directory: string
  readonly worktree: string
}

export function createMockContext(): MockContext {
  return Object.freeze({
    $: {},
    client: {},
    project: { name: "test" },
    directory: "/tmp",
    worktree: "/tmp",
  })
}

// ============================================================================
// EVENT FIXTURES
// ============================================================================

export const eventFixtures = Object.freeze({
  permissionEvent: {
    type: "permission.updated" as const,
    properties: {
      type: "network",
      title: "Make HTTP Request",
      pattern: "api.example.com",
    },
  },

  permissionEventMinimal: {
    type: "permission.updated" as const,
    properties: {},
  },

  permissionEventWithArray: {
    type: "permission.updated" as const,
    properties: {
      type: "file",
      title: "Read File",
      pattern: ["*.json", "*.yaml"],
    },
  },

  permissionEventWithNull: {
    type: "permission.updated" as const,
    properties: null,
  },

  sessionIdleEvent: {
    type: "session.idle" as const,
    properties: {
      sessionID: "sess_abc123",
    },
  },

  sessionIdleEventMinimal: {
    type: "session.idle" as const,
    properties: {},
  },

  sessionIdleEventWithNull: {
    type: "session.idle" as const,
    properties: null,
  },

  sessionErrorEvent: {
    type: "session.error" as const,
    properties: {
      sessionID: "sess_xyz789",
      error: {
        name: "ProviderAuthError",
        data: {
          message: "Invalid API key",
        },
      },
    },
  },

  sessionErrorEventMinimal: {
    type: "session.error" as const,
    properties: {
      sessionID: "sess_xyz789",
    },
  },

  sessionErrorEventWithNull: {
    type: "session.error" as const,
    properties: null,
  },

  unknownEvent: {
    type: "unknown.event.type" as const,
    properties: {},
  },

  emptyTypeEvent: {
    type: "" as const,
    properties: {},
  },

  sessionCompleteEvent: {
    type: "session.complete" as const,
    properties: {
      sessionID: "sess_complete_123",
      info: {
        id: "sess_complete_123",
        title: "Code Review Task",
      },
    },
  },

  taskCompleteEvent: {
    type: "task.complete" as const,
    properties: {
      sessionID: "task_complete_456",
      info: {
        id: "task_complete_456",
        title: "API Development",
      },
    },
  },
})

// ============================================================================
// EDGE CASE EVENT FIXTURES
// ============================================================================

export const edgeCaseEventFixtures = Object.freeze({
  unicodeEvent: {
    type: "permission.updated" as const,
    properties: {
      type: "测试",
      title: "🔒 Test",
      pattern: "文件\\路径",
    },
  },

  longStringEvent: {
    type: "permission.updated" as const,
    properties: {
      type: "x".repeat(10000),
      title: "x".repeat(10000),
    },
  },

  specialCharEvent: {
    type: "permission.updated" as const,
    properties: {
      type: 'test"with"quotes',
      title: "test\\with\\backslashes",
      pattern: "test$with$dollar@signs!",
    },
  },

  deeplyNestedEvent: {
    type: "session.error" as const,
    properties: {
      sessionID: "sess_test",
      error: {
        name: "NestedError",
        data: {
          message: "Test",
          metadata: {
            nested: {
              deeply: {
                value: "deep",
              },
            },
          },
        },
      },
    },
  },

  mixedTypesEvent: {
    type: "permission.updated" as const,
    properties: {
      type: "test",
      title: null,
      pattern: 123 as any,
      extra: { nested: "value" },
    },
  },
})

// ============================================================================
// SDK-REALISTIC EVENT FIXTURES (matching actual OpenCode SDK types)
// ============================================================================

export const sdkRealisticFixtures = Object.freeze({
  /**
   * Real Permission event from OpenCode SDK
   * Matches: EventPermissionUpdated from @opencode-ai/sdk
   */
  permissionEventFromSDK: {
    type: "permission.updated" as const,
    properties: {
      id: "perm_123456",
      type: "network",
      title: "Make HTTP Request",
      pattern: "api.example.com",
      sessionID: "sess_abc123",
      messageID: "msg_def456",
      callID: "call_ghi789",
      metadata: {
        method: "POST",
        url: "https://api.example.com/v1/endpoint",
      },
      time: {
        created: Date.now(),
      },
    },
  },

  /**
   * Real error event from OpenCode SDK with ProviderAuthError structure
   */
  errorEventProviderAuth: {
    type: "session.error" as const,
    properties: {
      sessionID: "sess_xyz789",
      error: {
        name: "ProviderAuthError",
        message: "Invalid API key provided",
        code: "AUTH_FAILED",
        data: {
          provider: "anthropic",
          details: "API key expired",
        },
      },
    },
  },

  /**
   * Real error event with UnknownError structure
   */
  errorEventUnknown: {
    type: "session.error" as const,
    properties: {
      sessionID: "sess_unknown",
      error: {
        name: "UnknownError",
        message: "An unexpected error occurred",
      },
    },
  },

  /**
   * Real error event with ApiError structure (has data nested)
   */
  errorEventApi: {
    type: "session.error" as const,
    properties: {
      sessionID: "sess_api_error",
      error: {
        name: "ApiError",
        data: {
          message: "Rate limit exceeded",
          status: 429,
          retryAfter: 60,
        },
      },
    },
  },

  /**
   * Real session.updated event with full Session data
   */
  sessionUpdatedEvent: {
    type: "session.updated" as const,
    properties: {
      info: {
        id: "sess_complete",
        projectID: "proj_test",
        directory: "/home/lewis/project",
        title: "Refactor authentication module",
        version: "1.0.0",
        summary: {
          additions: 250,
          deletions: 120,
          files: 4,
        },
        time: {
          created: Date.now() - 300000,
          updated: Date.now(),
        },
      },
    },
  },

  /**
   * Real permission event with array pattern
   */
  permissionWithArrayPattern: {
    type: "permission.updated" as const,
    properties: {
      id: "perm_array",
      type: "file",
      title: "Read Configuration Files",
      pattern: ["*.json", "*.yaml", ".env"],
      sessionID: "sess_file",
      messageID: "msg_file",
      time: {
        created: Date.now(),
      },
    },
  },
})

// ============================================================================
// TEST SUITE HELPER
// ============================================================================

export function describeWithSetup(name: string, fn: (context: { createFixture: <T>(fixture: T) => T }) => void): void {
  describe(name, () => {
    beforeEach(() => {
      // Setup runs before each test
    })

    fn({
      createFixture: <T,>(fixture: T) => structuredClone(fixture),
    })
  })
}

// ============================================================================
// BATCH EVENT GENERATORS
// ============================================================================

export function generatePermissionEvents(count: number): typeof eventFixtures.permissionEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "permission.updated" as const,
    properties: {
      type: `permission_${i}`,
      title: `Permission ${i}`,
      pattern: `pattern_${i}`,
    },
  }))
}

export function generateSessionEvents(count: number): typeof eventFixtures.sessionIdleEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "session.idle" as const,
    properties: {
      sessionID: `sess_${i}`,
    },
  }))
}

export function generateErrorEvents(count: number): typeof eventFixtures.sessionErrorEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    type: "session.error" as const,
    properties: {
      sessionID: `sess_error_${i}`,
      error: {
        name: `Error${i}`,
        data: {
          message: `Error message ${i}`,
        },
      },
    },
  }))
}

// ============================================================================
// SHELL MOCKING UTILITIES
// ============================================================================

/**
 * Setup shell mocking for a test
 * Call this in beforeEach to enable deterministic shell testing
 */
export function setupShellMocking(config?: Partial<MockShellConfig>): void {
  setExecutor(getMockExecutorWithHistory())
  resetMockShell()
  if (config) {
    configureMockShell(config)
  }
}

/**
 * Cleanup shell mocking after a test
 * Call this in afterEach to restore original shell executor
 */
export function cleanupShellMocking(): void {
  resetExecutor()
  resetMockShell()
  clearCommandHistory()
}

/**
 * Describe block with shell mocking setup/teardown
 */
export function describeShellMocking(name: string, fn: (context: { getCommandHistory: typeof getCommandHistory }) => void): void {
  describe(name, () => {
    beforeEach(() => {
      setupShellMocking()
    })

    afterEach(() => {
      cleanupShellMocking()
    })

    fn({
      getCommandHistory,
    })
  })
}

/**
 * Get shell command history from current test
 */
export function getShellCommandHistory(): typeof getCommandHistory extends () => infer T ? T : never {
  return getCommandHistory()
}

/**
 * Helper to assert a command was executed
 */
export function assertCommandExecuted(commandName: string): boolean {
  const history = getCommandHistory()
  return history.some((entry) => entry.command[0]?.includes(commandName))
}
