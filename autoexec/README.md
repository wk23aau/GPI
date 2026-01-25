# ⚡ AutoExec

**What it does:** Send messages with control over whether commands run automatically or need your approval.

## The Problem

Normally when the AI wants to run a command like `npm install`, it asks you first. But sometimes you want to:
- Let safe commands run automatically
- Let ALL commands run automatically (be careful!)
- Use a different AI model

---

## Usage

```bash
# Default: Ask before running commands
node index.js <cascadeId> "Install lodash"

# Auto-run safe commands (like `ls` or `cat`)
node index.js <cascadeId> "List my files" --auto

# Auto-run ALL commands (dangerous!)
node index.js <cascadeId> "Build the project" --turbo

# Use a specific model
node index.js <cascadeId> "Write code" --model opus
```

---

## Execution Modes

| Flag | Mode | What happens |
|------|------|--------------|
| (none) | OFF | You approve every command |
| `--auto` | SAFE_ONLY | Safe commands run automatically |
| `--turbo` | ALL | ALL commands run automatically ⚠️ |

### What's a "safe" command?

Safe commands are things like:
- `ls`, `dir` - List files
- `cat`, `type` - Show file contents
- `echo` - Print text
- `pwd` - Show current directory

**Unsafe** commands (always ask) include:
- `rm`, `del` - Delete files
- `npm install` - Install packages
- `git push` - Push code
- Anything that changes files or system

---

## Available Models

| Model | Description |
|-------|-------------|
| `M12` | Default model (good balance) |
| `M13` | Newer model |
| `opus` | Claude Opus 4.5 (most capable) |
| `sonnet` | Claude 3.5 Sonnet (faster) |

---

## Example

```bash
# Use Claude Opus with auto-execution
node index.js cf174549-2581-4c24-b82b-a4115c015cea "Analyze this code" --model opus --auto
```

Output:
```
🔗 Port: 57829
📍 Cascade: cf174549-2581-4c24-b82b-a4115c015cea
📝 Message: "Analyze this code..."
📌 Execution: AUTO
🤖 Model: opus

✅ Message sent with custom config!
```

---

## ⚠️ WARNING about Turbo Mode

When you use `--turbo`:
- The AI can run ANY command without asking you
- This includes `rm -rf`, `git push`, `npm publish`, etc.
- Only use this if you trust what you're asking for
- The AI may make mistakes!

```bash
# DON'T do this unless you really mean it:
node index.js <id> "Delete all temporary files" --turbo
# 😱 This could delete important files!
```

---

## How It Works

Behind the scenes, this sends `cascadeConfig` with your settings:

```javascript
cascadeConfig: {
    plannerConfig: {
        toolConfig: {
            runCommand: {
                autoCommandConfig: {
                    autoExecutionPolicy: 'CASCADE_COMMANDS_AUTO_EXECUTION_SAFE_ONLY'
                }
            }
        },
        requestedModel: {
            model: 'claude-opus-4-20250514'
        }
    }
}
```
