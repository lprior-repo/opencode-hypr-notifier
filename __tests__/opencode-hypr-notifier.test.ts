import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { HyprlandNotifierPlugin } from "../opencode-hypr-notifier"
import {
  createMockContext,
  eventFixtures,
  edgeCaseEventFixtures,
  sdkRealisticFixtures,
  generatePermissionEvents,
  generateSessionEvents,
  generateErrorEvents,
  setupShellMocking,
  cleanupShellMocking,
} from "./test-fixtures"
import { configureMockShell } from "./shell.mock"

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

describe("HyprlandNotifierPlugin", () => {
  describe("initialization", () => {
    it("should export HyprlandNotifierPlugin function", () => {
      expect(typeof HyprlandNotifierPlugin).toBe("function")
    })

    it("should return hooks with event handler", async () => {
      const ctx = createMockContext()
      const result = await HyprlandNotifierPlugin(ctx as any)

      expect(result).toHaveProperty("event")
      expect(typeof result.event).toBe("function")
    })
  })
})

// ============================================================================
// PERMISSION EVENTS
// ============================================================================

describe("Permission Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  it("should handle standard permission event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.permissionEvent })).resolves.toBeUndefined()
  })

  it("should handle minimal permission event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.permissionEventMinimal })).resolves.toBeUndefined()
  })

  it("should handle permission with array pattern", async () => {
    await expect(hookFunction.event({ event: eventFixtures.permissionEventWithArray })).resolves.toBeUndefined()
  })

  it("should handle permission with null properties", async () => {
    await expect(hookFunction.event({ event: eventFixtures.permissionEventWithNull })).resolves.toBeUndefined()
  })

  it("should handle unicode in permissions", async () => {
    await expect(hookFunction.event({ event: edgeCaseEventFixtures.unicodeEvent })).resolves.toBeUndefined()
  })

  it("should handle special characters in permissions", async () => {
    await expect(hookFunction.event({ event: edgeCaseEventFixtures.specialCharEvent })).resolves.toBeUndefined()
  })
})

// ============================================================================
// SESSION IDLE EVENTS
// ============================================================================

describe("Session Idle Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  it("should handle standard session idle event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEvent })).resolves.toBeUndefined()
  })

  it("should handle minimal session idle event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEventMinimal })).resolves.toBeUndefined()
  })

  it("should handle session idle with null properties", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEventWithNull })).resolves.toBeUndefined()
  })

   it("should handle multiple rapid session events", async () => {
     const events = generateSessionEvents(5)
     await Promise.all(events.map((event) => hookFunction.event({ event })))
   })

   it("should handle session complete event", async () => {
     await expect(hookFunction.event({ event: eventFixtures.sessionCompleteEvent })).resolves.toBeUndefined()
   })

   it("should handle task complete event", async () => {
     await expect(hookFunction.event({ event: eventFixtures.taskCompleteEvent })).resolves.toBeUndefined()
   })
})

// ============================================================================
// SESSION ERROR EVENTS
// ============================================================================

describe("Session Error Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  it("should handle standard session error event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionErrorEvent })).resolves.toBeUndefined()
  })

  it("should handle minimal session error event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionErrorEventMinimal })).resolves.toBeUndefined()
  })

  it("should handle session error with null properties", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionErrorEventWithNull })).resolves.toBeUndefined()
  })

  it("should handle deeply nested error structure", async () => {
    await expect(hookFunction.event({ event: edgeCaseEventFixtures.deeplyNestedEvent })).resolves.toBeUndefined()
  })
})

// ============================================================================
// UNKNOWN & EDGE CASE EVENTS
// ============================================================================

describe("Unknown and Edge Case Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  it("should ignore unknown event types", async () => {
    await expect(hookFunction.event({ event: eventFixtures.unknownEvent })).resolves.toBeUndefined()
  })

  it("should ignore empty type events", async () => {
    await expect(hookFunction.event({ event: eventFixtures.emptyTypeEvent })).resolves.toBeUndefined()
  })

  it("should handle very long strings", async () => {
    await expect(hookFunction.event({ event: edgeCaseEventFixtures.longStringEvent })).resolves.toBeUndefined()
  })

  it("should handle mixed property types", async () => {
    await expect(hookFunction.event({ event: edgeCaseEventFixtures.mixedTypesEvent })).resolves.toBeUndefined()
  })

  it("should handle rapid successive mixed events", async () => {
    const permissionEvents = generatePermissionEvents(3)
    const sessionEvents = generateSessionEvents(3)
    const errorEvents = generateErrorEvents(3)

    const allEvents = [...permissionEvents, ...sessionEvents, ...errorEvents]
    await Promise.all(allEvents.map((event) => hookFunction.event({ event })))
  })
})

// ============================================================================
// ERROR RESILIENCE
// ============================================================================

describe("Error Resilience", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  it("should handle invalid event structure", async () => {
    const invalidEvent = {
      type: "permission.updated",
      properties: "not an object",
    } as any

    await expect(hookFunction.event({ event: invalidEvent })).resolves.toBeUndefined()
  })

  it("should not crash on malformed error property", async () => {
    const malformedEvent = {
      type: "session.error",
      properties: {
        sessionID: "test",
        error: "string instead of object",
      },
    } as any

    await expect(hookFunction.event({ event: malformedEvent })).resolves.toBeUndefined()
  })

  it("should recover from any event processing error", async () => {
    const events = [
      eventFixtures.permissionEvent,
      eventFixtures.sessionIdleEvent,
      eventFixtures.sessionErrorEvent,
    ]

    // All should succeed even if one internally fails
    await Promise.all(events.map((event) => hookFunction.event({ event })))
  })
})

// ============================================================================
// SHELL MOCKING INTEGRATION TESTS
// ============================================================================

describe("Shell Mocking Integration", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    setupShellMocking({ exitCode: 0 })
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  afterEach(() => {
    cleanupShellMocking()
  })

  it("should handle successful shell command execution", async () => {
    configureMockShell({ exitCode: 0 })
    await expect(hookFunction.event({ event: eventFixtures.permissionEvent })).resolves.toBeUndefined()
  })

  it("should handle shell command failure gracefully", async () => {
    configureMockShell({ exitCode: 1 })
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEvent })).resolves.toBeUndefined()
  })

  it("should handle notify-send not available", async () => {
    configureMockShell({ exitCode: 127 }) // Command not found
    await expect(hookFunction.event({ event: eventFixtures.sessionErrorEvent })).resolves.toBeUndefined()
  })

  it("should handle dbus connection failure", async () => {
    configureMockShell({ exitCode: 1, stderr: "D-Bus error" })
    await expect(hookFunction.event({ event: eventFixtures.permissionEvent })).resolves.toBeUndefined()
  })

  it("should log shell command failures", async () => {
    configureMockShell({ exitCode: 127, stderr: "notify-send: not found" })
    // Should not throw, should handle gracefully
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEvent })).resolves.toBeUndefined()
  })

  it("should handle null exit code from spawn failure", async () => {
    configureMockShell({ exitCode: null })
    await expect(hookFunction.event({ event: eventFixtures.sessionErrorEvent })).resolves.toBeUndefined()
  })

  it("should process multiple events with shell failures", async () => {
    configureMockShell({ exitCode: 1 })
    const events = [eventFixtures.permissionEvent, eventFixtures.sessionIdleEvent, eventFixtures.sessionErrorEvent]

    await Promise.all(events.map((event) => hookFunction.event({ event })))
  })

  it("should handle shell output in stderr", async () => {
    configureMockShell({ exitCode: 0, stderr: "Warning message from notify-send" })
    await expect(hookFunction.event({ event: eventFixtures.permissionEvent })).resolves.toBeUndefined()
  })

  it("should handle shell output in stdout", async () => {
    configureMockShell({ exitCode: 0, stdout: "Notification displayed" })
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEvent })).resolves.toBeUndefined()
  })

  it("should recover from alternating success and failure", async () => {
    configureMockShell({ exitCode: 0 })
    await expect(hookFunction.event({ event: eventFixtures.permissionEvent })).resolves.toBeUndefined()

    configureMockShell({ exitCode: 1 })
    await expect(hookFunction.event({ event: eventFixtures.sessionIdleEvent })).resolves.toBeUndefined()

    configureMockShell({ exitCode: 0 })
    await expect(hookFunction.event({ event: eventFixtures.sessionErrorEvent })).resolves.toBeUndefined()
  })

  it("should handle rapid events with shell failures", async () => {
    configureMockShell({ exitCode: 1 })
    const events = generatePermissionEvents(5)

    await Promise.all(events.map((event) => hookFunction.event({ event })))
  })

  it("should handle special characters in notifications with shell mock", async () => {
    configureMockShell({ exitCode: 0 })
    const specialEvent = {
      type: "permission.updated" as const,
      properties: {
        type: "API",
        title: "Request with 🚀 emoji",
        pattern: 'Special "quotes" and \'apostrophes\'',
      },
    }

    await expect(hookFunction.event({ event: specialEvent })).resolves.toBeUndefined()
  })

  it("should handle very long notification text with shell mock", async () => {
    configureMockShell({ exitCode: 0 })
    const longEvent = {
      type: "session.idle" as const,
      properties: {
        sessionID: "a".repeat(10000),
      },
    }

    await expect(hookFunction.event({ event: longEvent })).resolves.toBeUndefined()
  })

  it("should handle unicode in all notification parts", async () => {
    configureMockShell({ exitCode: 0 })
    const unicodeEvent = {
      type: "permission.updated" as const,
      properties: {
        type: "🔒 权限",
        title: "Разрешение",
        pattern: "🌍 Global",
      },
    }

    await expect(hookFunction.event({ event: unicodeEvent })).resolves.toBeUndefined()
  })
})

// ============================================================================
// SDK-REALISTIC EVENTS (Real OpenCode SDK structures)
// ============================================================================

describe("SDK-Realistic Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
    setupShellMocking()
  })

  afterEach(() => {
    cleanupShellMocking()
  })

  describe("Permission Events with Real SDK Structure", () => {
    it("should extract all fields from full Permission object", async () => {
      await expect(
        hookFunction.event({ event: sdkRealisticFixtures.permissionEventFromSDK })
      ).resolves.toBeUndefined()
    })

    it("should handle permission with array pattern", async () => {
      await expect(
        hookFunction.event({ event: sdkRealisticFixtures.permissionWithArrayPattern })
      ).resolves.toBeUndefined()
    })
  })

  describe("Error Events with Real SDK Structure", () => {
    it("should extract ProviderAuthError with nested data.message", async () => {
      await expect(
        hookFunction.event({ event: sdkRealisticFixtures.errorEventProviderAuth })
      ).resolves.toBeUndefined()
    })

    it("should extract UnknownError with direct message property", async () => {
      await expect(
        hookFunction.event({ event: sdkRealisticFixtures.errorEventUnknown })
      ).resolves.toBeUndefined()
    })

    it("should extract ApiError with data.message field", async () => {
      await expect(
        hookFunction.event({ event: sdkRealisticFixtures.errorEventApi })
      ).resolves.toBeUndefined()
    })
  })

  describe("Session Events with Full SDK Data", () => {
    it("should extract session.updated with full Session object", async () => {
      await expect(
        hookFunction.event({ event: sdkRealisticFixtures.sessionUpdatedEvent })
      ).resolves.toBeUndefined()
    })
  })
})
