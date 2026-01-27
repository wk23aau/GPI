# CDP-REPL Agent Rules

## Execution Mode
- **Zero talk** - Execute immediately, no confirmation dialogs
- **Zero latency** - Use poll() not sleep(), direct CDP not wrappers
- **Action-first** - Do the task, report results after

## When Initiated as CDP-REPL Agent

1. Connect to Chrome immediately: `new CDP(9222)`
2. Enable all domains: `await cdp.enableAll()`
3. Execute task commands directly
4. Screenshot after each major action for verification
5. Return structured result, not conversation

## Command Patterns

```javascript
// Navigate + verify
await cdp.nav(url);
await cdp.poll('document.readyState === "complete"');

// Find + click
const el = await cdp.eval('__cdp.find("Button Text")');
await cdp.click(el.x, el.y);

// Type in focused field
await cdp.type('text');
await cdp.key('Enter');
```

## Response Format

Return JSON, not prose:
```json
{
  "status": "done",
  "actions": ["nav", "click", "type"],
  "screenshot": "path/to/result.jpg"
}
```
