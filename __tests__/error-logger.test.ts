import { describe, it, expect, beforeEach } from "bun:test"
import { errorLogger } from "../error-logger"

describe("ErrorLogger", () => {
  beforeEach(() => {
    errorLogger.clearLogs()
  })

  describe("validateErrorMessage", () => {
    it("should validate Error objects", () => {
      const error = new Error("Test error")
      const result = errorLogger.validateErrorMessage(error)

      expect(result.isValid).toBe(true)
      expect(result.message).toBe("Test error")
      expect(result.level).toBe("error")
      expect(result.context?.name).toBe("Error")
    })

    it("should validate string errors", () => {
      const error = "String error"
      const result = errorLogger.validateErrorMessage(error)

      expect(result.isValid).toBe(true)
      expect(result.message).toBe("String error")
      expect(result.level).toBe("error")
    })

    it("should validate object errors with message property", () => {
      const error = { message: "Object error", code: "ERR_001" }
      const result = errorLogger.validateErrorMessage(error)

      expect(result.isValid).toBe(true)
      expect(result.message).toBe("Object error")
      expect(result.level).toBe("error")
      expect(result.context?.keys).toContain("message")
    })

    it("should handle null errors", () => {
      const result = errorLogger.validateErrorMessage(null)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe("Error is null or undefined")
      expect(result.level).toBe("error")
    })

    it("should handle undefined errors", () => {
      const result = errorLogger.validateErrorMessage(undefined)

      expect(result.isValid).toBe(false)
      expect(result.message).toBe("Error is null or undefined")
    })

    it("should handle unknown error types", () => {
      const result = errorLogger.validateErrorMessage(123)

      expect(result.isValid).toBe(false)
      expect(result.message).toContain("Unknown error type")
      expect(result.level).toBe("error")
    })

    it("should extract stack trace from Error", () => {
      const error = new Error("Stack trace error")
      const result = errorLogger.validateErrorMessage(error)

      expect(result.context?.stack).toBeDefined()
      expect(typeof result.context?.stack).toBe("string")
    })
  })

  describe("logging", () => {
    it("should log debug messages", () => {
      errorLogger.log("debug", "Debug message")

      const logs = errorLogger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0]!.level).toBe("debug")
      expect(logs[0]!.message).toBe("Debug message")
    })

    it("should log info messages", () => {
      errorLogger.log("info", "Info message")

      const logs = errorLogger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0]!.level).toBe("info")
    })

    it("should log warn messages", () => {
      errorLogger.log("warn", "Warning message")

      const logs = errorLogger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0]!.level).toBe("warn")
    })

    it("should log error messages", () => {
      errorLogger.log("error", "Error message")

      const logs = errorLogger.getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0]!.level).toBe("error")
    })

    it("should log with context", () => {
      const context = { userId: "user123", action: "login" }
      errorLogger.log("info", "User action", context)

      const logs = errorLogger.getLogs()
      expect(logs[0]!.context?.userId).toBe("user123")
      expect(logs[0]!.context?.action).toBe("login")
    })

    it("should log with error object", () => {
      const error = new Error("Test error")
      errorLogger.log("error", "An error occurred", { component: "plugin" }, error)

      const logs = errorLogger.getLogs()
      expect(logs[0]!.message).toContain("An error occurred")
      expect(logs[0]!.message).toContain("Test error")
      expect(logs[0]!.context?.component).toBe("plugin")
    })
  })

  describe("log retrieval", () => {
    beforeEach(() => {
      errorLogger.log("debug", "Debug 1")
      errorLogger.log("info", "Info 1")
      errorLogger.log("warn", "Warn 1")
      errorLogger.log("error", "Error 1")
      errorLogger.log("info", "Info 2")
    })

    it("should get all logs", () => {
      const logs = errorLogger.getLogs()
      expect(logs.length).toBe(5)
    })

    it("should get logs by level", () => {
      const infoLogs = errorLogger.getLogsByLevel("info")
      expect(infoLogs.length).toBe(2)
      expect(infoLogs[0]!.message).toBe("Info 1")
      expect(infoLogs[1]!.message).toBe("Info 2")
    })

    it("should get logs since timestamp", () => {
      const logs = errorLogger.getLogs()
      const timestamp = logs[1]!.timestamp
      const logsSince = errorLogger.getLogsSince(timestamp)

      // Should include logs at timestamp and after
      expect(logsSince.length).toBeGreaterThanOrEqual(4)
    })

    it("should get error count", () => {
      expect(errorLogger.getErrorCount()).toBe(1)
    })
  })

  describe("log summary", () => {
    beforeEach(() => {
      errorLogger.log("debug", "Debug 1")
      errorLogger.log("info", "Info 1")
      errorLogger.log("warn", "Warn 1")
      errorLogger.log("error", "Error 1")
      errorLogger.log("error", "Error 2")
    })

    it("should provide accurate summary", () => {
      const summary = errorLogger.getSummary()

      expect(summary.total).toBe(5)
      expect(summary.debugs).toBe(1)
      expect(summary.infos).toBe(1)
      expect(summary.warnings).toBe(1)
      expect(summary.errors).toBe(2)
    })

    it("should calculate timespan correctly", () => {
      const summary = errorLogger.getSummary()
      expect(summary.timespan).toBeGreaterThanOrEqual(0)
    })

    it("should handle empty logs", () => {
      errorLogger.clearLogs()
      const summary = errorLogger.getSummary()

      expect(summary.total).toBe(0)
      expect(summary.errors).toBe(0)
      expect(summary.timespan).toBe(0)
    })
  })

  describe("log retention", () => {
    it("should maintain max log entries", () => {
      // Add more logs than MAX_LOG_ENTRIES
      for (let i = 0; i < 120; i += 1) {
        errorLogger.log("info", `Log ${i}`)
      }

      const logs = errorLogger.getLogs()
      expect(logs.length).toBeLessThanOrEqual(100)
    })
  })

  describe("log immutability", () => {
    it("should return frozen logs array", () => {
      errorLogger.log("info", "Test")
      const logs = errorLogger.getLogs()

      expect(() => {
        // @ts-expect-error Testing immutability
        logs.push({ level: "debug", message: "Should fail" })
      }).toThrow()
    })
  })
})
