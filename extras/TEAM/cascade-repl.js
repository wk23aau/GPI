/**
 * Cascade Panel REPL - Connect to Antigravity renderer via CDP
 * Usage: node cascade-repl.js
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
        this.events = [];
    }

    async listTargets() {
        return new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
    }

    async connect(targetIndex = 0) {
        const targets = await this.listTargets();
        console.log('\n📋 Available targets:');
        targets.forEach((t, i) => console.log(`  ${i}: [${t.type}] ${t.title || '(untitled)'}`));

        // Find the main page (usually index 0 or the one with type 'page')
        const target = targets[targetIndex] || targets[0];

        console.log(`\n🔗 Connecting to: [${target.type}] ${target.title || target.url}`);

        this.ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise((r, j) => { this.ws.on('open', r); this.ws.on('error', j); });

        this.ws.on('message', d => {
            const m = JSON.parse(d);
            if (m.id && this.handlers.has(m.id)) {
                this.handlers.get(m.id)(m);
                this.handlers.delete(m.id);
            } else if (m.method) {
                this.events.push(m);
                if (this.events.length > 100) this.events.shift();
            }
        });

        return target;
    }

    send(method, params = {}) {
        return new Promise((res, rej) => {
            if (!this.ws) return rej(new Error('Not connected'));
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
            expression: js,
            returnByValue: true,
            awaitPromise: true
        });
        return r?.result?.value ?? r;
    }

    async enable() {
        await this.send('Runtime.enable');
        await this.send('DOM.enable');
        await this.send('Page.enable');
    }

    close() { this.ws?.close(); }
}

// Shortcuts for common Cascade operations
const COMMANDS = {
    help: `console.log(\`
🚀 Cascade Panel Commands:
  __openChat()     - Open new chat
  __history()      - Open chat history  
  __send(msg)      - Send message
  __focus()        - Focus chat input
  __listCommands() - List all vscode commands
  __exec(cmd)      - Execute any vscode command
\`); 'help shown'`,

    setup: `
// Inject helper functions
window.__cascade = {
    exec: (cmd, ...args) => {
        const api = window.acquireVsCodeApi?.() || window.vscode;
        if (api?.postMessage) {
            api.postMessage({ type: 'executeCommand', command: cmd, args });
            return 'command sent: ' + cmd;
        }
        // Try require approach
        try {
            const vscode = require('vscode');
            return vscode.commands.executeCommand(cmd, ...args);
        } catch(e) {
            return 'API not available: ' + e.message;
        }
    }
};
window.__openChat = () => __cascade.exec('workbench.action.chat.open');
window.__history = () => __cascade.exec('workbench.action.chat.history');
window.__send = (msg) => __cascade.exec('workbench.action.chat.submitMessage', msg);
window.__focus = () => __cascade.exec('workbench.action.chat.focusInput');
window.__listCommands = () => {
    const cmds = document.querySelectorAll('[data-command-id]');
    return Array.from(cmds).map(e => e.dataset.commandId).slice(0, 20);
};
window.__exec = (cmd, ...args) => __cascade.exec(cmd, ...args);
'✅ Cascade helpers injected!'
`
};

// REPL
const cdp = new CDP();

try {
    const target = await cdp.connect(1);  // Connect to main editor page
    await cdp.enable();

    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║  🌊 CASCADE PANEL REPL - Antigravity Automation               ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('\nType "setup" to inject helpers, then use __openChat(), __history(), etc.');
    console.log('Type "help" for command list, "exit" to quit\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt('cascade> ');
    rl.prompt();

    rl.on('line', async (line) => {
        const cmd = line.trim();
        if (!cmd) { rl.prompt(); return; }
        if (cmd === 'exit' || cmd === 'quit') { cdp.close(); process.exit(0); }
        if (cmd === 'events') { console.log(cdp.events.slice(-5)); rl.prompt(); return; }

        try {
            let js = COMMANDS[cmd] || cmd;
            const result = await cdp.eval(js);
            console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
        } catch (e) {
            console.log('❌ Error:', e.message || e);
        }
        rl.prompt();
    });

    rl.on('close', () => { cdp.close(); process.exit(0); });
} catch (e) {
    console.error('Failed to connect:', e.message);
    console.log('Make sure Antigravity is running with: --remote-debugging-port=9222');
    process.exit(1);
}
