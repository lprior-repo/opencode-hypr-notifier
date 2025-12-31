/**
 * OpenCode Hyprland Notifier Plugin
 * 
 * Sends desktop notifications via notify-send for permission requests,
 * session events, and task completions.
 */

import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

// ============================================================================
// TYPES
// ============================================================================

type Urgency = "low" | "normal" | "critical"

type HyprlandConfig = Readonly<{
  notification: boolean
  timeout: number
  transient: boolean
  icons: Readonly<{ permission: string; session: string; idle: string }>
  urgency: Readonly<{ permission: Urgency; session: Urgency; idle: Urgency }>
  messages: Readonly<{ permission: string; session: string; idle: string }>
  category: Readonly<{ permission: string; session: string; idle: string }>
}>

type OpenCodeEvent = Readonly<{ type: string; properties: unknown }>

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: HyprlandConfig = Object.freeze({
  notification: true,
  timeout: 15000,
  transient: false,
  icons: Object.freeze({
    permission: "dialog-password",
    session: "emblem-ok-symbolic",
    idle: "dialog-information",
  }),
  urgency: Object.freeze({
    permission: "critical",
    session: "normal",
    idle: "normal",
  }),
  messages: Object.freeze({
    permission: "OpenCode Needs Your Attention",
    session: "OpenCode Session Idle",
    idle: "OpenCode Waiting for Input",
  }),
  category: Object.freeze({
    permission: "im.received",
    session: "im.received",
    idle: "im.received",
  }),
})

// ============================================================================
// STATE (singleton to prevent double initialization)
// ============================================================================

let initialized = false
let cachedConfig: HyprlandConfig | null = null
let idleNotificationSent = false

// ============================================================================
// LOGGING
// ============================================================================

function log(level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` ${JSON.stringify(context)}` : ""
  const msg = `[hypr-notifier] [${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  if (level === "error") console.error(msg)
  else if (level === "warn") console.warn(msg)
  else console.log(msg)
}

// ============================================================================
// SHELL EXECUTION
// ============================================================================

async function executeCommand(command: string[]): Promise<{ exitCode: number | null }> {
  try {
    const proc = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
    await proc.exited
    return { exitCode: proc.exitCode }
  } catch {
    return { exitCode: null }
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

function isValidUrgency(value: unknown): value is Urgency {
  return value === "low" || value === "normal" || value === "critical"
}

function getConfigProperty(obj: unknown, key: string): unknown {
  if (typeof obj !== "object" || obj === null) return undefined
  return (obj as Record<string, unknown>)[key]
}

function loadConfig(): HyprlandConfig {
  if (cachedConfig !== null) return cachedConfig

  const configPath = join(homedir(), ".config", "opencode", "opencode-hyprland.json")

  if (!existsSync(configPath)) {
    cachedConfig = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  }

  try {
    const userConfig = JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>

    const urgencyObj = userConfig["urgency"]
    const messagesObj = userConfig["messages"]
    const iconsObj = userConfig["icons"]
    const categoryObj = userConfig["category"]

    cachedConfig = Object.freeze({
      notification: typeof userConfig["notification"] === "boolean" ? userConfig["notification"] : DEFAULT_CONFIG.notification,
      timeout: typeof userConfig["timeout"] === "number" ? userConfig["timeout"] : DEFAULT_CONFIG.timeout,
      transient: typeof userConfig["transient"] === "boolean" ? userConfig["transient"] : DEFAULT_CONFIG.transient,
      urgency: Object.freeze({
        permission: isValidUrgency(getConfigProperty(urgencyObj, "permission")) ? getConfigProperty(urgencyObj, "permission") as Urgency : DEFAULT_CONFIG.urgency.permission,
        session: isValidUrgency(getConfigProperty(urgencyObj, "session")) ? getConfigProperty(urgencyObj, "session") as Urgency : DEFAULT_CONFIG.urgency.session,
        idle: isValidUrgency(getConfigProperty(urgencyObj, "idle")) ? getConfigProperty(urgencyObj, "idle") as Urgency : DEFAULT_CONFIG.urgency.idle,
      }),
      messages: Object.freeze({
        permission: typeof getConfigProperty(messagesObj, "permission") === "string" ? getConfigProperty(messagesObj, "permission") as string : DEFAULT_CONFIG.messages.permission,
        session: typeof getConfigProperty(messagesObj, "session") === "string" ? getConfigProperty(messagesObj, "session") as string : DEFAULT_CONFIG.messages.session,
        idle: typeof getConfigProperty(messagesObj, "idle") === "string" ? getConfigProperty(messagesObj, "idle") as string : DEFAULT_CONFIG.messages.idle,
      }),
      icons: Object.freeze({
        permission: typeof getConfigProperty(iconsObj, "permission") === "string" ? getConfigProperty(iconsObj, "permission") as string : DEFAULT_CONFIG.icons.permission,
        session: typeof getConfigProperty(iconsObj, "session") === "string" ? getConfigProperty(iconsObj, "session") as string : DEFAULT_CONFIG.icons.session,
        idle: typeof getConfigProperty(iconsObj, "idle") === "string" ? getConfigProperty(iconsObj, "idle") as string : DEFAULT_CONFIG.icons.idle,
      }),
      category: Object.freeze({
        permission: typeof getConfigProperty(categoryObj, "permission") === "string" ? getConfigProperty(categoryObj, "permission") as string : DEFAULT_CONFIG.category.permission,
        session: typeof getConfigProperty(categoryObj, "session") === "string" ? getConfigProperty(categoryObj, "session") as string : DEFAULT_CONFIG.category.session,
        idle: typeof getConfigProperty(categoryObj, "idle") === "string" ? getConfigProperty(categoryObj, "idle") as string : DEFAULT_CONFIG.category.idle,
      }),
    })

    return cachedConfig
  } catch {
    cachedConfig = DEFAULT_CONFIG
    return DEFAULT_CONFIG
  }
}

// ============================================================================
// NOTIFICATION
// ============================================================================

async function sendNotification(
  title: string,
  body: string,
  urgency: Urgency,
  timeout: number,
  icon?: string,
  category?: string,
  transient?: boolean
): Promise<void> {
  const command: string[] = ["notify-send", "-u", urgency, "-t", String(timeout), "-a", "OpenCode"]
  if (icon) command.push("-i", icon)
  if (category) command.push("-c", category)
  if (transient) command.push("-e")
  command.push(title, body)
  await executeCommand(command)
}

// ============================================================================
// EVENT BODY BUILDERS
// ============================================================================

function buildBody(eventType: string, props: unknown): string {
  if (typeof props !== "object" || props === null) return "Event received"

  const p = props as Record<string, unknown>

  if (eventType === "permission.updated") {
    let body = `Type: ${typeof p.type === "string" ? p.type : "Unknown"}`
    if (typeof p.title === "string") body += `\nAction: ${p.title}`
    if (Array.isArray(p.pattern)) body += `\nResource: ${p.pattern.join(", ")}`
    else if (typeof p.pattern === "string") body += `\nResource: ${p.pattern}`
    if (typeof p.sessionID === "string") body += `\nSession: ${p.sessionID}`
    return body
  }

  if (eventType === "session.complete") {
    const info = (typeof p.info === "object" && p.info !== null ? p.info : {}) as Record<string, unknown>
    const sessionID = (info.id ?? p.sessionID ?? "unknown") as string
    let body = `Session: ${sessionID}`
    if (typeof info.title === "string") body += `\nTitle: ${info.title}`
    const summary = info.summary as Record<string, unknown> | undefined
    if (summary) {
      if (typeof summary.files === "number" && summary.files > 0) body += `\nFiles: ${summary.files}`
      if (typeof summary.additions === "number" && summary.additions > 0) body += `\n+${summary.additions}`
      if (typeof summary.deletions === "number" && summary.deletions > 0) body += `\n-${summary.deletions}`
    }
    return body
  }

  if (eventType === "task.complete") {
    const taskID = (p.taskID ?? p.id ?? "unknown") as string
    let body = `Task: ${taskID}`
    if (typeof p.title === "string") body += `\nTitle: ${p.title}`
    if (typeof p.description === "string") body += `\nDescription: ${p.description}`
    if (typeof p.sessionID === "string") body += `\nSession: ${p.sessionID}`
    return body
  }

  if (eventType === "session.idle") {
    const sessionID = (p.sessionID ?? p.id ?? "unknown") as string
    let body = "OpenCode has finished processing"
    if (sessionID !== "unknown") body += `\nSession: ${sessionID}`
    return body
  }

  return typeof p.title === "string" ? p.title : "Event received"
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

type EventKey = "permission" | "session" | "idle"

const eventMap: Record<string, EventKey> = {
  "permission.updated": "permission",
  "session.complete": "session",
  "task.complete": "session",
  "session.idle": "idle",
}

async function handleEvent(event: OpenCodeEvent, config: HyprlandConfig): Promise<void> {
  if (!config.notification) return

  const key = eventMap[event.type]
  if (!key) return

  // For idle events, only send a single notification until session becomes active again
  if (key === "idle") {
    if (idleNotificationSent) {
      return
    }
    idleNotificationSent = true
  }

  // Reset idle notification flag when session becomes active (permission request or completion)
  if (key === "permission" || key === "session") {
    idleNotificationSent = false
  }

  const body = buildBody(event.type, event.properties)
  await sendNotification(
    config.messages[key],
    body,
    config.urgency[key],
    config.timeout,
    config.icons[key],
    config.category[key],
    config.transient
  )
}

// ============================================================================
// PLUGIN EXPORT
// ============================================================================

export const HyprNotifierPlugin: Plugin = async () => {
  const config = loadConfig()

  // Only log once
  if (!initialized) {
    initialized = true
    log("info", "HyprNotifierPlugin initialized", {
      notifications: config.notification,
      timeout: config.timeout,
    })
  }

  return {
    event: async ({ event }: { event: OpenCodeEvent }): Promise<void> => {
      try {
        await handleEvent(event, config)
      } catch (error) {
        log("error", "Event handling failed", {
          type: event.type,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
  }
}

export default HyprNotifierPlugin
