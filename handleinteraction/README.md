# ⚡ Handle Interaction

**What it does:** Accepts or rejects commands that the AI wants to run.

## The Problem

When you're chatting with Antigravity and it wants to run a terminal command (like `npm install` or `git commit`), it asks for your permission first. Normally you click "Accept" or "Reject" in the UI.

This module lets you do that **programmatically** - from code!

---

## How it Works

1. You send a message asking the AI to run a command
2. The AI proposes the command (status = `WAITING`)
3. You find the `trajectoryId` and `stepIndex` from the trajectory
4. You call this script with `accept` or `reject`
5. The command runs (or doesn't)

---

## Step-by-Step Guide

### Step 1: Ask AI to run a command

```bash
node ../sendmessage/index.js <cascadeId> "Run this command: echo Hello"
```

### Step 2: Get the trajectoryId

The `trajectoryId` is NOT the same as `cascadeId`! You need to get it from the trajectory:

```bash
# Using Node.js:
node -e "const api=require('../api.js').default;(async()=>{
  const p=api.discoverPort();
  const c=api.loadConfig();
  const r=await api.getTrajectory(p,c.csrfToken,'<cascadeId>');
  console.log('trajectoryId:', r.data.trajectory.trajectoryId);
})();"
```

### Step 3: Find the stepIndex

Look at the trajectory to find which step has the `CORTEX_STEP_TYPE_RUN_COMMAND`:

```bash
node ../find-pending.js <cascadeId>
```

This shows something like:
```
⚡ Step 8: RUN_COMMAND
   Command: echo Hello
   Status: pending
```

The number after "Step" is your `stepIndex`.

### Step 4: Accept or Reject

```bash
# Accept the command
node index.js accept <cascadeId> <trajectoryId> <stepIndex> "command text"

# Reject the command
node index.js reject <cascadeId> <trajectoryId> <stepIndex>
```

---

## Real Example (Tested ✅)

```bash
# Send message asking to run echo
node ../sendmessage/index.js 45be14a5-e493-4b1a-bc58-e438bf7b10e1 "Run: echo Hello"

# Wait a few seconds for AI to propose command...

# Find trajectoryId
# Result: 5fee835b-fc96-42fe-8c1b-f781ef8178e5

# Find stepIndex (it was step 8)

# Accept the command
node index.js accept \
  45be14a5-e493-4b1a-bc58-e438bf7b10e1 \
  5fee835b-fc96-42fe-8c1b-f781ef8178e5 \
  8 \
  "echo Hello from cascade 1"

# Output:
# ✅ Command accepted!
```

---

## Understanding the IDs

| ID | What it is | Where to find it |
|----|------------|------------------|
| `cascadeId` | Unique ID for the conversation | From `listcascades` or URL |
| `trajectoryId` | Unique ID for the execution trace | From `trajectory.trajectoryId` |
| `stepIndex` | Which step in the trajectory (0-based) | From `find-pending.js` |

**Important:** `trajectoryId` ≠ `cascadeId`! They are different UUIDs.

---

## Technical Details

This uses the `HandleCascadeUserInteraction` endpoint:
```
POST /exa.language_server_pb.LanguageServerService/HandleCascadeUserInteraction
Content-Type: application/proto
```

The request is encoded in **protobuf** format (not JSON like other endpoints).

### Protobuf Structure

```
Field 4: cascadeId (string)
Field 2: trajectoryInfo (nested message)
  - Field 1: trajectoryId (string)
  - Field 2: stepIndex (int)
Field 5: actionDetails (nested message)
  - Field 1: actionType (int) - 1 = accept, 2 = reject
  - Field 2: command (string, for accept only)
  - Field 3: command (string, duplicate for accept)
```

---

## Warning ⚠️

Be careful! Accepting a command means it will **actually run** on your computer. Make sure you trust what the AI wants to execute before accepting.
