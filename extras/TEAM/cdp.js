/**
 * CDP REPL Module - Minimal Chrome DevTools Protocol interface
 * Best method for AI automation: direct WebSocket, all domains, interactive control
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

    // Connect to Chrome
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

    // Send CDP command
    send(method, params = {}) {
        return new Promise((res, rej) => {
            if (!this.ws) return rej(new Error('Not connected'));
            const id = this.id++;
            this.handlers.set(id, m => m.error ? rej(m.error) : res(m.result));
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    // Enable common domains
    async enableAll() {
        const domains = ['Page', 'Runtime', 'DOM', 'Network', 'Input', 'CSS', 'Log', 'Console', 'Emulation'];
        const results = {};
        for (const d of domains) {
            try { await this.send(`${d}.enable`); results[d] = true; }
            catch { results[d] = false; }
        }
        return results;
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE HELPERS
    // ═══════════════════════════════════════════════════════════════

    // Evaluate JavaScript in browser
    async eval(js) {
        const r = await this.send('Runtime.evaluate', {
            expression: js,
            returnByValue: true,
            awaitPromise: true
        });
        return r?.result?.value;
    }

    // Navigate to URL
    async nav(url) {
        await this.send('Page.navigate', { url });
    }

    // Poll until condition (0.2s intervals, no hardcoded waits)
    async poll(js, maxPolls = 25) {
        for (let i = 0; i < maxPolls; i++) {
            const result = await this.eval(js);
            if (result) return result;
            await new Promise(r => setTimeout(r, 200));
        }
        return null;
    }

    // Click at coordinates
    async click(x, y) {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left' });
    }

    // Type text
    async type(text) {
        await this.send('Input.insertText', { text });
    }

    // Press key
    async key(key, code = key) {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Enter' ? 13 : 0 });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    }

    // Screenshot
    async screenshot(path = null, quality = 50) {
        const { data } = await this.send('Page.captureScreenshot', { format: 'jpeg', quality });
        if (path) fs.writeFileSync(path, Buffer.from(data, 'base64'));
        return data;
    }

    // Close connection
    close() {
        this.ws?.close();
        this.ws = null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTIVE REPL (when run directly)
// ═══════════════════════════════════════════════════════════════════

if (process.argv[1]?.endsWith('cdp.js')) {
    const readline = await import('readline');
    const cdp = new CDP();

    try {
        const target = await cdp.connect();
        console.log('Connected:', target.title, target.url);

        const domains = await cdp.enableAll();
        console.log('Domains:', Object.entries(domains).filter(([, v]) => v).map(([k]) => k).join(', '));
        console.log('\nCommands: method, method {params}, or JS expression\n');

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
                } else if (cmd.includes('.') && !cmd.includes('(')) {
                    const [m, ...rest] = cmd.split(' ');
                    result = await cdp.send(m, rest.length ? JSON.parse(rest.join(' ')) : {});
                } else {
                    result = await cdp.eval(cmd);
                }
                console.log(JSON.stringify(result, null, 2));
            } catch (e) {
                console.log('Error:', e.message || e);
            }
            rl.prompt();
        });

        rl.on('close', () => { cdp.close(); process.exit(0); });
    } catch (e) {
        console.error('Failed to connect:', e.message);
        process.exit(1);
    }
}

export default CDP;
