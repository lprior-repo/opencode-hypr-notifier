/**
 * Mock shell executor for testing
 *
 * Allows deterministic testing of shell command execution
 * without relying on external tools like notify-send.
 */

import type { ShellResult, ShellExecutor, ShellExecutorOptions } from "./shell"

// ============================================================================
// MOCK SHELL EXECUTOR
// ============================================================================

export interface MockShellConfig {
  exitCode?: number | null
  stdout?: string
  stderr?: string
  failOnCommand?: string
  throwError?: boolean
}

let mockConfig: MockShellConfig = {
  exitCode: 0,
  stdout: "",
  stderr: "",
  failOnCommand: undefined,
  throwError: false,
}

/**
 * Configure the mock shell executor
 */
export function configureMockShell(config: Partial<MockShellConfig>): void {
  mockConfig = { ...mockConfig, ...config }
}

/**
 * Reset mock configuration to defaults
 */
export function resetMockShell(): void {
  mockConfig = {
    exitCode: 0,
    stdout: "",
    stderr: "",
    failOnCommand: undefined,
    throwError: false,
  }
}

/**
 * Get the mock shell executor
 */
export function getMockExecutor(): ShellExecutor {
  return async (command: string[], _options?: ShellExecutorOptions): Promise<ShellResult> => {
    // Simulate throw error if configured
    if (mockConfig.throwError) {
      throw new Error("Mock shell executor error")
    }

    // Get the command name (first element)
    const commandName = command[0] ?? ""

    // Check if we should fail this specific command
    if (mockConfig.failOnCommand && commandName.includes(mockConfig.failOnCommand)) {
      return Object.freeze({
        exitCode: 1,
        stdout: "",
        stderr: "Mock: Command failed",
      })
    }

    // Return configured result (use 0 as default, but allow null explicitly)
    const exitCode = mockConfig.exitCode !== undefined ? mockConfig.exitCode : 0
    return Object.freeze({
      exitCode,
      stdout: mockConfig.stdout ?? "",
      stderr: mockConfig.stderr ?? "",
    })
  }
}

/**
 * Command history tracking
 */
let commandHistory: Array<Readonly<{ command: string[]; timestamp: number }>> = []

/**
 * Get history of executed commands
 */
export function getCommandHistory(): Array<Readonly<{ command: string[]; timestamp: number }>> {
  return [...commandHistory]
}

/**
 * Clear command history
 */
export function clearCommandHistory(): void {
  commandHistory = []
}

/**
 * Record a command execution (called by mock executor)
 */
export function recordCommand(command: string[]): void {
  commandHistory.push(Object.freeze({ command, timestamp: Date.now() }))
}

/**
 * Get executor with history tracking
 */
export function getMockExecutorWithHistory(): ShellExecutor {
  const baseExecutor = getMockExecutor()
  return async (command: string[], options?: ShellExecutorOptions): Promise<ShellResult> => {
    recordCommand(command)
    return baseExecutor(command, options)
  }
}

/**
 * Simulate a command execution with tracking
 */
export async function simulateCommand(
  command: string[],
  options?: ShellExecutorOptions
): Promise<ShellResult> {
  const executor = getMockExecutorWithHistory()
  return executor(command, options)
}
