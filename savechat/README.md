# 💾 SaveChat - Backup & Restore Conversations

**What it does:** Backs up all your Antigravity conversations and brain artifacts to a zip file with a one-click restore script.

## Quick Start

```bash
# Backup ALL conversations
cd GPI/savechat && node index.js

# Backup specific conversation
node index.js cf174549-2581-4c24-b82b-a4115c015cea

# List available conversations
node index.js --list

# Watch mode - backup every 5 minutes continuously
node index.js --watch
```

---

## What Gets Backed Up

| Location | Content |
|----------|---------|
| `~/.gemini/antigravity/conversations/*.pb` | Conversation data |
| `~/.gemini/antigravity/brain/<cascadeId>/` | Artifacts, task.md, plans |

---

## Backup Output

Creates: `backups/gpi-backup-2026-01-25T17-45-00.zip`

**Contents:**
```
gpi-backup-2026-01-25T17-45-00/
├── conversations/
│   ├── cf174549-2581-4c24-b82b-a4115c015cea.pb
│   └── ...
├── brain/
│   ├── cf174549-2581-4c24-b82b-a4115c015cea/
│   │   ├── task.md
│   │   ├── implementation_plan.md
│   │   └── walkthrough.md
│   └── ...
├── manifest.json
└── restore.bat (or restore.sh on Mac/Linux)
```

---

## Restore

1. Extract the zip file anywhere
2. Run `restore.bat` (Windows) or `./restore.sh` (Mac/Linux)
3. Conversations and brain artifacts are restored to their original locations

---

## Examples

### Backup All
```bash
node index.js

# Output:
# 📦 Creating backup: gpi-backup-2026-01-25T17-45-00
# 📄 cf174549... (105.9 KB)
#    🧠 3 brain artifact(s)
# 📄 b68dd658... (23.4 KB)
# ✅ Backup complete!
# 📁 Location: backups/gpi-backup-2026-01-25T17-45-00.zip
```

### Backup Specific Conversations
```bash
node index.js cf174549-2581-4c24-b82b-a4115c015cea b68dd658-d8e6-428b-a7fd-c15b90286364
```

### List Conversations
```bash
node index.js --list

# Output:
# 📋 Found 27 conversation(s):
# 📌 cf174549-2581-4c24-b82b-a4115c015cea
#    105.9 KB | 1/25/2026 5:14:05 PM
#    🧠 3 brain artifact(s)
```

---

## Manifest

Each backup includes `manifest.json`:
```json
{
  "created": "2026-01-25T17:45:00.000Z",
  "conversations": [
    {
      "cascadeId": "cf174549-2581-4c24-b82b-a4115c015cea",
      "modified": "2026-01-25T09:14:05.472Z",
      "sizeKB": "105.9"
    }
  ],
  "totalFiles": 15,
  "totalSizeKB": "450.2"
}
```
