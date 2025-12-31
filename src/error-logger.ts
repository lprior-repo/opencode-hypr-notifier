/**
 * Error Logging and Validation System
 *
 * Provides structured error handling with validation, persistence, and tracking
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  readonly timestamp: number
  readonly level: LogLevel
  readonly message: string
  readonly context?: Record<string, unknown>
  readonly stack?: string
}

interface ErrorValidationResult {
  readonly isValid: boolean
  readonly message: string
  readonly level: LogLevel
  readonly context?: Record<string, unknown>
}

const LOG_STORAGE_KEY = "OPENCODE_PLUGIN_LOGS"
const MAX_LOG_ENTRIES = 100
const LOG_RETENTION_MS = 24 * 60 * 60 * 1000 // 24 hours

class ErrorLogger {
  private logs: LogEntry[] = []

  /**
   * Validate error message format and content
   */
  public validateErrorMessage(error: unknown): ErrorValidationResult {
    if (error === null || error === undefined) {
      return {
        isValid: false,
        message: "Error is null or undefined",
        level: "error",
      }
    }

    if (error instanceof Error) {
      return {
        isValid: true,
        message: error.message,
        level: "error",
        context: {
          name: error.name,
          stack: error.stack?.split("\n").slice(0, 3).join("\n"),
        },
      }
    }

    if (typeof error === "string") {
      return {
        isValid: true,
        message: error,
        level: "error",
      }
    }

    if (typeof error === "object") {
      const errObj = error as Record<string, unknown>
      return {
        isValid: true,
        message: typeof errObj.message === "string" ? errObj.message : String(error),
        level: "error",
        context: {
          type: typeof error,
          keys: Object.keys(errObj),
        },
      }
    }

    return {
      isValid: false,
      message: `Unknown error type: ${typeof error}`,
      level: "error",
    }
  }

  /**
   * Log a message with proper structure and validation
   */
  public log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown): void {
    const validatedError = error ? this.validateErrorMessage(error) : null

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message: `${message}${validatedError ? ` - ${validatedError.message}` : ""}`,
      context: {
        ...context,
        ...(validatedError?.context ?? {}),
      },
    }

    this.logs.push(entry)
    this.pruneOldLogs()
    this.outputLog(entry)
  }

  /**
   * Output log based on level
   */
  private outputLog(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString()
    const contextStr = entry.context && Object.keys(entry.context).length > 0 ? ` ${JSON.stringify(entry.context)}` : ""

    const message = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}`

    switch (entry.level) {
      case "debug": {
        console.debug(message)
        break
      }
      case "info": {
        console.log(message)
        break
      }
      case "warn": {
        console.warn(message)
        break
      }
      case "error": {
        console.error(message)
        break
      }
      default: {
        console.log(message)
      }
    }
  }

  /**
   * Remove logs older than retention period
   */
  private pruneOldLogs(): void {
    const now = Date.now()
    this.logs = this.logs.filter((entry) => now - entry.timestamp < LOG_RETENTION_MS)

    // Keep only last N entries
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES)
    }
  }

  /**
   * Get all logs
   */
  public getLogs(): readonly LogEntry[] {
    return Object.freeze([...this.logs])
  }

  /**
   * Get logs by level
   */
  public getLogsByLevel(level: LogLevel): readonly LogEntry[] {
    return Object.freeze(this.logs.filter((entry) => entry.level === level))
  }

  /**
   * Get logs within time range
   */
  public getLogsSince(since: number): readonly LogEntry[] {
    return Object.freeze(this.logs.filter((entry) => entry.timestamp >= since))
  }

  /**
   * Clear all logs
   */
  public clearLogs(): void {
    this.logs = []
  }

  /**
   * Get error count
   */
  public getErrorCount(): number {
    return this.logs.filter((entry) => entry.level === "error").length
  }

  /**
   * Get summary of logs
   */
  public getSummary(): {
    readonly total: number
    readonly errors: number
    readonly warnings: number
    readonly infos: number
    readonly debugs: number
    readonly timespan: number
  } {
    const errors = this.getLogsByLevel("error").length
    const warnings = this.getLogsByLevel("warn").length
    const infos = this.getLogsByLevel("info").length
    const debugs = this.getLogsByLevel("debug").length

    const timespan =
      this.logs.length > 0 ? this.logs[this.logs.length - 1]!.timestamp - this.logs[0]!.timestamp : 0

    return {
      total: this.logs.length,
      errors,
      warnings,
      infos,
      debugs,
      timespan,
    }
  }
}

export const errorLogger = new ErrorLogger()
