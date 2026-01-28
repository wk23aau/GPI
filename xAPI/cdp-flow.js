/**
 * CDP Flow - Hybrid Automation
 * 
 * 1. New chat via Ctrl+Shift+L (keys)
 * 2. Send prompt via keys
 * 3. Poll for pending requests via API
 * 4. Accept via Alt+Enter (keys)
 */
import AntigravityClient from './xapi.js';
import api from '../api.js';

const PROMPT = `Execute these commands in order:

1. Start Chrome with remote debugging:
\`\`\`bash
Start-Process "chrome.exe" -ArgumentList "--remote-debugging-port=9223"
\`\`\`

2. Start CDP REPL:
\`\`\`bash
cd c:\\Users\\wk23aau\\Documents\\GPI\\extras\\TEAM && node index.js
\`\`\`

Run both commands. The first starts Chrome with debug port 9223, the second starts the CDP REPL to control Chrome.`;

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  CDP Flow - Hybrid Automation');
    console.log('═══════════════════════════════════════════════════════════════');

    // Connect to Antigravity via CDP
    const client = new AntigravityClient(9222);

    try {
        await client.connect();
        console.log('✓ Connected to Antigravity CDP');
    } catch (err) {
        console.error('❌ Failed to connect to Antigravity CDP:', err.message);
        console.log('\nMake sure Antigravity is running with:');
        console.log('  & "$env:LOCALAPPDATA\\Programs\\Antigravity\\Antigravity.exe" --remote-debugging-port=9222');
        process.exit(1);
    }

    // Get API port and config
    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port || !config?.csrfToken) {
        console.error('❌ GPI API not configured (need port and CSRF token)');
        process.exit(1);
    }

    console.log(`✓ API port: ${port}`);

    // Step 1: Create new chat via Ctrl+Shift+L
    console.log('\n📝 Step 1: Creating new chat (Ctrl+Shift+L)...');
    await client.newChat();
    await sleep(3000);  // Wait longer for UI to settle
    console.log('✓ New chat created');

    // Step 2: Send prompt via keys (input is already focused after newChat)
    console.log('\n📤 Step 2: Sending prompt...');
    await client.sendMessage(PROMPT);
    await sleep(3000);
    console.log('✓ Prompt sent');

    // Step 3: Poll and accept pending tasks via Alt+Enter
    console.log('\n🔄 Step 3: Polling and accepting pending tasks...');
    console.log('   (Pressing Alt+Enter every 3s to accept any pending commands)');

    const maxPolls = 20;
    let accepted = 0;

    for (let i = 0; i < maxPolls; i++) {
        await sleep(3000);

        // Press Alt+Enter to accept any pending step
        console.log(`  Poll ${i + 1}/${maxPolls}: Pressing Alt+Enter...`);
        await client.accept();
        accepted++;

        // If we've sent enough accepts for the expected commands, we can stop
        if (accepted >= 4) {  // Allow some extra for safety
            console.log('\n✓ Sent enough accepts');
            break;
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`  Complete! Sent ${accepted} accept(s)`);
    console.log('═══════════════════════════════════════════════════════════════');

    client.close();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
