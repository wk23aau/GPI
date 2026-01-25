# 🐝 Swarm

**What it does:** Talk to multiple AI agents at once! Send one message, get responses from all.

## What's a Swarm?

Imagine you have 3 friends and you want to ask them all the same question. Instead of asking each one individually, you shout the question and they all answer at the same time. That's a swarm!

---

## Quick Start

```bash
cd GPI/swarm
node index.js --new 2
```

This creates 2 new agents and opens the interactive prompt.

---

## Tested Working Example ✅

```
🔗 Port: 57829

🐝 INITIALIZING SWARM
Creating 2 new agents...

✅ Swarm initialized with 2 agents:
   1. Agent-1: b615b002...
   2. Agent-2: 3dca59c8...

🐝 Swarm> What is 2+2? Reply with just the number.

📤 Sending to 2 agents: "What is 2+2?..."

   ✅ Agent-1
   ✅ Agent-2

⏳ Waiting 8s for responses...

════════════════════════════════════════════════════════════
RESPONSES (2/2 agents)
════════════════════════════════════════════════════════════

🤖 Agent-1 (b615b002...):
────────────────────────────────────────
4

🤖 Agent-2 (3dca59c8...):
────────────────────────────────────────
4
```

---

## Usage

```bash
# Start with 2 new agents (default)
node index.js

# Start with 3 new agents
node index.js --new 3

# Start with existing cascades
node index.js <cascadeId1> <cascadeId2>
```

---

## Interactive Commands

| Command | What it does |
|---------|--------------|
| `/list` | Show all agents in the swarm |
| `/new` | Create a new agent |
| `/add <id>` | Add existing cascade to swarm |
| `/wait 15` | Set wait time to 15 seconds |
| `/exit` | Exit swarm mode |
| `<message>` | Send message to ALL agents |

---

## Tips

- **No responses?** Use `/wait 15` to increase wait time to 15 seconds
- **New agents** need a few seconds to warm up before responding
- **Full cascade IDs** are needed when using `/add` (not truncated ones)

---

## Troubleshooting (What Went Wrong & How We Fixed It)

### Problem 1: "RESPONSES (0/2 agents)" - No responses!

**What happened:**
```
⏳ Waiting 5s for responses...

RESPONSES (0/2 agents)
════════════════════════════════════════════════════════════

⚠️ No responses yet.
```

**Why it happened:**
- The wait time (5 seconds) wasn't enough
- New agents need time to "wake up" before replying

**How we fixed it:**
- Increased default wait from 5s to 8s
- Added `/wait 15` command so you can increase wait time yourself

---

### Problem 2: "❌ Agent-1" - Send failed!

**What happened:**
```
📤 Sending to 2 agents...
   ❌ Agent-1
   ❌ Agent-2
```

**Why it happened:**
- We used truncated cascade IDs like `2a3c467d...` instead of full IDs
- The API needs the complete UUID

**How we fixed it:**
- Use `--new` to create fresh agents (they use correct full IDs)
- If using `/add`, paste the COMPLETE cascade ID

---

### Problem 3: Empty responses section

**What happened:**
```
RESPONSES
════════════════════════════════════════════════════════════
(nothing here!)
```

**Why it happened:**
- The agents sent messages but hadn't finished responding yet

**How we fixed it:**
- Added response count `(2/2 agents)` so you know how many responded
- Added warning message when no responses are found

---

## How It Works

```
You: "What is AI?"
     ↓
  ┌──────────┐
  │  Agent-1 │ → "AI is..."
  │  Agent-2 │ → "Artificial..."
  │  Agent-3 │ → "AI stands..."
  └──────────┘
```

1. **Initialize** - Creates or connects to multiple cascades
2. **Send** - Uses `api.sendMessage()` to all agents in parallel
3. **Wait** - Default 8 seconds for agents to respond
4. **Collect** - Uses `api.getTrajectory()` to get each response
5. **Display** - Shows all responses together
