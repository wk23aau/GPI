# 🌐 Send With URL

**What it does:** Fetches a webpage or file from the internet and sends it to the AI!

Like copying a webpage and pasting it into the chat - but automatic!

---

## How to Use

```bash
# Send a URL with a custom message
node index.js <cascadeId> <url> "What do you think of this?"

# Send a URL with default message
node index.js <cascadeId> <url>
```

## Example

```bash
node index.js abc-123 https://raw.githubusercontent.com/user/repo/main/file.js "Review this"
```

The AI will see the actual content from that URL, formatted nicely!

---

## Great For

- Sharing GitHub files
- Showing documentation pages
- Including online resources in your chat
