#!/usr/bin/env node
/**
 * xAPI CLI - Command-line interface for Antigravity control
 * 
 * Usage:
 *   node index.js send "Hello world"
 *   node index.js accept
 *   node index.js reject
 *   node index.js newchat
 *   node index.js switch 2
 *   node index.js list
 */
import { AntigravityClient } from './xapi.js';

const USAGE = `
╔═══════════════════════════════════════════════════════════════╗
║  xAPI - CDP-Based Antigravity Control                         ║
╚═══════════════════════════════════════════════════════════════╝

Usage: node index.js <command> [args]

Commands:
  send <message>    Send a message to chat
  accept            Accept agent step (Alt+Enter)
  reject            Reject agent step (Alt+Shift+Backspace)
  newchat           Open new conversation (Ctrl+Shift+L)
  focus             Focus chat input (Ctrl+L)
  agent             Trigger agent mode (Ctrl+Shift+I)
  switch <n>        Switch to conversation #n
  list              List conversations with IDs
  nexthunk          Navigate to next hunk (Alt+J)
  prevhunk          Navigate to previous hunk (Alt+K)
  status            Show connection status

Examples:
  node index.js send "Fix the login bug"
  node index.js accept
  node index.js switch 0
`;

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
        console.log(USAGE);
        process.exit(0);
    }

    const command = args[0].toLowerCase();
    const client = new AntigravityClient();

    try {
        const target = await client.connect();
        console.log(`✓ Connected to: ${target.title?.substring(0, 50)}`);

        let result;

        switch (command) {
            case 'send':
                if (args.length < 2) {
                    console.error('❌ Usage: send <message>');
                    process.exit(1);
                }
                const message = args.slice(1).join(' ');
                result = await client.sendMessage(message);
                console.log(`✓ Sent: "${message}"`);
                break;

            case 'accept':
                result = await client.accept();
                console.log('✓ Accept command sent (Alt+Enter)');
                break;

            case 'reject':
                result = await client.reject();
                console.log('✓ Reject command sent (Alt+Shift+Backspace)');
                break;

            case 'newchat':
                result = await client.newChat();
                console.log('✓ New chat opened (Ctrl+Shift+L)');
                break;

            case 'focus':
                result = await client.focusChat();
                console.log('✓ Chat focused (Ctrl+L)');
                break;

            case 'agent':
                result = await client.triggerAgent();
                console.log('✓ Agent triggered (Ctrl+Shift+I)');
                break;

            case 'switch':
                if (args.length < 2) {
                    console.error('❌ Usage: switch <index>');
                    process.exit(1);
                }
                const index = parseInt(args[1], 10);
                result = await client.switchConversation(index);
                console.log(`✓ Switched to conversation #${index}`);
                break;

            case 'list':
                result = await client.listConversations();
                if (result.ok && result.conversations) {
                    console.log('\n📋 Conversations:\n');
                    result.conversations.forEach((c, i) => {
                        console.log(`  ${i}: ${c.title || '(untitled)'}`);
                        console.log(`     ${c.id}`);
                    });
                } else {
                    console.log('❌ Could not list conversations:', result.error);
                }
                break;

            case 'nexthunk':
                result = await client.nextHunk();
                console.log('✓ Next hunk (Alt+J)');
                break;

            case 'prevhunk':
                result = await client.prevHunk();
                console.log('✓ Previous hunk (Alt+K)');
                break;

            case 'status':
                result = client.status();
                console.log('\n📊 Status:');
                console.log(`  Connected: ${result.connected}`);
                console.log(`  Port: ${result.port}`);
                console.log(`  Target: ${result.target}`);
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                console.log(USAGE);
                process.exit(1);
        }

        client.close();
        process.exit(0);

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.log('\nIs Antigravity running with --remote-debugging-port=9222?');
        process.exit(1);
    }
}

main();
