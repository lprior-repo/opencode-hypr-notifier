/**
 * Tests for OpenCode Hyprland Notifier Plugin
 *
 * Tests the self-contained single-file plugin
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test"
import { HyprNotifierPlugin } from "../src/hypr-notifier"

// ============================================================================
// MOCK CONTEXT
// ============================================================================

interface MockContext {
  readonly $: object
  readonly client: object
  readonly project: object
  readonly directory: string
  readonly worktree: string
}

function createMockContext(): MockContext {
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

const eventFixtures = {
  permissionEvent: {
    type: "permission.updated" as const,
    properties: {
      type: "network",
      title: "Make HTTP Request",
      pattern: "api.example.com",
      sessionID: "sess_abc123",
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
      taskID: "task_complete_456",
      title: "API Development",
      description: "Implemented new API endpoints",
      sessionID: "sess_abc123",
    },
  },

  taskCompleteEventWithId: {
    type: "task.complete" as const,
    properties: {
      id: "task_id_789",
      title: "Bug Fix",
    },
  },

  taskCompleteEventMinimal: {
    type: "task.complete" as const,
    properties: {},
  },

  unknownEvent: {
    type: "unknown.event.type" as const,
    properties: { title: "Unknown Event" },
  },
}

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

describe("HyprNotifierPlugin", () => {
  describe("initialization", () => {
    it("should export HyprNotifierPlugin function", () => {
      expect(typeof HyprNotifierPlugin).toBe("function")
    })

    it("should return hooks with event handler", async () => {
      const ctx = createMockContext()
      const result = await HyprNotifierPlugin(ctx as any)

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
    hookFunction = await HyprNotifierPlugin(ctx as any)
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
})



// ============================================================================
// SESSION COMPLETE EVENTS
// ============================================================================

describe("Session Complete Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprNotifierPlugin(ctx as any)
  })

  it("should handle session.complete event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.sessionCompleteEvent })).resolves.toBeUndefined()
  })
})

// ============================================================================
// TASK COMPLETE EVENTS
// ============================================================================

describe("Task Complete Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprNotifierPlugin(ctx as any)
  })

  it("should handle task.complete with taskID, title, description, sessionID", async () => {
    await expect(hookFunction.event({ event: eventFixtures.taskCompleteEvent })).resolves.toBeUndefined()
  })

  it("should handle task.complete with id instead of taskID", async () => {
    await expect(hookFunction.event({ event: eventFixtures.taskCompleteEventWithId })).resolves.toBeUndefined()
  })

  it("should handle minimal task.complete event", async () => {
    await expect(hookFunction.event({ event: eventFixtures.taskCompleteEventMinimal })).resolves.toBeUndefined()
  })
})

// ============================================================================
// UNKNOWN EVENTS
// ============================================================================

describe("Unknown Events", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprNotifierPlugin(ctx as any)
  })

  it("should ignore unknown event types gracefully", async () => {
    await expect(hookFunction.event({ event: eventFixtures.unknownEvent })).resolves.toBeUndefined()
  })
})

// ============================================================================
// ERROR RESILIENCE
// ============================================================================

describe("Error Resilience", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprNotifierPlugin(ctx as any)
  })

  it("should handle invalid event structure", async () => {
    const invalidEvent = {
      type: "permission.updated",
      properties: "not an object",
    } as any

    await expect(hookFunction.event({ event: invalidEvent })).resolves.toBeUndefined()
  })

  it("should recover from any event processing error", async () => {
    const events = [
      eventFixtures.permissionEvent,
      eventFixtures.sessionCompleteEvent,
      eventFixtures.taskCompleteEvent,
    ]

    await Promise.all(events.map((event) => hookFunction.event({ event })))
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Edge Cases", () => {
  let hookFunction: { event: (input: { event: any }) => Promise<void> }

  beforeEach(async () => {
    const ctx = createMockContext()
    hookFunction = await HyprNotifierPlugin(ctx as any)
  })

  it("should handle unicode in event properties", async () => {
    const unicodeEvent = {
      type: "permission.updated" as const,
      properties: {
        type: "测试",
        title: "🔒 Test",
        pattern: "文件\\路径",
      },
    }

    await expect(hookFunction.event({ event: unicodeEvent })).resolves.toBeUndefined()
  })

  it("should handle very long strings", async () => {
    const longEvent = {
      type: "permission.updated" as const,
      properties: {
        type: "x".repeat(10000),
        title: "y".repeat(10000),
      },
    }

    await expect(hookFunction.event({ event: longEvent })).resolves.toBeUndefined()
  })

  it("should handle special characters", async () => {
    const specialEvent = {
      type: "permission.updated" as const,
      properties: {
        type: 'test"with"quotes',
        title: "test\\with\\backslashes",
        pattern: "test$with$dollar@signs!",
      },
    }

    await expect(hookFunction.event({ event: specialEvent })).resolves.toBeUndefined()
  })

  it("should handle rapid successive events", async () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      type: "session.idle" as const,
      properties: { sessionID: `sess_${i}` },
    }))

    await Promise.all(events.map((event) => hookFunction.event({ event })))
  })

  it("should handle mixed event types in rapid succession", async () => {
    const events = [
      { type: "permission.updated" as const, properties: { type: "network" } },
      { type: "session.complete" as const, properties: { sessionID: "sess_3" } },
      { type: "task.complete" as const, properties: { taskID: "task_1", title: "Test Task" } },
    ]

    await Promise.all(events.map((event) => hookFunction.event({ event })))
  })
})
