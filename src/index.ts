import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"
import { errorLogger } from "./error-logger"
import { getExecutor } from "./shell"

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type Urgency = "low" | "normal" | "critical"

type HyprlandConfig = Readonly<{
  notification: boolean
  timeout: number
  transient: boolean
  icons: Readonly<{
    permission: string
    session: string
    error: string
  }>
  urgency: Readonly<{
    permission: Urgency
    session: Urgency
    error: Urgency
  }>
  messages: Readonly<{
    permission: string
    session: string
    error: string
  }>
  category: Readonly<{
    permission: string
    session: string
    error: string
  }>
}>

type PermissionEventProperties = Readonly<{
  id?: string
  type?: string
  title?: string
  pattern?: string | string[]
  sessionID?: string
  messageID?: string
  callID?: string
  metadata?: Record<string, unknown>
  [key: string]: unknown
}>

type SessionEventProperties = Readonly<{
  sessionID?: string
  info?: Readonly<{
    id?: string
    title?: string
    summary?: Readonly<{
      additions?: number
      deletions?: number
      files?: number
    }>
    [key: string]: unknown
  }>
  [key: string]: unknown
}>

type SessionErrorProperties = Readonly<{
  sessionID?: string
  error?: Readonly<{
    name?: string
    message?: string
    code?: string
    data?: Readonly<{
      message?: string
      [key: string]: unknown
    }>
    [key: string]: unknown
  }>
  [key: string]: unknown
}>

type OpenCodeEvent = Readonly<{
  type: string
  properties: unknown
}>

type EventHandler = (event: OpenCodeEvent, config: HyprlandConfig) => Promise<void>

function isValidUrgency(value: unknown): value is Urgency {
  return value === "low" || value === "normal" || value === "critical"
}

const DEFAULT_CONFIG: HyprlandConfig = Object.freeze({
  notification: true,
  timeout: 15000,
  transient: false,
  icons: Object.freeze({
    permission: "dialog-password",
    session: "emblem-ok-symbolic",
    error: "dialog-error-symbolic",
  }),
  urgency: Object.freeze({
    permission: "critical",
    session: "normal",
    error: "critical",
  }),
  messages: Object.freeze({
     permission: "🔐 OpenCode Needs Your Attention",
     session: "✓ OpenCode Session Idle",
     error: "✗ OpenCode Error",
   }),
  category: Object.freeze({
    permission: "im.received",
    session: "im.received",
    error: "im.error",
  }),
})

// ============================================================================
// CONFIGURATION LOADING (Cached)
// ============================================================================

let cachedConfig: HyprlandConfig | null = null
let configLoadAttempted = false

function getConfigPath(): string {
  return join(homedir(), ".config", "opencode", "opencode-hyprland.json")
}

function parseConfig(fileContent: string): unknown {
  return JSON.parse(fileContent) as unknown
}

function getConfigProperty(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) {
    return undefined
  }
  return (obj as Record<string, unknown>)[key]
}

function validateAndMergeConfig(userConfig: unknown): HyprlandConfig {
  if (typeof userConfig !== "object" || userConfig === null) {
    return DEFAULT_CONFIG
  }

  const config = userConfig as Record<string, unknown>

  const notification = typeof config["notification"] === "boolean" ? (config["notification"] as boolean) : DEFAULT_CONFIG.notification
  const timeout = typeof config["timeout"] === "number" ? (config["timeout"] as number) : DEFAULT_CONFIG.timeout
  const transient = typeof config["transient"] === "boolean" ? (config["transient"] as boolean) : DEFAULT_CONFIG.transient

  const urgencyObj = config["urgency"]
  const urgency = {
    permission: isValidUrgency(getConfigProperty(urgencyObj, "permission"))
      ? (getConfigProperty(urgencyObj, "permission") as Urgency)
      : DEFAULT_CONFIG.urgency.permission,
    session:
      isValidUrgency(getConfigProperty(urgencyObj, "session")) ||
      isValidUrgency(getConfigProperty(urgencyObj, "complete"))
        ? isValidUrgency(getConfigProperty(urgencyObj, "session"))
          ? (getConfigProperty(urgencyObj, "session") as Urgency)
          : (getConfigProperty(urgencyObj, "complete") as Urgency)
        : DEFAULT_CONFIG.urgency.session,
    error: isValidUrgency(getConfigProperty(urgencyObj, "error"))
      ? (getConfigProperty(urgencyObj, "error") as Urgency)
      : DEFAULT_CONFIG.urgency.error,
  }

  const messagesObj = config["messages"]
  const messages = {
    permission: typeof getConfigProperty(messagesObj, "permission") === "string"
      ? (getConfigProperty(messagesObj, "permission") as string)
      : DEFAULT_CONFIG.messages.permission,
    session: typeof getConfigProperty(messagesObj, "session") === "string" || typeof getConfigProperty(messagesObj, "complete") === "string"
      ? typeof getConfigProperty(messagesObj, "session") === "string"
        ? (getConfigProperty(messagesObj, "session") as string)
        : (getConfigProperty(messagesObj, "complete") as string)
      : DEFAULT_CONFIG.messages.session,
    error: typeof getConfigProperty(messagesObj, "error") === "string"
      ? (getConfigProperty(messagesObj, "error") as string)
      : DEFAULT_CONFIG.messages.error,
  }

  const iconsObj = config["icons"]
  const icons = {
    permission: typeof getConfigProperty(iconsObj, "permission") === "string"
      ? (getConfigProperty(iconsObj, "permission") as string)
      : DEFAULT_CONFIG.icons.permission,
    session: typeof getConfigProperty(iconsObj, "session") === "string"
      ? (getConfigProperty(iconsObj, "session") as string)
      : DEFAULT_CONFIG.icons.session,
    error: typeof getConfigProperty(iconsObj, "error") === "string"
      ? (getConfigProperty(iconsObj, "error") as string)
      : DEFAULT_CONFIG.icons.error,
  }

  const categoryObj = config["category"]
  const category = {
    permission: typeof getConfigProperty(categoryObj, "permission") === "string"
      ? (getConfigProperty(categoryObj, "permission") as string)
      : DEFAULT_CONFIG.category.permission,
    session: typeof getConfigProperty(categoryObj, "session") === "string"
      ? (getConfigProperty(categoryObj, "session") as string)
      : DEFAULT_CONFIG.category.session,
    error: typeof getConfigProperty(categoryObj, "error") === "string"
      ? (getConfigProperty(categoryObj, "error") as string)
      : DEFAULT_CONFIG.category.error,
  }

  return Object.freeze({
    notification,
    timeout,
    transient,
    urgency: Object.freeze(urgency),
    messages: Object.freeze(messages),
    icons: Object.freeze(icons),
    category: Object.freeze(category),
  })
}

function loadConfig(): HyprlandConfig {
  // Return cached config if already loaded
  if (configLoadAttempted) {
    return cachedConfig ?? DEFAULT_CONFIG
  }

  configLoadAttempted = true
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    errorLogger.log("debug", "Config file not found, using defaults", { configPath })
    cachedConfig = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  }

  try {
    const fileContent = readFileSync(configPath, "utf-8")
    const userConfig = parseConfig(fileContent)
    const config = validateAndMergeConfig(userConfig)
    cachedConfig = config
    errorLogger.log("info", "Config loaded successfully", { configPath })
    return config
  } catch (error) {
    errorLogger.log("error", "Failed to load config", { configPath }, error)
    cachedConfig = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  }
}

// ============================================================================
// SHELL UTILITIES
// ============================================================================

function escapeShellString(str: string): string {
  return str.replace(/"/g, '\\"')
}

async function executeShellCommand(command: string[]): Promise<void> {
  try {
    const [cmd, ...args] = command
    if (!cmd) {
      throw new Error("Empty command")
    }

    const executor = getExecutor()
    const result = await executor([cmd, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    if (result.exitCode !== 0 && result.exitCode !== null) {
      errorLogger.log("warn", "Shell command failed", {
        command: cmd,
        exitCode: result.exitCode,
        reason: "notify-send may not be available or exited with error",
      })
    } else if (result.exitCode === null) {
      errorLogger.log("warn", "Shell command failed", {
        command: cmd,
        exitCode: null,
        reason: "notify-send may not be available or exited with error",
      })
    }
  } catch (error) {
    errorLogger.log("debug", "Shell command execution failed", { reason: "notify-send may not be available" }, error)
  }
}

// ============================================================================
// NOTIFICATION HELPER
// ============================================================================

interface NotificationOptions {
  icon?: string
  category?: string
  transient?: boolean
}

async function sendNotification(
  title: string,
  body: string,
  urgency: Urgency,
  timeout: number,
  options: NotificationOptions = {}
): Promise<void> {
  try {
    const escapedTitle = escapeShellString(title)
    const escapedBody = escapeShellString(body)

    const command: string[] = ["notify-send", "-u", urgency, "-t", String(timeout), "-a", "OpenCode"]

    // Add icon if provided
    if (options.icon) {
      command.push("-i", options.icon)
    }

    // Add category if provided
    if (options.category) {
      command.push("-c", options.category)
    }

    // Add transient flag if enabled
    if (options.transient) {
      command.push("-e")
    }

    // Add title and body
    command.push(escapedTitle, escapedBody)

    await executeShellCommand(command)
    errorLogger.log("debug", "Notification sent", {
      urgency,
      titleLength: title.length,
      bodyLength: body.length,
      hasIcon: !!options.icon,
      hasCategory: !!options.category,
    })
  } catch (error) {
    errorLogger.log("debug", "Notification delivery failed", { reason: "notify-send may not be available" }, error)
  }
}

// ============================================================================
// EVENT BODY BUILDERS (DRY - extracted common logic)
// ============================================================================

function buildEventBody(eventType: string, props: unknown): string {
  if (typeof props !== "object" || props === null) {
    return "No properties available"
  }

  const propsRecord = props as Record<string, unknown>

  switch (eventType) {
    case "permission.updated": {
      return buildPermissionEventBody(propsRecord as PermissionEventProperties)
    }
    case "session.idle":
    case "session.updated":
    case "session.complete":
    case "task.complete": {
      return buildSessionEventBody(propsRecord as SessionEventProperties)
    }
    case "session.error": {
      return buildErrorEventBody(propsRecord as SessionErrorProperties)
    }
    default: {
      // For any other event type, try to extract useful information
      errorLogger.log("debug", "Unknown event type, attempting generic extraction", {
        eventType,
        propsKeys: Object.keys(propsRecord),
      })
      
      let body = ""
      
      // Try to find a title/name/message field
      if (typeof propsRecord.title === "string") {
        body = propsRecord.title
      } else if (typeof propsRecord.name === "string") {
        body = propsRecord.name
      } else if (typeof propsRecord.message === "string") {
        body = propsRecord.message
      } else if (typeof propsRecord.description === "string") {
        body = propsRecord.description
      } else if (typeof propsRecord.sessionID === "string") {
        body = `Session: ${propsRecord.sessionID}`
      } else {
        body = `Event properties: ${JSON.stringify(propsRecord).substring(0, 200)}`
      }
      
      return body || "Event completed"
    }
  }
}

function buildPermissionEventBody(props: PermissionEventProperties): string {
  // Props is the Permission object from OpenCode SDK
  // It has: id, type, pattern?, sessionID, messageID, callID?, title, metadata?, time
  const propsRecord = props as Record<string, unknown>
  
  // Extract permission type (e.g., "network", "file", "api")
  const permType = typeof propsRecord.type === "string" ? propsRecord.type : "Unknown"
  let body = `Type: ${permType}`
  
  // Extract permission title (e.g., "Make HTTP Request")
  if (typeof propsRecord.title === "string") {
    body += `\nAction: ${propsRecord.title}`
  }
  
  // Extract pattern (e.g., "api.example.com" or ["*.example.com", "test.com"])
  if (propsRecord.pattern !== undefined) {
    let patternStr = ""
    if (Array.isArray(propsRecord.pattern)) {
      patternStr = propsRecord.pattern.filter((p) => typeof p === "string").join(", ")
    } else if (typeof propsRecord.pattern === "string") {
      patternStr = propsRecord.pattern
    }
    if (patternStr) {
      body += `\nResource: ${patternStr}`
    }
  }
  
  // Extract session ID for context
  if (typeof propsRecord.sessionID === "string") {
    body += `\nSession: ${propsRecord.sessionID}`
  }
  
  return body
}

function buildSessionEventBody(props: SessionEventProperties): string {
  // Prefer session.updated format with full info object
  const sessionInfo = props.info ?? {}
  const sessionID = sessionInfo.id ?? props.sessionID ?? "unknown"
  
  let body = `Session: ${sessionID}`
  
  // Add session title if available
  if (typeof sessionInfo.title === "string") {
    body += `\nTitle: ${sessionInfo.title}`
  }
  
  // Add summary information if available
  if (typeof sessionInfo.summary === "object" && sessionInfo.summary !== null) {
    const summary = sessionInfo.summary as Record<string, unknown>
    if (typeof summary.files === "number" && summary.files > 0) {
      body += `\nFiles changed: ${summary.files}`
    }
    if (typeof summary.additions === "number" && summary.additions > 0) {
      body += `\nAdditions: +${summary.additions}`
    }
    if (typeof summary.deletions === "number" && summary.deletions > 0) {
      body += `\nDeletions: -${summary.deletions}`
    }
  }
  
  return body
}

function buildErrorEventBody(props: SessionErrorProperties): string {
  const sessionID = props.sessionID ?? "unknown"
  let body = `Session: ${sessionID}`

  if (props.error !== undefined && typeof props.error === "object" && props.error !== null) {
    const error = props.error as Record<string, unknown>
    
    // Extract error name/type
    if (typeof error.name === "string") {
      body += `\nError: ${error.name}`
    }
    
    // Extract error message - can be at multiple levels in SDK error types
    let messageStr: string | undefined
    
    // Try error.data.message (ProviderAuthError, ApiError, etc.)
    if (typeof error.data === "object" && error.data !== null) {
      const data = error.data as Record<string, unknown>
      if (typeof data.message === "string") {
        messageStr = data.message
      }
    }
    
    // Try error.message directly (UnknownError, MessageOutputLengthError, etc.)
    if (!messageStr && typeof error.message === "string") {
      messageStr = error.message
    }
    
    // Try error.code (some error types have a code field)
    if (!messageStr && typeof error.code === "string") {
      messageStr = error.code
    }
    
    if (messageStr) {
      body += `\nMessage: ${messageStr}`
    }
  }

  return body
}

// ============================================================================
// GENERIC EVENT HANDLER (DRY - reduces duplication)
// ============================================================================

async function handleEvent(
  event: OpenCodeEvent,
  config: HyprlandConfig,
  urgencyKey: "permission" | "session" | "error",
  messageKey: "permission" | "session" | "error"
): Promise<void> {
  if (!config.notification) {
    return
  }

  const props = event.properties
  if (typeof props !== "object" || props === null) {
    return
  }

  const body = buildEventBody(event.type, props)
  await sendNotification(config.messages[messageKey], body, config.urgency[urgencyKey], config.timeout, {
    icon: config.icons[messageKey],
    category: config.category[messageKey],
    transient: config.transient,
  })
}

// ============================================================================
// TYPED EVENT HANDLER MAP
// ============================================================================

const eventHandlers: Readonly<Record<string, EventHandler>> = Object.freeze({
  "permission.updated": (event, config) => handleEvent(event, config, "permission", "permission"),
  "session.idle": (event, config) => handleEvent(event, config, "session", "session"),
  "session.updated": (event, config) => handleEvent(event, config, "session", "session"),
  "session.complete": (event, config) => handleEvent(event, config, "session", "session"),
  "task.complete": (event, config) => handleEvent(event, config, "session", "session"),
  "session.error": (event, config) => handleEvent(event, config, "error", "error"),
})

// ============================================================================
// PLUGIN EXPORT
// ============================================================================

/**
 * Hyprland Notifier Plugin for OpenCode
 *
 * Sends desktop notifications via notify-send for:
 * - Permission requests (critical urgency)
 * - Session completions (normal urgency)
 * - Session errors (critical urgency)
 *
 * Built with Bun native patterns and test-driven design
 */
const HyprlandNotifierPlugin: Plugin = async ({ $: _shell, client: _client, project: _project, directory: _directory, worktree: _worktree }): Promise<{ event: (input: { event: OpenCodeEvent }) => Promise<void> }> => {
  const config = loadConfig()

  // Log only on first initialization
  if (!configLoadAttempted || cachedConfig === null) {
    errorLogger.log("info", "HyprlandNotifierPlugin initialized", {
      notificationsEnabled: config.notification,
      timeout: config.timeout,
    })
  }

  return {
    event: async ({ event }): Promise<void> => {
      try {
        const handler = eventHandlers[event.type]

        if (handler) {
          await handler(event, config)
        } else {
          // Log unknown event types with more detail for debugging
          errorLogger.log("debug", "Ignoring unknown event type", { 
            eventType: event.type,
            availableHandlers: Object.keys(eventHandlers),
            propertiesKeys: typeof event.properties === "object" && event.properties !== null ? Object.keys(event.properties as Record<string, unknown>) : "not-object"
          })
        }
      } catch (error) {
        errorLogger.log("error", "Error handling event", { 
          eventType: event.type,
          error: error instanceof Error ? error.message : String(error)
        }, error)
      }
    },
  }
}

export default HyprlandNotifierPlugin
