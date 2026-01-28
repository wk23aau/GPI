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
import fs from 'fs';
import { createInterface } from 'readline';
import { AGENT_SCRIPT } from './agent.js';
import { OVERLAY_SCRIPT } from './overlay.js';
import { Executor } from './executor.js';
import { createEscalation } from './escalation.js';
import { setupDefaultReflexes } from './reflexes.js';
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

                    // Auto re-inject agent on main frame navigation
                    if (msg.method === 'Page.frameNavigated' && !msg.params?.frame?.parentId) {
                        this.handleNavigation();
                    }
                }
            });

            this.ws.on('error', reject);
            this.ws.on('close', () => {
                console.log('[CDP] WebSocket closed');
                this.ws = null;
            });
        });
    }

    get connected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
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
        // Clear any old registered scripts first
        try {
            await this.send('Page.removeAllScriptsToEvaluateOnNewDocument');
        } catch (e) {
            // Ignore if not supported
        }

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

    async handleNavigation() {
        console.log('[CDP] Navigation detected, re-injecting agent...');
        try {
            await this.injectAgent();
            await this.injectOverlay();
        } catch (e) {
            // Ignore injection errors during rapid navigation
        }
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

                case 'viewport':
                    // Set fixed viewport for predictable coordinates
                    const vw = parseInt(args[0]) || 1024;
                    const vh = parseInt(args[1]) || 768;
                    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
                        width: vw,
                        height: vh,
                        deviceScaleFactor: 1,
                        mobile: false
                    });
                    // Re-inject overlay after viewport change
                    await this.cdp.eval(OVERLAY_SCRIPT);
                    console.log(`[VIEWPORT] Set to ${vw}x${vh} - center: (${vw / 2}, ${vh / 2})`);
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

                case 'bezier':
                    const bx = parseInt(args[0]);
                    const by = parseInt(args[1]);
                    await this.executor.bezierTo(bx, by);
                    console.log(`Bezier to (${bx}, ${by})`);
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
                    const quality = parseInt(args[0]) || 10;
                    const ts = Date.now();
                    const t0 = Date.now();
                    const img = await this.cdp.screenshot('jpeg', quality);
                    const shotMs = Date.now() - t0;

                    // Get cursor from executor state (what XOD controls), viewport from browser
                    const vp = await this.cdp.eval('({w: window.innerWidth, h: window.innerHeight})') || { w: 1024, h: 768 };
                    const coords = {
                        ts,
                        cursor: this.executor.state.mousePos,  // XOD's controlled position
                        viewport: vp,
                        center: { x: vp.w / 2, y: vp.h / 2 },
                        url: await this.cdp.eval('location.href') || ''
                    };

                    const shotFile = `shot_${ts}.jpg`;
                    const coordsFile = `shot_${ts}.json`;
                    fs.writeFileSync(shotFile, Buffer.from(img, 'base64'));
                    fs.writeFileSync(coordsFile, JSON.stringify(coords, null, 2));
                    console.log(`Screenshot: ${shotFile} + ${coordsFile} (${Math.round(img.length / 1024)}KB, q=${quality}, ${shotMs}ms)`);
                    break;

                case 'stream':
                    const streamQ = parseInt(args[0]) || 15;  // 15% quality default
                    const hz = parseInt(args[1]) || 10;       // 10Hz default
                    fs.writeFileSync('cmd.txt', '');
                    console.log(`[STREAM] ${hz}Hz @ q=${streamQ} → {x}_{y}.jpg | cmd.txt`);
                    this._streaming = true;
                    let frameNum = 0;
                    let lastFile = null;
                    const loop = setInterval(async () => {
                        if (!this._streaming) { clearInterval(loop); console.log('[STREAM] Stopped'); return; }
                        try {
                            const img = await this.cdp.screenshot('jpeg', streamQ);
                            const cursor = this.executor.state.mousePos;

                            // Filename IS the position - instant parsing from filename
                            const filename = `${cursor.x}_${cursor.y}.jpg`;

                            // Delete previous file, write new one
                            if (lastFile && lastFile !== filename) {
                                try { fs.unlinkSync(lastFile); } catch (e) { }
                            }
                            fs.writeFileSync(filename, Buffer.from(img, 'base64'));
                            lastFile = filename;

                            frameNum++;
                            // Log every second
                            if (frameNum % hz === 0) {
                                console.log(`[FRAME] #${frameNum} → ${filename}`);
                            }

                            // Check for commands
                            const c = fs.readFileSync('cmd.txt', 'utf8').trim();
                            if (c) {
                                fs.writeFileSync('cmd.txt', '');
                                console.log(`[CMD] ${c}`);
                                if (c === 'stop') this._streaming = false;
                                else await this.handleCommand(c);
                            }
                        } catch (e) { }
                    }, 1000 / hz);
                    break;

                case 'frame':
                    // Single frame capture - stores base64 in window.__XOD_FRAME__ for in-browser analysis
                    // No file I/O, stays entirely in Chrome memory
                    const frameQ = parseInt(args[0]) || 15;
                    const t0frame = Date.now();
                    const frameB64 = await this.cdp.screenshot('jpeg', frameQ);
                    const frameCursor = this.executor.state.mousePos;

                    // Store in browser memory for analysis
                    await this.cdp.eval(`
                        window.__XOD_FRAME__ = {
                            ts: ${Date.now()},
                            cursor: { x: ${frameCursor.x}, y: ${frameCursor.y} },
                            b64: '${frameB64}'
                        };
                    `);

                    const frameMs = Date.now() - t0frame;
                    console.log(`[FRAME] Captured @ (${frameCursor.x},${frameCursor.y}) q=${frameQ} in ${frameMs}ms → window.__XOD_FRAME__`);
                    break;

                case 'stopstream':
                    this._streaming = false;
                    break;

                case 'focus':
                    // Output current state for attention-based control
                    const focus = await this.cdp.eval('window.__XOD__.digest()');
                    const st = {
                        cursor: focus.mousePos,
                        active: focus.activeElement,
                        url: focus.url
                    };
                    fs.writeFileSync('state.txt', JSON.stringify(st));
                    console.log(`[FOCUS] cursor:(${st.cursor.x},${st.cursor.y}) active:${st.active?.tag || 'none'}`);
                    break;

                case 'events':
                    const n = parseInt(args[0]) || 10;
                    console.log(`Last ${n} CDP events:`);
                    this.cdp.events.slice(-n).forEach(e => {
                        console.log(`  ${e.method}`);
                    });
                    break;

                case 'pixels':
                    // Fast canvas pixel reading - 1-5ms vs 100ms+ for CDP screenshot
                    // Usage: pixels [selector] [x y w h] or just "pixels" for overlay canvas
                    const t0px = Date.now();
                    const selector = args[0] || 'canvas';
                    const px = parseInt(args[1]) || 0;
                    const py = parseInt(args[2]) || 0;
                    const pw = parseInt(args[3]) || 100;
                    const ph = parseInt(args[4]) || 100;

                    const pixelData = await this.cdp.eval(`
                        (function() {
                            const canvas = document.querySelector('${selector}');
                            if (!canvas || canvas.tagName !== 'CANVAS') {
                                return { error: 'No canvas found: ${selector}' };
                            }
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            if (!ctx) {
                                // Try WebGL
                                const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                                if (gl) {
                                    const pixels = new Uint8Array(${pw} * ${ph} * 4);
                                    gl.readPixels(${px}, ${py}, ${pw}, ${ph}, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                                    return { 
                                        type: 'webgl',
                                        x: ${px}, y: ${py}, w: ${pw}, h: ${ph},
                                        size: pixels.length,
                                        sample: Array.from(pixels.slice(0, 16))
                                    };
                                }
                                return { error: 'Cannot get 2D or WebGL context' };
                            }
                            const img = ctx.getImageData(${px}, ${py}, ${pw}, ${ph});
                            return {
                                type: '2d',
                                x: ${px}, y: ${py}, w: ${pw}, h: ${ph},
                                size: img.data.length,
                                sample: Array.from(img.data.slice(0, 16))
                            };
                        })()
                    `);
                    const pxMs = Date.now() - t0px;

                    if (pixelData?.error) {
                        console.log(`[PIXELS] Error: ${pixelData.error}`);
                    } else {
                        console.log(`[PIXELS] ${pixelData.type} @ (${pixelData.x},${pixelData.y}) ${pixelData.w}x${pixelData.h} = ${pixelData.size} bytes in ${pxMs}ms`);
                        console.log(`  Sample RGBA: [${pixelData.sample?.join(', ')}]`);
                    }
                    break;

                case 'canvases':
                    // List all canvas elements on page
                    const canvasList = await this.cdp.eval(`
                        Array.from(document.querySelectorAll('canvas')).map((c, i) => ({
                            index: i,
                            id: c.id || null,
                            class: c.className || null,
                            width: c.width,
                            height: c.height,
                            rect: c.getBoundingClientRect()
                        }))
                    `);
                    if (!canvasList || canvasList.length === 0) {
                        console.log('[CANVASES] No canvas elements found on page');
                    } else {
                        console.log(`[CANVASES] Found ${canvasList.length}:`);
                        canvasList.forEach(c => {
                            console.log(`  [${c.index}] ${c.id || c.class || 'anonymous'} ${c.width}x${c.height} @ (${Math.round(c.rect.x)},${Math.round(c.rect.y)})`);
                        });
                    }
                    break;

                case 'render':
                    // Render entire viewport to canvas using CDP snapshot + canvas
                    // This creates a canvas we can then read with fast getImageData
                    const t0render = Date.now();

                    // Get viewport screenshot as base64, then draw to canvas
                    const b64img = await this.cdp.screenshot('png', 100);

                    const renderResult = await this.cdp.eval(`
                        (async function() {
                            // Remove old render canvas
                            const old = document.getElementById('__xod_render__');
                            if (old) old.remove();
                            
                            // Create new render canvas
                            const canvas = document.createElement('canvas');
                            canvas.id = '__xod_render__';
                            canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;opacity:0;z-index:-1;';
                            canvas.width = window.innerWidth;
                            canvas.height = window.innerHeight;
                            document.body.appendChild(canvas);
                            
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            
                            // Load the screenshot into canvas
                            const img = new Image();
                            img.src = 'data:image/png;base64,${b64img}';
                            await new Promise(r => img.onload = r);
                            ctx.drawImage(img, 0, 0);
                            
                            return {
                                id: '__xod_render__',
                                width: canvas.width,
                                height: canvas.height
                            };
                        })()
                    `);

                    const renderMs = Date.now() - t0render;
                    console.log(`[RENDER] Created ${renderResult.width}x${renderResult.height} canvas in ${renderMs}ms`);
                    console.log(`  Use: pixels #__xod_render__ x y w h`);
                    break;

                case 'sample':
                    // Quick sample: render + read pixels at cursor position
                    const t0sample = Date.now();
                    const cursorPos = this.executor.state.mousePos;
                    const sampleW = parseInt(args[0]) || 20;
                    const sampleH = parseInt(args[1]) || 20;

                    // Render first - get screenshot as data URL
                    const b64sample = await this.cdp.screenshot('png', 100);

                    // Inject the base64 and sample synchronously
                    await this.cdp.eval(`window.__xod_b64__ = '${b64sample}';`);

                    // Load image and sample - use eval with await
                    const sampleData = await this.cdp.send('Runtime.evaluate', {
                        expression: `
                            (async () => {
                                let canvas = document.getElementById('__xod_render__');
                                if (!canvas) {
                                    canvas = document.createElement('canvas');
                                    canvas.id = '__xod_render__';
                                    canvas.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;opacity:0;z-index:-1;';
                                    document.body.appendChild(canvas);
                                }
                                canvas.width = window.innerWidth;
                                canvas.height = window.innerHeight;
                                
                                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                const img = new Image();
                                img.src = 'data:image/png;base64,' + window.__xod_b64__;
                                await new Promise(r => { img.onload = r; img.onerror = r; });
                                ctx.drawImage(img, 0, 0);
                                
                                const x = Math.max(0, ${cursorPos.x} - ${Math.floor(sampleW / 2)});
                                const y = Math.max(0, ${cursorPos.y} - ${Math.floor(sampleH / 2)});
                                const data = ctx.getImageData(x, y, ${sampleW}, ${sampleH});
                                
                                let r = 0, g = 0, b = 0, count = 0;
                                for (let i = 0; i < data.data.length; i += 4) {
                                    r += data.data[i];
                                    g += data.data[i+1];
                                    b += data.data[i+2];
                                    count++;
                                }
                                
                                return JSON.stringify({
                                    x, y, w: ${sampleW}, h: ${sampleH},
                                    avgColor: { r: Math.round(r/count), g: Math.round(g/count), b: Math.round(b/count) },
                                    sample: Array.from(data.data.slice(0, 16))
                                });
                            })()
                        `,
                        awaitPromise: true,
                        returnByValue: true
                    });

                    const sampleMs = Date.now() - t0sample;
                    const parsed = JSON.parse(sampleData?.result?.value || '{}');

                    if (parsed.avgColor) {
                        console.log(`[SAMPLE] @ cursor(${cursorPos.x},${cursorPos.y}) ${sampleW}x${sampleH} in ${sampleMs}ms`);
                        console.log(`  Avg RGB: (${parsed.avgColor.r}, ${parsed.avgColor.g}, ${parsed.avgColor.b})`);
                        console.log(`  First 4px RGBA: [${parsed.sample?.join(', ') || 'N/A'}]`);
                    } else {
                        console.log(`[SAMPLE] Failed to get pixel data`);
                    }
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

    // Wire escalation to executor
    executor.escalation = escalation;

    // Setup default reflexes
    setupDefaultReflexes(executor);

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
