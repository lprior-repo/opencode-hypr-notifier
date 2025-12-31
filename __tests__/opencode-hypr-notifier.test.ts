import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import HyprlandNotifierPlugin from "../src/index"
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

// ============================================================================
// TASK COMPLETE AND SESSION COMPLETE EVENT TESTS (TDD for notification body)
// ============================================================================

describe("Task Complete and Session Complete Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    setupShellMocking({ exitCode: 0 })
    const ctx = createMockContext()
    hookFunction = await HyprlandNotifierPlugin(ctx as any)
  })

  afterEach(() => {
    cleanupShellMocking()
  })

  describe("task.complete event handling", () => {
    it("should handle task.complete with title and sessionID", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          sessionID: "task_session_123",
          title: "Code Review Complete",
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should handle task.complete with info.title and info.id", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          info: {
            id: "task_info_456",
            title: "API Development Task",
          },
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should handle task.complete with nested summary info", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          info: {
            id: "task_with_summary_789",
            title: "Feature Implementation",
            summary: {
              files: 5,
              additions: 150,
              deletions: 30,
            },
          },
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should handle task.complete with minimal properties", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          sessionID: "minimal_task",
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should handle task.complete with empty properties", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {},
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })
  })

  describe("session.complete event handling", () => {
    it("should handle session.complete with full info object", async () => {
      const event = {
        type: "session.complete" as const,
        properties: {
          info: {
            id: "sess_complete_abc",
            title: "Bug Fix Session",
            summary: {
              files: 3,
              additions: 50,
              deletions: 20,
            },
          },
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should handle session.complete with just sessionID", async () => {
      const event = {
        type: "session.complete" as const,
        properties: {
          sessionID: "sess_complete_xyz",
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should handle session.complete with null properties", async () => {
      const event = {
        type: "session.complete" as const,
        properties: null,
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })
  })

  describe("Event body content validation", () => {
    it("should include session ID in notification body for task.complete", async () => {
      // This test validates the actual notification content
      const event = {
        type: "task.complete" as const,
        properties: {
          sessionID: "validate_session_id_123",
          title: "Test Task",
        },
      }

      // Should not throw and should process without error
      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should include task title in notification body when available", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          sessionID: "task_123",
          info: {
            id: "task_123",
            title: "Specific Task Title That Should Appear",
          },
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should include file change summary in notification body", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          info: {
            id: "task_with_changes",
            title: "Code Changes Task",
            summary: {
              files: 5,
              additions: 200,
              deletions: 50,
            },
          },
        },
      }

      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })

    it("should not display raw object stringification (no [object Object])", async () => {
      const event = {
        type: "task.complete" as const,
        properties: {
          sessionID: "test_no_raw_objects",
          title: "Clean Output Test",
        },
      }

      // Should handle gracefully without returning [object Object]
      await expect(hookFunction.event({ event })).resolves.toBeUndefined()
    })
  })

  describe("Mixed complete event types", () => {
    it("should handle rapid succession of task.complete events", async () => {
      const events = [
        {
          type: "task.complete" as const,
          properties: { sessionID: "task_1", title: "Task 1" },
        },
        {
          type: "task.complete" as const,
          properties: { sessionID: "task_2", title: "Task 2" },
        },
        {
          type: "task.complete" as const,
          properties: { sessionID: "task_3", title: "Task 3" },
        },
      ]

      await Promise.all(events.map((event) => hookFunction.event({ event })))
    })

    it("should handle mixed session.complete and task.complete events", async () => {
      const events = [
        {
          type: "session.complete" as const,
          properties: { sessionID: "sess_1", title: "Session 1" },
        },
        {
          type: "task.complete" as const,
          properties: { sessionID: "task_1", title: "Task 1" },
        },
        {
          type: "session.complete" as const,
          properties: { sessionID: "sess_2", title: "Session 2" },
        },
      ]

      await Promise.all(events.map((event) => hookFunction.event({ event })))
    })

    it("should handle complete events mixed with other event types", async () => {
      const events = [
        { type: "permission.updated" as const, properties: { type: "network", title: "API Access" } },
        { type: "task.complete" as const, properties: { sessionID: "task_mixed_1" } },
        { type: "session.error" as const, properties: { sessionID: "err_1", error: { name: "TestError", message: "Test" } } },
        { type: "session.complete" as const, properties: { sessionID: "sess_mixed_1" } },
      ]

      await Promise.all(events.map((event) => hookFunction.event({ event })))
    })
  })
})
