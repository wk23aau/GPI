#!/usr/bin/env node
/**
 * xAPI REPL - Interactive control of Antigravity via CDP
 */
import { AntigravityClient } from './xapi.js';
import readline from 'readline';

const HELP = `
🎮 xAPI REPL Commands:

  Messaging:
    send <msg>   - Send message to chat
    
  Conversation:
    newchat      - New conversation (Ctrl+Shift+L)
    focus        - Focus chat (Ctrl+L)
    agent        - Trigger agent (Ctrl+Shift+I)
    switch <n>   - Switch to conversation #n
    list         - List conversations
    
  Agent Actions:
    accept       - Accept step (Alt+Enter)
    reject       - Reject step (Alt+Shift+Backspace)
    
  Navigation:
    nexthunk     - Next hunk (Alt+J)
    prevhunk     - Previous hunk (Alt+K)
    up/down      - Navigate picker
    
  Utility:
    enter        - Press Enter
    esc          - Press Escape
    tab          - Press Tab
    status       - Connection status
    help         - Show this help
    exit         - Quit REPL
    
  Any other input = evaluate as JavaScript
`;

async function main() {
    const client = new AntigravityClient();

    try {
        const target = await client.connect();

        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║  xAPI REPL - CDP-Based Antigravity Control                    ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝');
        console.log(`\n✓ Connected to: ${target.title?.substring(0, 50)}`);
        console.log(HELP);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.setPrompt('xapi> ');
        rl.prompt();

        rl.on('line', async (line) => {
            const input = line.trim();
            if (!input) {
                rl.prompt();
                return;
            }

            const [cmd, ...args] = input.split(' ');
            const cmdLower = cmd.toLowerCase();

            try {
                let result;

                switch (cmdLower) {
                    case 'exit':
                    case 'quit':
                        client.close();
                        process.exit(0);
                        break;

                    case 'help':
                        console.log(HELP);
                        break;

                    case 'send':
                        if (args.length === 0) {
                            console.log('Usage: send <message>');
                        } else {
                            await client.sendMessage(args.join(' '));
                            console.log('✓ Message sent');
                        }
                        break;

                    case 'accept':
                        await client.accept();
                        console.log('✓ Accept (Alt+Enter)');
                        break;

                    case 'reject':
                        await client.reject();
                        console.log('✓ Reject (Alt+Shift+Backspace)');
                        break;

                    case 'newchat':
                        await client.newChat();
                        console.log('✓ New chat (Ctrl+Shift+L)');
                        break;

                    case 'focus':
                        await client.focusChat();
                        console.log('✓ Focused (Ctrl+L)');
                        break;

                    case 'agent':
                        await client.triggerAgent();
                        console.log('✓ Agent triggered (Ctrl+Shift+I)');
                        break;

                    case 'switch':
                        if (args.length === 0) {
                            console.log('Usage: switch <index>');
                        } else {
                            const idx = parseInt(args[0], 10);
                            await client.switchConversation(idx);
                            console.log(`✓ Switched to #${idx}`);
                        }
                        break;

                    case 'list':
                        result = await client.listConversations();
                        if (result.ok && result.conversations) {
                            console.log('\n📋 Conversations:');
                            result.conversations.forEach((c, i) => {
                                console.log(`  ${i}: ${c.title || '(no title)'} | ${c.id}`);
                            });
                        } else {
                            console.log('Could not list:', result.error);
                        }
                        break;

                    case 'nexthunk':
                        await client.nextHunk();
                        console.log('✓ Next hunk (Alt+J)');
                        break;

                    case 'prevhunk':
                        await client.prevHunk();
                        console.log('✓ Prev hunk (Alt+K)');
                        break;

                    case 'up':
                        await client.pressKey('ArrowUp');
                        console.log('✓ ArrowUp');
                        break;

                    case 'down':
                        await client.pressKey('ArrowDown');
                        console.log('✓ ArrowDown');
                        break;

                    case 'enter':
                        await client.pressKey('Enter');
                        console.log('✓ Enter');
                        break;

                    case 'esc':
                        await client.escape();
                        console.log('✓ Escape');
                        break;

                    case 'tab':
                        await client.tab();
                        console.log('✓ Tab');
                        break;

                    case 'status':
                        result = client.status();
                        console.log(`Connected: ${result.connected}, Target: ${result.target}`);
                        break;

                    default:
                        // Evaluate as JavaScript
                        try {
                            result = await client.eval(input);
                            console.log(typeof result === 'object'
                                ? JSON.stringify(result, null, 2)
                                : result);
                        } catch (e) {
                            console.log('❌', e.message || e);
                        }
                }
            } catch (e) {
                console.log('❌ Error:', e.message || e);
            }

            rl.prompt();
        });

        rl.on('close', () => {
            client.close();
            process.exit(0);
        });

    } catch (e) {
        console.error('❌ Failed to connect:', e.message);
        console.log('\nIs Antigravity running with --remote-debugging-port=9222?');
        process.exit(1);
    }
}

main();
