/**
 * CDP REPL - Direct Chrome DevTools Protocol for AI Automation
 * 
 * Best method: WebSocket → CDP → Browser. No abstraction layers.
 * SSH is just plumbing. All domains. Interactive REPL.
 */
import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';

export class CDP {
    constructor(port = 9222) {
        this.port = port;
        this.ws = null;
        this.id = 1;
        this.handlers = new Map();
        this.events = [];
    }

    // ═══════════════════════════════════════════════════════════════
    // CONNECTION
    // ═══════════════════════════════════════════════════════════════

    async connect() {
        const targets = await new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${this.port}/json`, r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });

        if (!targets.length) throw new Error('No Chrome targets found');

        this.ws = new WebSocket(targets[0].webSocketDebuggerUrl);
        await new Promise(r => this.ws.on('open', r));

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

        return { url: targets[0].url, title: targets[0].title };
    }

    send(method, params = {}) {
        return new Promise((res, rej) => {
            if (!this.ws) return rej(new Error('Not connected'));
            const id = this.id++;
            this.handlers.set(id, m => m.error ? rej(m.error) : res(m.result));
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    async enableAll() {
        const domains = ['Page', 'Runtime', 'DOM', 'Network', 'Input', 'CSS', 'Log', 'Console', 'Emulation'];
        const results = {};
        for (const d of domains) {
            try { await this.send(`${d}.enable`); results[d] = true; }
            catch { results[d] = false; }
        }
        // Set viewport once at connection
        await this.send('Emulation.setDeviceMetricsOverride', {
            width: 400, height: 640, deviceScaleFactor: 1, mobile: false
        });
        return results;
    }

    close() {
        this.ws?.close();
        this.ws = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE HELPERS - What AI needs most
    // ═══════════════════════════════════════════════════════════════

    async eval(js) {
        const r = await this.send('Runtime.evaluate', {
            expression: js, returnByValue: true, awaitPromise: true
        });
        return r?.result?.value;
    }

    async nav(url) {
        await this.send('Page.navigate', { url });
    }

    // Poll every 200ms until JS returns truthy (no hardcoded waits)
    async poll(js, maxPolls = 25) {
        for (let i = 0; i < maxPolls; i++) {
            const result = await this.eval(js);
            if (result) return result;
            await new Promise(r => setTimeout(r, 200));
        }
        return null;
    }

    async click(x, y) {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left' });
    }

    async type(text) {
        await this.send('Input.insertText', { text });
    }

    async key(key, code = key) {
        const vk = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : 0;
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    }

    async screenshot(path = null, quality = 50) {
        const { data } = await this.send('Page.captureScreenshot', { format: 'jpeg', quality });
        if (path) fs.writeFileSync(path, Buffer.from(data, 'base64'));
        return data;
    }
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTIVE REPL (node cdp-repl)
// ═══════════════════════════════════════════════════════════════════

const isMain = process.argv[1]?.replace(/\\/g, '/').includes('cdp-repl');

if (isMain) {
    const readline = await import('readline');
    const cdp = new CDP();

    try {
        const target = await cdp.connect();
        console.log('✓ Connected:', target.title?.slice(0, 50));

        const domains = await cdp.enableAll();
        console.log('✓ Domains:', Object.entries(domains).filter(([, v]) => v).map(([k]) => k).join(', '));
        console.log('\nType CDP methods or JS expressions:\n');

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.setPrompt('cdp> ');
        rl.prompt();

        rl.on('line', async (line) => {
            const cmd = line.trim();
            if (!cmd) { rl.prompt(); return; }

            try {
                let result;
                if (cmd.startsWith('{')) {
                    const j = JSON.parse(cmd);
                    result = await cdp.send(j.method, j.params || {});
                } else if (/^[A-Z]\w+\.\w+/.test(cmd)) {
                    const [m, ...rest] = cmd.split(' ');
                    result = await cdp.send(m, rest.length ? JSON.parse(rest.join(' ')) : {});
                } else {
                    result = await cdp.eval(cmd);
                }
                if (result !== undefined) console.log(JSON.stringify(result, null, 2));
            } catch (e) {
                console.log('Error:', e.message || e);
            }
            rl.prompt();
        });

        rl.on('close', () => { cdp.close(); process.exit(0); });
    } catch (e) {
        console.error('✗ Connection failed:', e.message);
        process.exit(1);
    }
}

export default CDP;
