# GPI - Gravity Protocol Interface

Antigravity Chat API client.

## Setup

1. Copy `.env.example` to `.env`
2. Get CSRF token from DevTools Network tab (`x-codeium-csrf-token` header)
3. Update `.env` with your CSRF token

## Usage

```bash
# Send a message to a conversation
node send.js <cascadeId> "Your message"

# Example
node send.js b02157cf-fa4b-41e8-a299-c2e0a8c42c8e "Hello from API!"
```

## API

```javascript
import api from './api.js';

const port = api.discoverPort();
const config = api.loadConfig();

// Send message
await api.sendMessage(port, config.csrfToken, cascadeId, "Hello!");

// Get conversation history  
await api.getTrajectory(port, config.csrfToken, cascadeId);

// Start new conversation
await api.startCascade(port, config.csrfToken);
```
