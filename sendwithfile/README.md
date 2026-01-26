# 📁 Send With File

**What it does:** Sends a message to the AI with a file's content included!

Think of it like attaching a photo to a text message - but instead of a photo, it's code or text.

---

## How to Use

```bash
# Send a file with a custom message
node index.js <cascadeId> <filePath> "Check this out!"

# Send a file with default message
node index.js <cascadeId> <filePath>
```

## Example

```bash
node index.js abc-123 ./mycode.js "What does this code do?"
```

The AI will see:
```
What does this code do?

**mycode.js:**
```js
function hello() {
    console.log("Hi!");
}
```

---

## Why Use This?

- Share code files without copy-pasting
- Get the AI to review your files
- Include context automatically
