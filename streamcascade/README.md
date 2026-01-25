# 📡 Stream Cascade

**What it does:** Shows the AI's response in real-time, as it types!

## Why is this different from getresponse?

Think of it like this:

| Module | How it works | Like... |
|--------|--------------|---------|
| `getresponse` | Waits for AI to finish, then gets everything at once | Reading a completed essay |
| `streamcascade` | Shows text as AI generates it, word by word | Watching someone type live |
| `trajectory` | Shows history of ALL steps (commands, files, etc.) | Reading a diary of everything that happened |

**streamcascade** is like watching a live stream! You see things as they happen.

---

## Usage

```bash
# Stream for 10 seconds (default)
node index.js <cascadeId>

# Stream for 30 seconds
node index.js <cascadeId> 30

# Show raw data chunks
node index.js <cascadeId> --raw
```

---

## How to Use It

1. **Send a message to start the AI**
   ```bash
   node ../sendmessage/index.js <cascadeId> "Write me a poem"
   ```

2. **Immediately start streaming**
   ```bash
   node index.js <cascadeId>
   ```

3. **Watch the response appear word by word!**

---

## Example Output

```
🔗 Port: 57829
� Streaming from cf174549-2581-4c24-b82b-a4115c015cea...
   Duration: 5s
   Status: 200

The sun rises slowly over the hills...
Golden light spreads across the valley...

📌 [RUN_COMMAND]

⏱️ Timeout reached
✅ Stream complete: 543 chunks
```

---

## What You'll See

| Symbol | Meaning |
|--------|---------|
| `📡 Streaming...` | Stream started |
| (text) | AI's response appearing live |
| `📌 [TYPE]` | A step happened (command, file edit, etc.) |
| `⏱️ Timeout reached` | Time's up |
| `✅ Stream complete` | Done! |

---

## When to use which module?

| I want to... | Use this |
|--------------|----------|
| See AI response after it's done | `getresponse` |
| Watch AI response as it types | `streamcascade` |
| See everything that happened (history) | `trajectory` |
| Check if there are errors | `trajectory --errors` |
| Check if AI is waiting for me | `trajectory --pending` |

---

## Technical Details

This uses a special streaming protocol called **Connect**:

```
POST /exa.language_server_pb.LanguageServerService/StreamCascadeReactiveUpdates
Content-Type: application/connect+proto
```

The request is encoded in **protobuf** format (binary, not JSON) with:
- `subscribe: true` - We want live updates
- `cascadeId` - Which conversation to stream
- `channel: 'chat-client-trajectories'` - The data stream to listen to

---

## Limitations

- Only shows updates AFTER you start streaming
- Has a timeout (default 10 seconds, max ~60 seconds)
- The cascade must be actively generating something
