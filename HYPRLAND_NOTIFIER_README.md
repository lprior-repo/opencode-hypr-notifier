# OpenCode Hyprland Notifier Plugin

A robust OpenCode plugin that sends system desktop notifications via `notify-send` when OpenCode needs your attention, completes sessions, or encounters errors.

## Features

### 🔔 Desktop Notifications

Sends notifications to your Hyprland desktop environment using `notify-send`:

- **Permission Requests** - Critical urgency for immediate visibility
- **Session Completion** - Normal urgency when a task finishes
- **Session Errors** - Critical urgency for error conditions

### ⚙️ Configuration

Create `~/.config/opencode/opencode-hyprland.json`:

```json
{
  "notification": true,
  "timeout": 5000,
  "urgency": {
    "permission": "critical",
    "session": "normal",
    "error": "critical"
  },
  "messages": {
    "permission": "🔐 OpenCode Needs Your Attention",
    "session": "✓ Task Completed",
    "error": "✗ OpenCode Error"
  }
}
```

**Settings:**

- `notification` (boolean) - Enable/disable notifications
- `timeout` (number) - Notification timeout in milliseconds
- `urgency.*` (string) - one of: `"low"`, `"normal"`, `"critical"`
- `messages.*` (string) - Custom notification titles

## Events Handled

### Permission Events

When OpenCode requests a permission:

```
Title: 🔐 OpenCode Needs Your Attention
Body:
Permission Type: network
Title: Make HTTP Request
Pattern: api.example.com
```

**Properties extracted:**
- Permission type
- Permission title
- Access pattern
- Metadata if available

### Session Completion

When a session completes successfully:

```
Title: ✓ Task Completed
Body:
Session: sess_abc123
```

**Properties extracted:**
- Session ID

### Session Errors

When a session encounters an error:

```
Title: ✗ OpenCode Error
Body:
Session: sess_xyz789
Error: ProviderAuthError
Message: Invalid API key
```

**Properties extracted:**
- Session ID
- Error name/type
- Error message

## System Requirements

- Hyprland window manager (or any system with `notify-send`)
- `notify-send` command installed (provides desktop notifications)
- A notification daemon running (e.g., dunst, mako, or similar)

### Install on Hyprland

```bash
# Install notify-send (usually included with libnotify)
sudo pacman -S libnotify

# Ensure a notification daemon is running
# Add to your Hyprland config or start manually:
dunst &  # or: mako &
```

## Installation

The plugin is already installed at:
- `~/.config/opencode/plugin/hyprland-notifier.ts`

## Configuration Examples

### Disable notifications

```json
{
  "notification": false
}
```

### High visibility mode

```json
{
  "timeout": 10000,
  "urgency": {
    "permission": "critical",
    "session": "critical",
    "error": "critical"
  }
}
```

### Custom messages

```json
{
  "messages": {
    "permission": "🔐 Permission Request",
    "session": "✅ Done!",
    "error": "❌ Failed"
  }
}
```

## Troubleshooting

### Notifications not appearing

1. **Check notify-send is available:**
   ```bash
   which notify-send
   ```

2. **Check notification daemon is running:**
   ```bash
   # For dunst:
   ps aux | grep dunst
   
   # If not running, start it:
   dunst &
   ```

3. **Test notify-send manually:**
   ```bash
   notify-send -u critical "Test" "Hello from OpenCode"
   ```

4. **Check OpenCode logs** for errors:
   ```bash
   # OpenCode plugin errors will appear in console output
   opencode 2>&1 | grep -i notification
   ```

### Custom configuration not loading

1. Ensure `~/.config/opencode/opencode-hyprland.json` exists
2. Verify JSON syntax: `cat ~/.config/opencode/opencode-hyprland.json | jq .`
3. Check file permissions: `ls -la ~/.config/opencode/opencode-hyprland.json`

## How It Works

1. Plugin subscribes to three event types:
   - `permission.updated` - When OpenCode requests a permission
   - `session.idle` - When a session completes
   - `session.error` - When a session encounters an error

2. For each event, extracts relevant information from event properties

3. Formats a notification message with the extracted data

4. Calls `notify-send` command with:
   - Title from configuration messages
   - Body with event details
   - Urgency level from configuration
   - Timeout from configuration

5. Silently fails if `notify-send` is not available

## Code

The plugin is TypeScript and uses the OpenCode Plugin API:

```typescript
export const HyprlandNotifierPlugin: Plugin = async ({ $, client, project, directory, worktree }) => {
  return {
    event: async ({ event }) => {
      // Handle events: permission.updated, session.idle, session.error
    }
  }
}
```

## Dependencies

- Built-in only - uses standard Node.js/Bun APIs (fs, path, os)
- No npm dependencies required
- Depends on system `notify-send` command (optional - fails gracefully if unavailable)

## Notes

- Notifications are non-critical - errors won't affect OpenCode operation
- If `notify-send` is not available, notifications silently fail
- Plugin is safe to use on systems without a notification daemon
- Works with any notification daemon that supports `notify-send` protocol
