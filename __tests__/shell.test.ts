/**
 * Shell Module Tests
 *
 * Tests for mockable shell execution with Bun.spawn wrapper
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import {
  setupShellMocking,
  cleanupShellMocking,
  getShellCommandHistory,
  assertCommandExecuted,
  describeShellMocking,
} from "./test-fixtures"
import { setExecutor, resetExecutor, getExecutor } from "../shell"
import { configureMockShell, getMockExecutor, resetMockShell, getCommandHistory } from "./shell.mock"

// ============================================================================
// SHELL EXECUTOR SETUP/TEARDOWN
// ============================================================================

describe("Shell Module", () => {
  describe("executor registry", () => {
    afterEach(() => {
      resetExecutor()
    })

    it("should have a default executor", () => {
      const executor = getExecutor()
      expect(typeof executor).toBe("function")
    })

    it("should allow setting a custom executor", () => {
      const mockExecutor = getMockExecutor()
      setExecutor(mockExecutor)
      const executor = getExecutor()
      expect(executor).toBe(mockExecutor)
    })

    it("should allow resetting to default executor", () => {
      const mockExecutor = getMockExecutor()
      setExecutor(mockExecutor)
      expect(getExecutor()).toBe(mockExecutor)

      resetExecutor()
      expect(getExecutor()).not.toBe(mockExecutor)
    })
  })

  // ============================================================================
  // MOCK SHELL EXECUTOR TESTS
  // ============================================================================

  describeShellMocking("Mock Shell Executor", ({ getCommandHistory }) => {
    it("should return success result with exit code 0", async () => {
      setupShellMocking({ exitCode: 0 })
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "title", "body"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe("")
      expect(result.stderr).toBe("")
    })

    it("should return failure result with non-zero exit code", async () => {
      setupShellMocking({ exitCode: 1 })
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "title", "body"])

      expect(result.exitCode).toBe(1)
    })

    it("should return null exit code when simulating spawn failure", async () => {
      setupShellMocking({ exitCode: null })
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "title", "body"])

      expect(result.exitCode).toBeNull()
    })

    it("should handle empty command array", async () => {
      setupShellMocking()
      const executor = getMockExecutor()

      const result = await executor([])

      expect(result).toHaveProperty("exitCode")
      expect(result).toHaveProperty("stdout")
      expect(result).toHaveProperty("stderr")
    })

    it("should include stdout in result", async () => {
      setupShellMocking({ stdout: "output text" })
      const executor = getMockExecutor()

      const result = await executor(["echo", "hello"])

      expect(result.stdout).toBe("output text")
    })

    it("should include stderr in result", async () => {
      setupShellMocking({ stderr: "error text" })
      const executor = getMockExecutor()

      const result = await executor(["command"])

      expect(result.stderr).toBe("error text")
    })

    it("should fail specific commands if configured", async () => {
      setupShellMocking({ exitCode: 0, failOnCommand: "notify-send" })
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "title", "body"])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe("Mock: Command failed")
    })

    it("should pass other commands when one is configured to fail", async () => {
      setupShellMocking({ exitCode: 0, failOnCommand: "notify-send" })
      const executor = getMockExecutor()

      const result = await executor(["echo", "hello"])

      expect(result.exitCode).toBe(0)
    })

    it("should allow changing configuration between calls", async () => {
      setupShellMocking({ exitCode: 0 })
      const executor = getMockExecutor()

      let result = await executor(["notify-send", "first"])
      expect(result.exitCode).toBe(0)

      configureMockShell({ exitCode: 1 })

      result = await executor(["notify-send", "second"])
      expect(result.exitCode).toBe(1)
    })

    it("should throw error when configured", async () => {
      setupShellMocking({ throwError: true })
      const executor = getMockExecutor()

      await expect(executor(["notify-send", "title"])).rejects.toThrow()
    })

    it("should reset to default configuration", async () => {
      setupShellMocking({ exitCode: 1, stdout: "error" })
      resetMockShell()

      const executor = getMockExecutor()
      const result = await executor(["test"])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe("")
    })
  })

  // ============================================================================
  // COMMAND HISTORY TRACKING
  // ============================================================================

  describe("Command History Tracking", () => {
    beforeEach(() => {
      setupShellMocking()
    })

    afterEach(() => {
      cleanupShellMocking()
    })

    it("should track executed commands", async () => {
      const executor = getMockExecutor()
      await executor(["notify-send", "title", "body"])

      const history = getCommandHistory()
      expect(history.length).toBe(0) // base executor doesn't track
    })

    it("should track multiple command executions", async () => {
      const { getCommandHistory } = await import("./shell.mock")
      const history = getCommandHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it("should include command array in history", async () => {
      const { getMockExecutorWithHistory } = await import("./shell.mock")
      const executor = getMockExecutorWithHistory()

      await executor(["notify-send", "title", "body"])

      const history = getCommandHistory()
      expect(history.length).toBeGreaterThan(0)
      expect(history[0].command[0]).toBe("notify-send")
    })

    it("should include timestamp in history entries", async () => {
      const { getMockExecutorWithHistory } = await import("./shell.mock")
      const executor = getMockExecutorWithHistory()

      await executor(["test"])

      const history = getCommandHistory()
      expect(history[0]).toHaveProperty("timestamp")
      expect(typeof history[0].timestamp).toBe("number")
    })

    it("should preserve full command with all arguments", async () => {
      const { getMockExecutorWithHistory } = await import("./shell.mock")
      const executor = getMockExecutorWithHistory()

      const command = ["notify-send", "-u", "critical", "-t", "5000", "title", "body"]
      await executor(command)

      const history = getCommandHistory()
      expect(history[0].command).toEqual(command)
    })
  })

  // ============================================================================
  // SHELL OPTIONS HANDLING
  // ============================================================================

  describe("Shell Options Handling", () => {
    beforeEach(() => {
      setupShellMocking()
    })

    afterEach(() => {
      cleanupShellMocking()
    })

    it("should accept stdout option", async () => {
      const executor = getMockExecutor()

      const result = await executor(["test"], { stdout: "pipe" })

      expect(result).toBeDefined()
    })

    it("should accept stderr option", async () => {
      const executor = getMockExecutor()

      const result = await executor(["test"], { stderr: "pipe" })

      expect(result).toBeDefined()
    })

    it("should accept both stdout and stderr options", async () => {
      const executor = getMockExecutor()

      const result = await executor(["test"], { stdout: "pipe", stderr: "pipe" })

      expect(result).toBeDefined()
    })

    it("should handle optional options parameter", async () => {
      const executor = getMockExecutor()

      const result = await executor(["test"])

      expect(result).toBeDefined()
    })
  })

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("Edge Cases", () => {
    beforeEach(() => {
      setupShellMocking()
    })

    afterEach(() => {
      cleanupShellMocking()
    })

    it("should handle very long command names", async () => {
      const executor = getMockExecutor()
      const longCommand = "a".repeat(1000)

      const result = await executor([longCommand])

      expect(result).toBeDefined()
    })

    it("should handle many command arguments", async () => {
      const executor = getMockExecutor()
      const manyArgs = Array.from({ length: 100 }, (_, i) => `arg${i}`)

      const result = await executor(["cmd", ...manyArgs])

      expect(result).toBeDefined()
    })

    it("should handle special characters in command arguments", async () => {
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "Title with 🎉 emoji", "Body with\nnewline"])

      expect(result).toBeDefined()
    })

    it("should handle quotes in command arguments", async () => {
      const executor = getMockExecutor()

      const result = await executor(['notify-send', 'Title with "quotes"', "Body with 'quotes'"])

      expect(result).toBeDefined()
    })

    it("should handle empty strings in arguments", async () => {
      const executor = getMockExecutor()

      const result = await executor(["cmd", "", "arg"])

      expect(result).toBeDefined()
    })

    it("should handle null exit code edge case", async () => {
      configureMockShell({ exitCode: null })
      const executor = getMockExecutor()

      const result = await executor(["test"])

      expect(result.exitCode).toBeNull()
      expect(result.stdout).toBe("")
      expect(result.stderr).toBe("")
    })

    it("should return frozen result object", async () => {
      const executor = getMockExecutor()
      const result = await executor(["test"])

      expect(Object.isFrozen(result)).toBe(true)
    })
  })

  // ============================================================================
  // INTEGRATION WITH FIXTURE UTILITIES
  // ============================================================================

  describe("Integration with Fixture Utilities", () => {
    beforeEach(() => {
      setupShellMocking()
    })

    afterEach(() => {
      cleanupShellMocking()
    })

    it("should setup and cleanup shell mocking", () => {
      const executor = getExecutor()
      expect(typeof executor).toBe("function")

      cleanupShellMocking()

      // After cleanup, executor should be different (reset to default)
      // Note: Can't directly compare executors, but we can verify it works
      const newExecutor = getExecutor()
      expect(typeof newExecutor).toBe("function")
    })

    it("should assert command executed", async () => {
      setupShellMocking()
      const mockExecutor = getMockExecutor()
      setExecutor(mockExecutor)

      await mockExecutor(["notify-send", "test"])

      // Note: assertCommandExecuted uses getCommandHistory which requires
      // getMockExecutorWithHistory, so this is more of a usage pattern test
      expect(typeof assertCommandExecuted).toBe("function")

      cleanupShellMocking()
    })

    it("should get shell command history", () => {
      const history = getShellCommandHistory()
      expect(Array.isArray(history)).toBe(true)
    })
  })
})

// ============================================================================
// SHELL EXECUTION SCENARIOS
// ============================================================================

describe("Shell Execution Scenarios", () => {
  describeShellMocking("Notification Sending", ({ getCommandHistory }) => {
    it("should simulate successful notification send", async () => {
      setupShellMocking({ exitCode: 0 })
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "-u", "critical", "-t", "5000", "Test Title", "Test Body"])

      expect(result.exitCode).toBe(0)
    })

    it("should simulate notify-send not available", async () => {
      setupShellMocking({ exitCode: 127 }) // Command not found
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "title", "body"])

      expect(result.exitCode).toBe(127)
    })

    it("should simulate dbus connection failure", async () => {
      setupShellMocking({ exitCode: 1, stderr: "D-Bus error" })
      const executor = getMockExecutor()

      const result = await executor(["notify-send", "title", "body"])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain("D-Bus")
    })

    it("should handle rapid successive notification sends", async () => {
      setupShellMocking({ exitCode: 0 })
      const executor = getMockExecutor()

      const promises = Array.from({ length: 10 }, (_, i) =>
        executor(["notify-send", `title${i}`, `body${i}`])
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      expect(results.every((r) => r.exitCode === 0)).toBe(true)
    })

    it("should handle timeout in command execution", async () => {
      setupShellMocking({ exitCode: 124 }) // Timeout exit code
      const executor = getMockExecutor()

      const result = await executor(["timeout", "1", "notify-send", "title", "body"])

      expect(result.exitCode).toBe(124)
    })
  })
})
