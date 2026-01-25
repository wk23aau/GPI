# 📊 Trajectory

**What it does:** Shows complete details of a conversation's trajectory (execution history).

## What's a Trajectory?

When you chat with Antigravity, every action is recorded as a "step" in the trajectory:
- Your messages
- AI responses
- Commands the AI wants to run
- Files it edits
- Screenshots it takes
- etc.

This module lets you see all of that!

---

## Usage

```bash
# Show summary with recent steps
node index.js <cascadeId>

# Show ALL steps with full details
node index.js <cascadeId> --full

# Show only pending steps (waiting for user action)
node index.js <cascadeId> --pending

# Show raw JSON response
node index.js <cascadeId> --raw
```

---

## Example Output

```
🔗 Port: 57829
📍 Cascade: 45be14a5-e493-4b1a-bc58-e438bf7b10e1

════════════════════════════════════════════════════════════
TRAJECTORY INFO
════════════════════════════════════════════════════════════
Trajectory ID: 5fee835b-fc96-42fe-8c1b-f781ef8178e5
Cascade ID:    45be14a5-e493-4b1a-bc58-e438bf7b10e1
Type:          CORTEX_TRAJECTORY_TYPE_CASCADE
Total Steps:   9
Status:        CORTEX_CASCADE_STATUS_STREAMING

════════════════════════════════════════════════════════════
STEP TYPE COUNTS
════════════════════════════════════════════════════════════
  PLANNER_RESPONSE: 3
  USER_INPUT: 2
  RUN_COMMAND: 2
  EPHEMERAL_MESSAGE: 2

════════════════════════════════════════════════════════════
⏳ PENDING STEPS (1)
════════════════════════════════════════════════════════════
⏳ [8] 💻 RUN_COMMAND 15:09:46
      Command: echo Hello from cascade 1
      Cwd: c:\Users\wk23aau\Documents\ai-studio-network
```

---

## Step Types

| Code | Icon | Description |
|------|------|-------------|
| `USER_INPUT` | 👤 | Your message to the AI |
| `PLANNER_RESPONSE` | 🤖 | AI's text response |
| `RUN_COMMAND` | 💻 | Terminal command to execute |
| `CODE_ACTION` | ✏️ | File edit/creation |
| `NOTIFY_USER` | 📢 | Message to show user |
| `EPHEMERAL_MESSAGE` | 💭 | System message |
| `TASK_BOUNDARY` | 📋 | Task start/update |
| `BROWSER_SCREENSHOT` | 📸 | Browser screenshot |
| `BROWSER_SUBAGENT` | 🌐 | Browser automation |
| `VIEW_FILE` | 👁️ | File viewing |
| `COMMAND_STATUS` | ⏳ | Command progress check |
| `SEARCH` | 🔍 | Code/file search |
| `FILE_WRITE` | 💾 | File write operation |

---

## Step Statuses

| Status | Icon | Meaning |
|--------|------|---------|
| `DONE` | ✅ | Completed successfully |
| `WAITING` | ⏳ | Waiting for user action |
| `RUNNING` | 🔄 | Currently executing |
| `ERROR` | ❌ | Failed |

---

## Finding Pending Commands

If there are steps with status `WAITING` (like run_command), the output will show:

```
Commands:
  Accept pending: node ../handleinteraction/index.js accept <cascadeId> <trajectoryId> <stepIndex> "command"
  Reject pending: node ../handleinteraction/index.js reject <cascadeId> <trajectoryId> <stepIndex>
```

Just copy and run to accept or reject!

---

## Technical Details

This calls the `GetCascadeTrajectory` endpoint:
```
POST /exa.language_server_pb.LanguageServerService/GetCascadeTrajectory
Content-Type: application/json
Body: { "cascadeId": "..." }
```

The response contains:
- `trajectory.trajectoryId` - Unique ID for this execution trace
- `trajectory.cascadeId` - The conversation ID
- `trajectory.steps[]` - Array of all steps
- `status` - Current cascade status
