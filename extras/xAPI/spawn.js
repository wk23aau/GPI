/**
 * xAPI Spawn - Spawn agents using CDP keyboard shortcuts
 * 
 * Uses xAPI to send task prompts via native keyboard simulation
 * instead of unreliable HTTP API messaging.
 * 
 * Usage:
 *   node spawn.js "Apply to jobs on Indeed"
 *   node spawn.js --newchat "Start fresh task"
 */
import { AntigravityClient } from './xapi.js';

const AGENT_PROMPT = `You are an autonomous browser automation agent.

## Your Tools

You have access to the CDP REPL terminal. Use send_command_input to execute commands.

### CDP REPL Commands (type these in the terminal):

**Navigation:**
- Page.navigate {"url":"https://example.com"}

**Get Page State:**
- __cdp.ui()        - Get clickable elements with coordinates
- __cdp.state()     - Get full page state
- __cdp.find("text") - Find element by text

**Click (requires BOTH events):**
- Input.dispatchMouseEvent {"type":"mousePressed","x":300,"y":400,"button":"left","clickCount":1}
- Input.dispatchMouseEvent {"type":"mouseReleased","x":300,"y":400,"button":"left"}

**Type Text:**
- Input.insertText {"text":"your text here"}

**Scroll:**
- window.scrollBy(0, 500)

## Workflow

1. Use __cdp.ui() to see the page elements
2. Find target element coordinates
3. Click using Input.dispatchMouseEvent (mousePressed + mouseReleased)
4. Verify action with __cdp.ui()
5. Repeat

## Rules

- Always check page state before and after actions
- Use exact coordinates from __cdp.find() or __cdp.ui()
- Handle errors gracefully and retry
- Report progress clearly`;

async function main() {
    const args = process.argv.slice(2);

    // Parse flags
    let newChat = false;
    if (args.includes('--newchat') || args.includes('-n')) {
        newChat = true;
        args.splice(args.findIndex(a => a === '--newchat' || a === '-n'), 1);
    }

    const task = args.join(' ') || 'Explore the current page and report what you see';

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  xAPI Spawn - CDP-Based Agent Launcher                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`📋 Task: ${task}`);
    console.log(`🆕 New Chat: ${newChat}`);
    console.log();

    const client = new AntigravityClient();

    try {
        // Connect to Antigravity
        const target = await client.connect();
        console.log(`✓ Connected to: ${target.title?.substring(0, 50)}`);

        // Open new chat if requested
        if (newChat) {
            console.log('📝 Opening new chat...');
            await client.newChat();
            await new Promise(r => setTimeout(r, 1000));
        }

        // Build the full message
        const fullMessage = `${AGENT_PROMPT}

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════

${task}

BEGIN NOW - Start by using __cdp.ui() to see the current page state.`;

        // Send the message via CDP
        console.log('📤 Sending task via CDP keyboard...');
        await client.sendMessage(fullMessage);

        console.log('✓ Task sent successfully!');
        console.log();
        console.log('The agent should now start working on the task.');
        console.log('Use "node repl.js" to monitor and control if needed.');

        client.close();

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.log('\nIs Antigravity running with --remote-debugging-port=9222?');
        process.exit(1);
    }
}

main();
