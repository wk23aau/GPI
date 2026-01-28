/**
 * CDP REPL for Antigravity/VSCode on port 9229
 * Usage: node cdp-9229.js
 */
import WebSocket from 'ws';
import http from 'http';
import readline from 'readline';

const PORT = 9229;

class CDP {
    constructor() {
        this.ws = null;
        this.id = 1;
        this.handlers = new Map();
        this.events = [];
    }

    async connect() {
        const targets = await new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${PORT}/json`, r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });

        if (!targets.length) throw new Error('No targets found');

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

        return { url: targets[0].url, title: targets[0].title, id: targets[0].id };
    }

    send(method, params = {}) {
        return new Promise((res, rej) => {
            if (!this.ws) return rej(new Error('Not connected'));
            const id = this.id++;
            this.handlers.set(id, m => m.error ? rej(m.error) : res(m.result));
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

    async enableDomains() {
        const domains = ['Runtime', 'Debugger', 'Profiler', 'Console', 'HeapProfiler'];
        const results = {};
        for (const d of domains) {
            try { await this.send(`${d}.enable`); results[d] = true; }
            catch { results[d] = false; }
        }
        return results;
    }

    close() {
        this.ws?.close();
        this.ws = null;
    }
}

// REPL
const cdp = new CDP();

try {
    const target = await cdp.connect();
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  CDP REPL Connected to Antigravity (port 9229)             ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Target: ${target.title}`);
    console.log(`ID: ${target.id}\n`);

    const domains = await cdp.enableDomains();
    console.log('Enabled:', Object.entries(domains).filter(([, v]) => v).map(([k]) => k).join(', '));
    console.log('\nCommands: Runtime.method {params} | JS expression | Debugger.* | Console.*\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt('cdp> ');
    rl.prompt();

    rl.on('line', async (line) => {
        const cmd = line.trim();
        if (!cmd) { rl.prompt(); return; }
        if (cmd === 'exit' || cmd === 'quit') { cdp.close(); process.exit(0); }
        if (cmd === 'events') { console.log(cdp.events.slice(-5)); rl.prompt(); return; }

        try {
            let result;
            if (cmd.startsWith('{')) {
                const j = JSON.parse(cmd);
                result = await cdp.send(j.method, j.params || {});
            } else if (cmd.includes('.') && !cmd.includes('(') && !cmd.includes(' ')) {
                result = await cdp.send(cmd);
            } else if (cmd.match(/^[A-Z][a-z]+\./)) {
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
    console.log('Make sure Antigravity is running with: --inspect=9229');
    process.exit(1);
}
