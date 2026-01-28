/**
 * XOD - Real-Time Browser Automation System
 * 
 * 30 Hz closed-loop CDP control with streaming perception.
 * 
 * Usage:
 *   node index.js [port]
 *   
 * Commands:
 *   state          - Show current page state
 *   ui             - List clickable elements
 *   find <text>    - Find element by text
 *   goto <url>     - Navigate to URL
 *   click <x> <y>  - Click at coordinates
 *   glide <x> <y>  - Smooth move to position
 *   type <text>    - Type text
 *   key <key>      - Press key
 *   watch <sel>    - Watch selector for changes
 *   start          - Start executor loop
 *   stop           - Stop executor loop
 *   help           - Show commands
 */

import WebSocket from 'ws';
import { createInterface } from 'readline';
import { AGENT_SCRIPT } from './agent.js';
import { OVERLAY_SCRIPT } from './overlay.js';
import { Executor } from './executor.js';
import { createEscalation } from './escalation.js';
import { sleep } from './input.js';

// ═══════════════════════════════════════════════════════════════════════════
// CDP Client
// ═══════════════════════════════════════════════════════════════════════════

class CDP {
    constructor(port = 9222) {
        this.port = port;
        this.ws = null;
        this.id = 0;
        this.pending = new Map();
        this.events = [];
    }

    async connect() {
        // Get WebSocket URL
        const res = await fetch(`http://127.0.0.1:${this.port}/json`);
        const targets = await res.json();
        const page = targets.find(t => t.type === 'page');
        if (!page) throw new Error('No page target found');

        // Connect WebSocket
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(page.webSocketDebuggerUrl);

            this.ws.on('open', () => {
                console.log(`[CDP] Connected to ${page.url}`);
                resolve();
            });

            this.ws.on('message', (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.id && this.pending.has(msg.id)) {
                    const { resolve, reject } = this.pending.get(msg.id);
                    this.pending.delete(msg.id);
                    if (msg.error) reject(new Error(msg.error.message));
                    else resolve(msg.result);
                } else if (msg.method) {
                    this.events.push(msg);
                    // Keep last 1000 events
                    if (this.events.length > 1000) this.events.shift();
                }
            });

            this.ws.on('error', reject);
        });
    }

    async send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async eval(expression) {
        try {
            const result = await this.send('Runtime.evaluate', {
                expression,
                returnByValue: true,
                awaitPromise: false
            });
            return result?.result?.value;
        } catch (e) {
            return null;
        }
    }

    async enableDomains() {
        await this.send('Page.enable');
        await this.send('Runtime.enable');
        await this.send('DOM.enable');
        await this.send('Network.enable');

        // Auto-attach to new targets
        await this.send('Target.setAutoAttach', {
            autoAttach: true,
            waitForDebuggerOnStart: false,
            flatten: true
        });
    }

    async injectAgent() {
        // Inject on all future documents
        await this.send('Page.addScriptToEvaluateOnNewDocument', {
            source: AGENT_SCRIPT
        });

        // Inject on current document
        await this.eval(AGENT_SCRIPT);

        console.log('[CDP] Page agent injected');
    }

    async injectOverlay() {
        await this.send('Page.addScriptToEvaluateOnNewDocument', {
            source: OVERLAY_SCRIPT
        });
        await this.eval(OVERLAY_SCRIPT);
        console.log('[CDP] Cursor overlay injected');
    }

    async navigate(url) {
        await this.send('Page.navigate', { url });
    }

    async screenshot(format = 'jpeg', quality = 50) {
        const result = await this.send('Page.captureScreenshot', { format, quality });
        return result?.data;
    }

    close() {
        if (this.ws) this.ws.close();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPL Interface
// ═══════════════════════════════════════════════════════════════════════════

class REPL {
    constructor(cdp, executor) {
        this.cdp = cdp;
        this.executor = executor;
        this.rl = createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    start() {
        console.log('\n[XOD] REPL ready. Type "help" for commands.\n');
        this.prompt();
    }

    prompt() {
        this.rl.question('xod> ', async (line) => {
            await this.handleCommand(line.trim());
            this.prompt();
        });
    }

    async handleCommand(line) {
        if (!line) return;

        const [cmd, ...args] = line.split(/\s+/);

        try {
            switch (cmd.toLowerCase()) {
                case 'help':
                    this.showHelp();
                    break;

                case 'state':
                    const state = await this.executor.refreshDigest();
                    console.log(JSON.stringify(state, null, 2));
                    break;

                case 'ui':
                    const clickables = await this.executor.getClickables();
                    console.log('Clickable elements:');
                    clickables?.slice(0, 20).forEach(el => {
                        console.log(`  [${el.i}] ${el.tag} "${el.text}" @ (${el.x}, ${el.y})`);
                    });
                    break;

                case 'find':
                    const text = args.join(' ');
                    const found = await this.executor.findByText(text);
                    if (found) {
                        console.log(`Found: "${found.text}" @ (${found.x}, ${found.y})`);
                    } else {
                        console.log('Not found');
                    }
                    break;

                case 'goto':
                    await this.cdp.navigate(args[0]);
                    await sleep(500);
                    await this.cdp.injectAgent();
                    await this.cdp.injectOverlay();
                    console.log('Navigated');
                    break;

                case 'click':
                    const cx = parseInt(args[0]);
                    const cy = parseInt(args[1]);
                    await this.executor.clickAt(cx, cy);
                    console.log(`Clicked (${cx}, ${cy})`);
                    break;

                case 'glide':
                    const gx = parseInt(args[0]);
                    const gy = parseInt(args[1]);
                    await this.executor.glideTo(gx, gy);
                    console.log(`Gliding to (${gx}, ${gy})`);
                    break;

                case 'type':
                    await this.executor.typeText(args.join(' '));
                    console.log('Typed');
                    break;

                case 'key':
                    await this.executor.pressKey(args[0]);
                    console.log(`Pressed ${args[0]}`);
                    break;

                case 'watch':
                    await this.executor.watch(args[0]);
                    console.log(`Watching: ${args[0]}`);
                    break;

                case 'start':
                    this.executor.start();
                    break;

                case 'stop':
                    this.executor.stop();
                    break;

                case 'shot':
                    const img = await this.cdp.screenshot();
                    console.log(`Screenshot: ${img?.length} bytes (base64)`);
                    break;

                case 'events':
                    const n = parseInt(args[0]) || 10;
                    console.log(`Last ${n} CDP events:`);
                    this.cdp.events.slice(-n).forEach(e => {
                        console.log(`  ${e.method}`);
                    });
                    break;

                default:
                    // Try as raw JS eval
                    const result = await this.cdp.eval(line);
                    console.log(result);
            }
        } catch (err) {
            console.error('Error:', err.message);
        }
    }

    showHelp() {
        console.log(`
XOD Commands:
  state          Show current page state
  ui             List clickable elements
  find <text>    Find element by text
  goto <url>     Navigate to URL
  click <x> <y>  Click at coordinates
  glide <x> <y>  Smooth move to position
  type <text>    Type text
  key <key>      Press key (Enter, Tab, etc.)
  watch <sel>    Watch selector for changes
  start          Start 30 Hz executor loop
  stop           Stop executor loop
  shot           Take screenshot
  events [n]     Show last n CDP events
  <js>           Evaluate JavaScript
`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    const port = parseInt(process.argv[2]) || 9222;

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   XOD - Real-Time Browser Automation @ 30 Hz              ║
╚═══════════════════════════════════════════════════════════╝
`);

    // Connect CDP
    const cdp = new CDP(port);
    await cdp.connect();
    await cdp.enableDomains();

    // Inject agents
    await cdp.injectAgent();
    await cdp.injectOverlay();

    // Create executor
    const executor = new Executor(cdp);

    // Setup escalation
    const escalation = createEscalation((esc) => {
        console.log(`\n[ESCALATE] ${esc.type}: ${esc.reason}`);
        // In a real setup, this would send to Claude/Gemini
    });

    // Start REPL
    const repl = new REPL(cdp, executor);
    repl.start();

    // Handle exit
    process.on('SIGINT', () => {
        executor.stop();
        cdp.close();
        process.exit(0);
    });
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
