# OpenCode Hyprland Notifier Plugin

A self-contained OpenCode plugin that sends desktop notifications via `notify-send` for permission requests, session completions, and errors. Works with Hyprland and any Linux desktop environment.

[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-plugin-brightgreen)](https://opencode.ai/docs/plugins/)

## Features

- **Permission Requests** - Critical urgency notifications when OpenCode needs user input
- **Session Completion** - Normal urgency notifications with file change details
- **Session Errors** - Critical urgency notifications with error context
- **Fully Configurable** - Customize messages, icons, urgency, and timeouts
- **Zero Dependencies** - Single self-contained TypeScript file

## Installation

### Option 1: Copy to Plugin Directory (Recommended)

```bash
# Clone the repository
git clone https://github.com/lprior-repo/opencode-hypr-notifier.git

# Copy the plugin to your global OpenCode config
cp opencode-hypr-notifier/src/hypr-notifier.ts ~/.config/opencode/plugin/
```

### Option 2: npm Package

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-hypr-notifier"]
}
```

Then OpenCode will install it automatically on startup.

## System Requirements

- **notify-send** installed:
  - Debian/Ubuntu: `sudo apt install libnotify-bin`
  - Arch: `sudo pacman -S libnotify`
  - Fedora: `sudo dnf install libnotify`
- **Notification daemon** running (dunst, mako, swaync, etc.)
- **OpenCode 1.0+**

## Configuration

Create `~/.config/opencode/opencode-hyprland.json`:

```json
{
  "notification": true,
  "timeout": 15000,
  "transient": false,
  "urgency": {
    "permission": "critical",
    "session": "normal",
    "error": "critical"
  },
  "messages": {
    "permission": "OpenCode Needs Your Attention",
    "session": "OpenCode Session Idle",
    "error": "OpenCode Error"
  },
  "icons": {
    "permission": "dialog-password",
    "session": "emblem-ok-symbolic",
    "error": "dialog-error-symbolic"
  },
  "category": {
    "permission": "im.received",
    "session": "im.received",
    "error": "im.error"
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `notification` | boolean | `true` | Enable/disable all notifications |
| `timeout` | number | `15000` | Notification display time in ms |
| `transient` | boolean | `false` | If true, notification won't persist in history |
| `urgency.*` | string | varies | `"low"`, `"normal"`, or `"critical"` |
| `messages.*` | string | varies | Notification title for each event type |
| `icons.*` | string | varies | Icon name for each event type |
| `category.*` | string | varies | Notification category hint |

## Usage

Just start OpenCode - the plugin loads automatically:

```bash
opencode
```

### Example Notifications

**Permission Request:**
```
OpenCode Needs Your Attention
Type: network
Action: Make HTTP Request
Resource: api.example.com
Session: sess_abc123
```

**Session Complete:**
```
OpenCode Session Idle
Session: sess_abc123
Title: Refactor authentication module
Files changed: 4
Additions: +250
Deletions: -120
```

**Error Alert:**
```
OpenCode Error
Session: sess_xyz789
Error: ProviderAuthError
Message: Invalid API key
```

## Supported Events

| Event | Trigger | Default Urgency |
|-------|---------|-----------------|
| `permission.updated` | OpenCode requests permission | Critical |
| `session.idle` | Session becomes idle | Normal |
| `session.updated` | Session updates | Normal |
| `session.complete` | Session completes | Normal |
| `task.complete` | Task completes | Normal |
| `session.error` | Error occurs | Critical |

## Troubleshooting

### Notifications Not Appearing

1. Check notify-send is installed:
   ```bash
   which notify-send
   ```

2. Test notify-send manually:
   ```bash
   notify-send "Test" "Hello" -u critical -t 5000
   ```

3. Check your notification daemon is running:
   ```bash
   # For dunst
   ps aux | grep dunst
   
   # Start if needed
   dunst &
   ```

### Plugin Not Loading

1. Check OpenCode logs:
   ```bash
   opencode --print-logs
   ```

2. Verify plugin file exists:
   ```bash
   ls ~/.config/opencode/plugin/hypr-notifier.ts
   ```

## Development

```bash
# Clone
git clone https://github.com/lprior-repo/opencode-hypr-notifier.git
cd opencode-hypr-notifier

# Install dependencies
bun install

# Type check
bun run typecheck

# Run tests
bun test
```

### Project Structure

```
opencode-hypr-notifier/
├── src/
│   └── hypr-notifier.ts    # Self-contained plugin (single file)
├── __tests__/              # Test suite
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- [OpenCode](https://opencode.ai) - The open source AI coding agent
- [OpenCode Plugins Documentation](https://opencode.ai/docs/plugins/)
- [GitHub Repository](https://github.com/lprior-repo/opencode-hypr-notifier)
