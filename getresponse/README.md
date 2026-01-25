# 📥 Get Response

**What it does:** Fetches the conversation history including the AI's responses.

## How it works

1. You give it a conversation ID
2. It calls `GetCascadeTrajectory` to fetch the full conversation
3. It parses the "trajectory" (history of all messages)
4. It shows you what the user said and what the AI replied

## Usage

```bash
node index.js <cascadeId>
```

## Example

```bash
node index.js 42626f2b-e3ef-416c-aaaf-fa3b9d4a2188
```

Output:
```
🔗 Port: 57829
📍 Cascade: 42626f2b-e3ef-416c-aaaf-fa3b9d4a2188
📥 Fetching response...

Found 2 steps:

👤 USER:
   Hello! This is my first message.

🤖 AI:
   Hello! How can I help you today?
```

## Why do we need this?

When you send a message with `sendmessage`, you only get "Message sent!" as confirmation. The AI's actual response comes through a separate streaming channel. This module reads the saved conversation to get the full response.
