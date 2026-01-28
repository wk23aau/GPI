/**
 * Cascade CDP REPL with Native Keyboard Input
 * Uses CDP Input domain for real keyboard simulation
 */
import WebSocket from 'ws';
import http from 'http';
import readline from 'readline';

const PORT = 9222;

class CDP {
    constructor() {
        this.ws = null;
        this.id = 1;
        this.handlers = new Map();
    }

    async listTargets() {
        return new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
    }

    async connect(targetIndex = 1) {
        const targets = await this.listTargets();
        console.log('\n📋 Targets:');
        targets.forEach((t, i) => console.log(`  ${i}: [${t.type}] ${t.title || '(untitled)'}`));

        const target = targets[targetIndex] || targets[0];
        console.log(`\n🔗 Connecting to: [${target.type}] ${target.title}`);

        this.ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((r, j) => { this.ws.on('open', r); this.ws.on('error', j); });

        this.ws.on('message', d => {
            const m = JSON.parse(d);
            if (m.id && this.handlers.has(m.id)) {
                this.handlers.get(m.id)(m);
                this.handlers.delete(m.id);
            }
        });

        await this.send('Runtime.enable');
        await this.send('Input.enable').catch(() => { });
        return target;
    }

    send(method, params = {}) {
        return new Promise((res, rej) => {
            const id = this.id++;
            const timeout = setTimeout(() => rej(new Error('Timeout')), 10000);
            this.handlers.set(id, m => {
                clearTimeout(timeout);
                m.error ? rej(m.error) : res(m.result);
            });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async eval(js) {
        const r = await this.send('Runtime.evaluate', {
            expression: js, returnByValue: true, awaitPromise: true
        });
        return r?.result?.value ?? r;
    }

    // Native CDP keyboard input - this is what works!
    async pressKey(key, modifiers = 0) {
        // modifiers: 1=Alt, 2=Ctrl, 4=Meta, 8=Shift
        const keyMap = {
            'Enter': { keyCode: 13, code: 'Enter' },
            'Tab': { keyCode: 9, code: 'Tab' },
            'Escape': { keyCode: 27, code: 'Escape' },
            'Backspace': { keyCode: 8, code: 'Backspace' },
            'ArrowDown': { keyCode: 40, code: 'ArrowDown' },
            'ArrowUp': { keyCode: 38, code: 'ArrowUp' },
            'ArrowLeft': { keyCode: 37, code: 'ArrowLeft' },
            'ArrowRight': { keyCode: 39, code: 'ArrowRight' },
            'a': { keyCode: 65, code: 'KeyA' },
            'l': { keyCode: 76, code: 'KeyL' },
            'i': { keyCode: 73, code: 'KeyI' },
        };
        const kd = keyMap[key] || { keyCode: key.charCodeAt(0), code: 'Key' + key.toUpperCase() };

        await this.send('Input.dispatchKeyEvent', {
            type: 'keyDown', key, code: kd.code,
            windowsVirtualKeyCode: kd.keyCode, nativeVirtualKeyCode: kd.keyCode,
            modifiers
        });
        await this.send('Input.dispatchKeyEvent', {
            type: 'keyUp', key, code: kd.code,
            windowsVirtualKeyCode: kd.keyCode, nativeVirtualKeyCode: kd.keyCode,
            modifiers
        });
        return `Key pressed: ${key} (modifiers: ${modifiers})`;
    }

    async typeText(text) {
        await this.send('Input.insertText', { text });
        return `Typed: "${text}"`;
    }

    // Shortcut keys for Antigravity
    async openNewChat() {
        // Ctrl+Shift+L = modifiers 2+8 = 10
        return await this.pressKey('l', 10);
    }

    async openConversationPicker() {
        // Ctrl+Shift+A = modifiers 2+8 = 10
        return await this.pressKey('a', 10);
    }

    async focusChat() {
        // Ctrl+Alt+B = modifiers 1+2 = 3 (Alt+Ctrl)
        return await this.pressKey('b', 3);
    }

    async triggerAgent() {
        // Ctrl+Shift+I = modifiers 2+8 = 10
        return await this.pressKey('i', 10);
    }

    // Accept agent step (Alt+Enter)
    async acceptStep() {
        // Alt = modifiers 1
        return await this.pressKey('Enter', 1);
    }

    // Reject agent step (Alt+Shift+Backspace)
    async rejectStep() {
        // Alt+Shift = modifiers 1+8 = 9
        return await this.pressKey('Backspace', 9);
    }

    // Navigate to next hunk (Alt+J)
    async nextHunk() {
        return await this.pressKey('j', 1);
    }

    // Navigate to previous hunk (Alt+K)
    async prevHunk() {
        return await this.pressKey('k', 1);
    }

    // Accept focused hunk (Alt+Enter in editor)
    async acceptHunk() {
        return await this.pressKey('Enter', 1);
    }

    // Reject focused hunk (Alt+Shift+Backspace in editor)
    async rejectHunk() {
        return await this.pressKey('Backspace', 9);
    }

    // Open picker and list conversations
    async listConversations() {
        await this.openConversationPicker();
        await new Promise(r => setTimeout(r, 300)); // Wait for picker to appear
        const items = await this.eval(`
            Array.from(document.querySelectorAll('.quick-input-list .monaco-list-row, .quick-pick-entry')).map((e, i) => {
                const label = e.querySelector('.label-name, .quick-input-list-label')?.textContent || e.textContent;
                const desc = e.querySelector('.label-description, .quick-input-list-description')?.textContent || '';
                return i + ': ' + (label || '').substring(0, 50) + (desc ? ' | ' + desc.substring(0, 30) : '');
            }).join('\\n') || 'No items found'
        `);
        return items;
    }

    // Navigate to specific conversation by pressing down N times
    async gotoConversation(index) {
        await this.openConversationPicker();
        await new Promise(r => setTimeout(r, 200));
        for (let i = 0; i < index; i++) {
            await this.pressKey('ArrowDown');
            await new Promise(r => setTimeout(r, 50));
        }
        await this.pressKey('Enter');
        return `Switched to conversation #${index}`;
    }

    close() { this.ws?.close(); }
}

// REPL with native input commands
const cdp = new CDP();

const HELP = `
🎮 Native Input Commands:
  newchat     - Open new conversation (Ctrl+Shift+L)
  picker      - Open conversation picker (Ctrl+Shift+A)
  list        - List all conversations (opens picker, shows items)
  goto <n>    - Switch to conversation #n (0-indexed)
  focus       - Focus chat input (Ctrl+L)
  agent       - Trigger agent (Ctrl+Shift+I)
  
  accept      - Accept agent step (Alt+Enter)
  reject      - Reject agent step (Alt+Shift+Backspace)
  nexthunk    - Go to next hunk (Alt+J)
  prevhunk    - Go to previous hunk (Alt+K)
  
  type <msg>  - Type text into focused element
  down/up     - Navigate picker
  enter/esc   - Confirm/cancel
  
  Any other input = evaluate as JavaScript
`;

try {
    await cdp.connect(0);  // Connect to Manager page (index 0)

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  🎮 CDP REPL with Native Keyboard Input                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(HELP);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt('cdp> ');
    rl.prompt();

    rl.on('line', async (line) => {
        const cmd = line.trim();
        if (!cmd) { rl.prompt(); return; }
        if (cmd === 'exit') { cdp.close(); process.exit(0); }
        if (cmd === 'help') { console.log(HELP); rl.prompt(); return; }

        try {
            let result;
            switch (cmd) {
                case 'newchat':
                    result = await cdp.openNewChat();
                    break;
                case 'picker':
                    result = await cdp.openConversationPicker();
                    break;
                case 'focus':
                    result = await cdp.focusChat();
                    break;
                case 'agent':
                    result = await cdp.triggerAgent();
                    break;
                case 'enter':
                    result = await cdp.pressKey('Enter');
                    break;
                case 'tab':
                    result = await cdp.pressKey('Tab');
                    break;
                case 'esc':
                    result = await cdp.pressKey('Escape');
                    break;
                case 'down':
                    result = await cdp.pressKey('ArrowDown');
                    break;
                case 'up':
                    result = await cdp.pressKey('ArrowUp');
                    break;
                case 'list':
                    result = await cdp.listConversations();
                    break;
                case 'accept':
                    result = await cdp.acceptStep();
                    break;
                case 'reject':
                    result = await cdp.rejectStep();
                    break;
                case 'nexthunk':
                    result = await cdp.nextHunk();
                    break;
                case 'prevhunk':
                    result = await cdp.prevHunk();
                    break;
                default:
                    if (cmd.startsWith('type ')) {
                        result = await cdp.typeText(cmd.substring(5));
                    } else if (cmd.startsWith('goto ')) {
                        const idx = parseInt(cmd.substring(5), 10);
                        result = await cdp.gotoConversation(idx);
                    } else {
                        result = await cdp.eval(cmd);
                    }
            }
            console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
        } catch (e) {
            console.log('❌ Error:', e.message || e);
        }
        rl.prompt();
    });

    rl.on('close', () => { cdp.close(); process.exit(0); });
} catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
}
