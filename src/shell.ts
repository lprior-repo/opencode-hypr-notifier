/**
 * Shell execution wrapper for Bun
 *
 * This module wraps Bun.spawn() to make it mockable in tests.
 * Enables deterministic testing of shell command execution.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ShellResult = Readonly<{
  exitCode: number | null
  stdout: string
  stderr: string
}>

export type ShellExecutor = (command: string[], options?: ShellExecutorOptions) => Promise<ShellResult>

export type ShellExecutorOptions = Readonly<{
  stdout?: "pipe" | "inherit" | "ignore"
  stderr?: "pipe" | "inherit" | "ignore"
}>

// ============================================================================
// REAL SHELL EXECUTOR (Bun Native)
// ============================================================================

/**
 * Execute a shell command using Bun.spawn
 * @param command - Command and arguments as array
 * @param options - Spawn options
 * @returns Promise with exit code and output
 */
export async function executeCommand(command: string[], options: ShellExecutorOptions = {}): Promise<ShellResult> {
  try {
    const { stdout = "pipe", stderr = "pipe" } = options

    const result = await Bun.spawn(command, {
      stdout: stdout as BunOutputType,
      stderr: stderr as BunOutputType,
    })

    // Create text output from stdout/stderr if available
    let stdoutText = ""
    let stderrText = ""

    if (result.stdout) {
      stdoutText = await new Response(result.stdout).text()
    }

    if (result.stderr) {
      stderrText = await new Response(result.stderr).text()
    }

    return Object.freeze({
      exitCode: result.exitCode,
      stdout: stdoutText,
      stderr: stderrText,
    })
  } catch (error) {
    // If spawn itself fails, treat as fatal error
    return Object.freeze({
      exitCode: null,
      stdout: "",
      stderr: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

// ============================================================================
// SHELL EXECUTOR REGISTRY (for testing)
// ============================================================================

let currentExecutor: ShellExecutor = executeCommand

/**
 * Replace the shell executor with a mock (for testing)
 */
export function setExecutor(executor: ShellExecutor): void {
  currentExecutor = executor
}

/**
 * Reset to default executor
 */
export function resetExecutor(): void {
  currentExecutor = executeCommand
}

/**
 * Get current executor
 */
export function getExecutor(): ShellExecutor {
  return currentExecutor
}

// Type stub for Bun output types
type BunOutputType = "pipe" | "inherit" | "ignore"
