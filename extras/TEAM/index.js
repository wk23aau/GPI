/**
 * CDP Full Protocol REPL
 * 
 * Single REPL with:
 * - Background vision loop (setInterval)
 * - Executor commands
 * - Protocol coordination
 * - Smart target selection
 */
import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_PATH = path.join(__dirname, 'vision.jpg');
const WORLD_FILE = path.join(__dirname, 'world.json');

export class CDP {
    constructor(port = 9222) {
        this.port = port;
        this.ws = null;
        this.id = 1;
        this.handlers = new Map();
        this.events = [];
        this.targetInfo = null;

        // Vision state
        this.visionInterval = null;
        this.visionRunning = false;
        this.lastVisionTs = 0;
        this.visionLoopCount = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    // CONNECTION
    // ═══════════════════════════════════════════════════════════════

    async getTargets() {
        return new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${this.port}/json`, r => {
                let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
    }

    async connect(urlPattern = null) {
        const targets = await this.getTargets();
        if (!targets.length) throw new Error('No Chrome targets found');

        let target;
        if (urlPattern) {
            target = targets.find(t => t.url?.includes(urlPattern));
            if (!target) throw new Error(`No target matching: ${urlPattern}`);
        } else {
            target = targets.find(t => t.type === 'page' && !t.url.startsWith('chrome')) || targets[0];
        }

        this.targetInfo = target;
        this.ws = new WebSocket(target.webSocketDebuggerUrl);
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

        return { url: target.url, title: target.title, id: target.id };
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
        return results;
    }

    close() {
        this.stopVision();
        this.ws?.close();
        this.ws = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // CORE CDP HELPERS
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
        const vk = key === 'Enter' ? 13 : key === 'Tab' ? 9 : key === 'Escape' ? 27 : key === 'Backspace' ? 8 : 0;
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
    }

    async screenshot(path = null, quality = 50) {
        const { data } = await this.send('Page.captureScreenshot', { format: 'jpeg', quality });
        if (path) fs.writeFileSync(path, Buffer.from(data, 'base64'));
        return data;
    }

    // ═══════════════════════════════════════════════════════════════
    // WORLD STATE & PROTOCOL
    // ═══════════════════════════════════════════════════════════════

    async world() {
        return this.eval('typeof __cdp !== "undefined" ? __cdp.state() : null');
    }

    async protocol() {
        return this.eval('typeof __cdp !== "undefined" ? __cdp.protocol() : null');
    }

    async ui() {
        return this.eval('typeof __cdp !== "undefined" ? __cdp.ui() : []');
    }

    async find(text) {
        return this.eval(`typeof __cdp !== "undefined" ? __cdp.clickCoords(${JSON.stringify(text)}) : null`);
    }

    async waitForExtension(maxWait = 5000) {
        const start = Date.now();
        while (Date.now() - start < maxWait) {
            const ready = await this.eval('typeof __cdp !== "undefined"');
            if (ready) return true;
            await new Promise(r => setTimeout(r, 200));
        }
        return false;
    }

    async waitForNav(timeout = 10000) {
        return this.poll('document.readyState === "complete"', timeout / 200);
    }

    // ═══════════════════════════════════════════════════════════════
    // VISION (Background Loop)
    // ═══════════════════════════════════════════════════════════════

    startVision(intervalMs = 1500, silent = false) {
        if (this.visionRunning) {
            return { status: 'already running', loopCount: this.visionLoopCount };
        }

        this.visionRunning = true;
        this.visionLoopCount = 0;

        this.visionInterval = setInterval(async () => {
            try {
                const state = await this.world();
                if (state && state.ts > this.lastVisionTs) {
                    this.lastVisionTs = state.ts;
                    this.visionLoopCount++;

                    // Capture screenshot
                    await this.screenshot(SCREENSHOT_PATH, 25);

                    // Acknowledge action
                    const protocol = state.protocol;
                    if (protocol) {
                        await this.eval(`__cdp.p.visionWrite({ 
                            VISION_STATUS: "ready",
                            VISION_ACK: ${protocol.ACTION_ID}
                        })`);
                    }

                    // Update world.json
                    this._updateWorldFile(state);

                    if (!silent) {
                        console.log(`\n[Vision #${this.visionLoopCount}] ${state.url?.slice(0, 40)} | UI: ${state.uiMapCount} | ACT: ${protocol?.ACTION_ID}`);
                    }
                }
            } catch (err) {
                if (!silent) console.error('[Vision Error]', err.message);
            }
        }, intervalMs);

        return { status: 'started', interval: intervalMs };
    }

    stopVision() {
        if (this.visionInterval) {
            clearInterval(this.visionInterval);
            this.visionInterval = null;
        }
        this.visionRunning = false;
        return { status: 'stopped', loopCount: this.visionLoopCount };
    }

    visionStatus() {
        return {
            running: this.visionRunning,
            loopCount: this.visionLoopCount,
            lastTs: this.lastVisionTs,
            screenshotPath: SCREENSHOT_PATH
        };
    }

    _updateWorldFile(cdpState) {
        let world = { current: {}, protocol: {}, history: [], lastAction: null };
        try {
            world = JSON.parse(fs.readFileSync(WORLD_FILE));
        } catch { }

        if (world.current.url) {
            world.history.push({ ...world.current, action: world.lastAction });
            if (world.history.length > 20) world.history.shift();
        }

        world.current = {
            url: cdpState.url,
            title: cdpState.title,
            uiCount: cdpState.uiMapCount,
            ui: cdpState.uiMap,
            ts: Date.now()
        };
        world.protocol = cdpState.protocol || {};
        world.lastAction = 'vision-capture';

        fs.writeFileSync(WORLD_FILE, JSON.stringify(world, null, 2));
    }

    // ═══════════════════════════════════════════════════════════════
    // EXECUTOR (Protocol-safe actions)
    // ═══════════════════════════════════════════════════════════════

    async clickText(text) {
        const coords = await this.find(text);
        if (!coords) return { error: 'Element not found', text };

        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "executing" })');
        const actionId = await this.eval('__cdp.p.nextAction()');

        await this.eval(`__cdp.moveTo(${coords.x}, ${coords.y})`);
        await new Promise(r => setTimeout(r, 850));
        await this.click(coords.x, coords.y);

        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "ready" })');
        return { action: 'click', text, ...coords, actionId };
    }

    async typeText(text) {
        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "executing" })');
        const actionId = await this.eval('__cdp.p.nextAction()');
        await this.type(text);
        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "ready" })');
        return { action: 'type', text: text.slice(0, 20), actionId };
    }

    async pressKey(key) {
        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "executing" })');
        const actionId = await this.eval('__cdp.p.nextAction()');
        await this.key(key);
        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "ready" })');
        return { action: 'key', key, actionId };
    }

    async navigate(url) {
        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "executing" })');
        const actionId = await this.eval('__cdp.p.nextAction()');
        await this.nav(url);
        await this.waitForNav(10000);
        await this.waitForExtension(3000);
        await this.eval('__cdp.p.execWrite({ EXEC_STATUS: "ready" })');
        return { action: 'nav', url, actionId };
    }

    async waitForVision(timeout = 5000) {
        const protocol = await this.protocol();
        if (!protocol) return { error: 'No protocol' };

        const targetAck = protocol.ACTION_ID;
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const current = await this.protocol();
            if (current.VISION_ACK >= targetAck) {
                return { synced: true, actionId: targetAck, visionAck: current.VISION_ACK };
            }
            await new Promise(r => setTimeout(r, 200));
        }
        return { synced: false, timeout: true };
    }
}

// ═══════════════════════════════════════════════════════════════════
// INTERACTIVE REPL
// ═══════════════════════════════════════════════════════════════════

const isMain = process.argv[1]?.replace(/\\/g, '/').includes('index');

if (isMain) {
    const readline = await import('readline');
    const cdp = new CDP();

    try {
        const target = await cdp.connect();
        console.log('✓ Connected:', target.title?.slice(0, 50));

        const domains = await cdp.enableAll();
        console.log('✓ Domains:', Object.entries(domains).filter(([, v]) => v).map(([k]) => k).join(', '));

        const hasExt = await cdp.waitForExtension(2000);
        if (hasExt) {
            const proto = await cdp.protocol();
            console.log('✓ Extension: v2.0, EPOCH:', proto?.EPOCH, 'ACTION_ID:', proto?.ACTION_ID);
        } else {
            console.log('⚠ Extension not detected');
        }

        // Write session file so other scripts can find this REPL
        const sessionFile = path.join(__dirname, 'repl-session.json');
        const sessionData = {
            pid: process.pid,
            wsUrl: cdp.targetInfo?.webSocketDebuggerUrl,
            targetUrl: target.url,
            targetTitle: target.title,
            startedAt: Date.now(),
            port: cdp.port,
            httpPort: 9223
        };
        fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2));
        console.log('✓ Session file:', sessionFile);

        // Start HTTP server for agent access
        const httpServer = http.createServer(async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                res.end();
                return;
            }

            if (req.method === 'GET' && req.url === '/status') {
                res.end(JSON.stringify({ ok: true, pid: process.pid, target: target.title }));
                return;
            }

            if (req.method === 'POST' && req.url === '/cdp') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const { cmd } = JSON.parse(body);
                        let result;

                        // Execute command same as REPL
                        if (cmd === '__cdp.ui()' || cmd === 'ui') {
                            result = await cdp.ui();
                        } else if (cmd === '__cdp.state()' || cmd === 'state') {
                            result = await cdp.state();
                        } else if (cmd.startsWith('__cdp.find')) {
                            const match = cmd.match(/find\(['"](.*)['"]\)/);
                            result = match ? await cdp.find(match[1]) : null;
                        } else if (cmd.startsWith('Page.navigate')) {
                            const params = JSON.parse(cmd.replace('Page.navigate ', ''));
                            result = await cdp.send('Page.navigate', params);
                        } else if (cmd.startsWith('Input.')) {
                            const [method, ...rest] = cmd.split(' ');
                            const params = rest.length ? JSON.parse(rest.join(' ')) : {};
                            result = await cdp.send(method, params);
                        } else {
                            result = await cdp.eval(cmd);
                        }

                        res.end(JSON.stringify({ ok: true, result }));
                    } catch (e) {
                        res.end(JSON.stringify({ ok: false, error: e.message }));
                    }
                });
                return;
            }

            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
        });

        httpServer.listen(9223, () => {
            console.log('✓ HTTP API: http://localhost:9223/cdp');
        });

        console.log('\n═══════════════════════════════════════════════════');
        console.log('  CDP Full Protocol REPL');
        console.log('═══════════════════════════════════════════════════');
        console.log('\nVision Commands:');
        console.log('  vision start [ms]  - Start background vision loop');
        console.log('  vision stop        - Stop vision loop');
        console.log('  vision status      - Get vision status');
        console.log('\nExecutor Commands:');
        console.log('  click TEXT         - Click element by text');
        console.log('  type TEXT          - Type text');
        console.log('  enter/tab/esc      - Press key');
        console.log('  nav URL            - Navigate');
        console.log('  wait               - Wait for vision sync');
        console.log('\nState Commands:');
        console.log('  world / ui / proto - Get state');
        console.log('  ss [path]          - Screenshot');
        console.log('  find TEXT          - Find element coords');
        console.log('\n');

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.setPrompt('cdp> ');
        rl.prompt();

        rl.on('line', async (line) => {
            const cmd = line.trim();
            if (!cmd) { rl.prompt(); return; }

            try {
                let result;

                // Vision commands
                if (cmd === 'vision start' || cmd.startsWith('vision start ')) {
                    const ms = parseInt(cmd.split(' ')[2]) || 1500;
                    result = cdp.startVision(ms, false);
                } else if (cmd === 'vision stop') {
                    result = cdp.stopVision();
                } else if (cmd === 'vision status') {
                    result = cdp.visionStatus();
                }
                // Executor commands
                else if (cmd.startsWith('click ')) {
                    result = await cdp.clickText(cmd.slice(6));
                } else if (cmd.startsWith('type ')) {
                    result = await cdp.typeText(cmd.slice(5));
                } else if (cmd === 'enter') {
                    result = await cdp.pressKey('Enter');
                } else if (cmd === 'tab') {
                    result = await cdp.pressKey('Tab');
                } else if (cmd === 'esc') {
                    result = await cdp.pressKey('Escape');
                } else if (cmd.startsWith('nav ')) {
                    result = await cdp.navigate(cmd.slice(4));
                } else if (cmd === 'wait') {
                    result = await cdp.waitForVision();
                }
                // State commands
                else if (cmd === 'world') {
                    result = await cdp.world();
                } else if (cmd === 'ui') {
                    result = await cdp.ui();
                } else if (cmd === 'proto' || cmd === 'protocol') {
                    result = await cdp.protocol();
                } else if (cmd.startsWith('find ')) {
                    result = await cdp.find(cmd.slice(5));
                } else if (cmd.startsWith('ss')) {
                    const p = cmd.split(' ')[1] || 'screenshot.jpg';
                    await cdp.screenshot(p);
                    result = { saved: p };
                }
                // Raw CDP/JS
                else if (cmd.startsWith('{')) {
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
