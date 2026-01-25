# 🔄 Retry

**What it does:** Retries a cascade after an error (like "Agent terminated due to error").

## The Problem

Sometimes the AI encounters an error and stops:
- "Agent terminated due to error"
- Model timeout
- Network issues

Normally you click "Retry" in the UI. This module does that programmatically!

---

## Usage

```bash
# Retry with default message ("Please continue where you left off.")
node index.js <cascadeId>

# Retry with custom message
node index.js <cascadeId> "Please try that again"

# Retry with the last message you sent
node index.js <cascadeId> --last
```

---

## Example

```bash
# The cascade had an error
node ../trajectory/index.js 4d78ef4b-2120-46b4-ad68-e9fd57685096
# Shows: ❌ ERROR STEPS (1)

# Retry it
node index.js 4d78ef4b-2120-46b4-ad68-e9fd57685096
```

Output:
```
🔗 Port: 57829
📍 Cascade: 4d78ef4b-2120-46b4-ad68-e9fd57685096
🔄 Retry message: "Please continue where you left off."

✅ Retry sent successfully!

The AI should now continue or try again.
```

---

## Options

| Flag | Description |
|------|-------------|
| (none) | Sends "Please continue where you left off." |
| `"message"` | Sends your custom message |
| `--last` | Finds and resends your last message from the conversation |

---

## When to Use --last

Use `--last` when:
- The AI was in the middle of doing something
- You want to restart the exact same task
- The AI crashed before completing your request

## When NOT to Use --last

Don't use `--last` if:
- The error was caused by the message itself
- You want to try a different approach

---

## How It Works

1. Connects to Antigravity
2. If `--last`, fetches trajectory and finds last `USER_INPUT` step
3. Sends the message using `SendUserCascadeMessage`
4. The AI receives it and continues
