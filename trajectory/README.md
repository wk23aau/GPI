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

# Show only error steps (failed/timeout)
node index.js <cascadeId> --errors

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

## Step Types (Complete List)

All step types observed in Antigravity trajectories:

### User & AI Communication
| Code | Icon | Description |
|------|------|-------------|
| `USER_INPUT` | 👤 | Your message to the AI |
| `PLANNER_RESPONSE` | 🤖 | AI's text response to user |
| `NOTIFY_USER` | 📢 | Message/notification to show user |
| `EPHEMERAL_MESSAGE` | � | System/internal message |

### Code & Files
| Code | Icon | Description |
|------|------|-------------|
| `CODE_ACTION` | ✏️ | File edit (replace_file_content, multi_replace_file_content) |
| `FILE_WRITE` | 💾 | Create new file (write_to_file) |
| `VIEW_FILE` | 👁️ | View file contents |
| `VIEW_FILE_OUTLINE` | � | View file structure/outline |
| `VIEW_CODE_ITEM` | 🔎 | View specific code item (function, class) |

### Terminal & Commands
| Code | Icon | Description |
|------|------|-------------|
| `RUN_COMMAND` | � | Execute terminal command |
| `COMMAND_STATUS` | ⏳ | Check status of running command |
| `SEND_COMMAND_INPUT` | ⌨️ | Send input to running command |
| `READ_TERMINAL` | � | Read terminal output |

### Search & Navigation
| Code | Icon | Description |
|------|------|-------------|
| `SEARCH` | 🔍 | Codebase search |
| `GREP_SEARCH` | 🔎 | Text search in files |
| `FIND_BY_NAME` | 📂 | Find files by name pattern |
| `LIST_DIR` | � | List directory contents |

### Browser & Web
| Code | Icon | Description |
|------|------|-------------|
| `BROWSER_SUBAGENT` | 🌐 | Browser automation task |
| `BROWSER_SCREENSHOT` | � | Capture browser screenshot |
| `READ_URL_CONTENT` | 🔗 | Fetch URL content |
| `SEARCH_WEB` | 🌍 | Web search |

### Task Management
| Code | Icon | Description |
|------|------|-------------|
| `TASK_BOUNDARY` | � | Task start/update/mode change |
| `GENERATE_IMAGE` | 🎨 | Generate image with AI |

---

## Step Statuses

| Status | Icon | Meaning |
|--------|------|---------|
| `DONE` | ✅ | Completed successfully |
| `WAITING` | ⏳ | Waiting for user action (accept/reject) |
| `RUNNING` | 🔄 | Currently executing |
| `ERROR` | ❌ | Failed with error |
| `CANCELED` | 🚫 | Canceled by user |

---

## Trajectory Types

| Type | Description |
|------|-------------|
| `CORTEX_TRAJECTORY_TYPE_CASCADE` | Main conversation trajectory |
| `CORTEX_TRAJECTORY_TYPE_EXTENSION` | Extension-related trajectory |

---

## Cascade Run Statuses

| Status | Description |
|------|-------------|
| `CASCADE_RUN_STATUS_IDLE` | Cascade is idle, waiting for input |
| `CASCADE_RUN_STATUS_STREAMING` | AI is currently generating response |
| `CASCADE_RUN_STATUS_BLOCKED` | Blocked waiting for user interaction |
| `CASCADE_RUN_STATUS_COMPLETED` | Cascade has completed |

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

## Step Metadata Fields

Each step contains metadata with useful info:

| Field | Description |
|-------|-------------|
| `createdAt` | When the step was created |
| `viewableAt` | When the step became visible |
| `finishedGeneratingAt` | When generation completed |
| `source` | Who created the step (USER_EXPLICIT, MODEL) |
| `toolCall.id` | Unique ID for this tool call |
| `toolCall.name` | Name of the tool being called |
| `toolCall.argumentsJson` | Arguments passed to the tool |

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
- `trajectory.trajectoryType` - Type of trajectory
- `trajectory.steps[]` - Array of all steps
- `status` - Current cascade run status
- `numTotalSteps` - Total number of steps

