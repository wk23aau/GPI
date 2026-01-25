/**
 * GPI Browsie - GOD Mode CDP Browser Control
 * 
 * Connects to Chrome via CDP and gives you full control over:
 * - Navigation, clicks, typing, scrolling
 * - Taking screenshots
 * - Hovering, mouse events
 * - DOM inspection and manipulation
 * - Network monitoring
 * - JavaScript execution
 * 
 * Usage:
 *   node index.js                    # Interactive mode
 *   node index.js --url <url>        # Open URL first
 *   node index.js --port 9222        # Custom CDP port
 */

import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import os from 'os';

const DEFAULT_CDP_PORT = 9223;  // Use 9223 to avoid conflict with Antigravity (9222)
let messageId = 1;
let ws = null;

// Chrome paths for different OS (prioritize Chrome over Antigravity to avoid IDE conflicts)
const CHROME_PATHS = {
    win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe')
    ],
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium-browser']
};

// Kill existing Chrome processes (NOT Antigravity - that's the agent's IDE!)
async function killBrowser() {
    console.log('🔪 Killing existing Chrome processes...');
    try {
        if (process.platform === 'win32') {
            // Only kill chrome.exe, NOT Antigravity.exe!
            require('child_process').execSync('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore' });
        } else {
            require('child_process').execSync('pkill -f "chrome" 2>/dev/null || true', { stdio: 'ignore' });
        }
        await new Promise(r => setTimeout(r, 1000));
        console.log('✅ Killed existing Chrome');
    } catch { }
}

async function launchBrowser(port) {
    // Kill existing browsers first
    await killBrowser();

    const paths = CHROME_PATHS[process.platform] || CHROME_PATHS.linux;
    let chromePath = null;

    for (const p of paths) {
        if (fs.existsSync(p)) {
            chromePath = p;
            break;
        }
    }

    if (!chromePath) {
        throw new Error('Chrome/Antigravity not found. Install Chrome or specify path.');
    }

    console.log(`🚀 Launching browser: ${path.basename(chromePath)}`);

    // Use separate user data dir for debug Chrome to avoid conflicts
    const userDataDir = path.join(os.tmpdir(), 'browsie-chrome-profile');

    const browser = spawn(chromePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--new-window',
        'about:blank'
    ], { detached: true, stdio: 'ignore' });

    browser.unref();

    // Wait for browser to start
    console.log('⏳ Waiting for browser to start...');
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            await getTargets(port);
            console.log('✅ Browser started!\n');
            return;
        } catch { }
    }
    throw new Error('Browser failed to start within timeout');
}

// ═══════════════════════════════════════════════════════════════════════════
// CDP Connection
// ═══════════════════════════════════════════════════════════════════════════

async function getTargets(port) {
    return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/json`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Failed to parse CDP response')); }
            });
        }).on('error', e => reject(new Error(`CDP not available: ${e.message}`)));
    });
}

async function connect(wsUrl) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(wsUrl, { rejectUnauthorized: false });
        socket.on('open', () => resolve(socket));
        socket.on('error', reject);
    });
}

function send(method, params = {}) {
    return new Promise((resolve, reject) => {
        if (!ws) return reject(new Error('Not connected'));

        const id = messageId++;
        const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), 30000);

        const handler = (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.id === id) {
                    clearTimeout(timeout);
                    ws.off('message', handler);
                    if (msg.error) reject(new Error(msg.error.message));
                    else resolve(msg.result);
                }
            } catch { }
        };

        ws.on('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// CDP Domains - GOD MODE
// ═══════════════════════════════════════════════════════════════════════════

const GOD = {
    // Enable required domains (Input and Overlay work without explicit enable)
    async enableAll() {
        await send('Page.enable');
        await send('Network.enable');
        await send('DOM.enable');
        await send('Runtime.enable');
        // Input domain works without enable
        // Overlay might not be available in all Chrome versions
        try { await send('Overlay.enable'); } catch { }
        console.log('✅ CDP domains enabled');
    },

    // Navigation
    async goto(url) {
        console.log(`🌐 Navigating to: ${url}`);
        await send('Page.navigate', { url });
        await new Promise(r => setTimeout(r, 2000));
    },

    async reload() {
        await send('Page.reload');
    },

    // Screenshots
    async screenshot(filename = 'screenshot.png') {
        const result = await send('Page.captureScreenshot', { format: 'png' });
        const buffer = Buffer.from(result.data, 'base64');
        fs.writeFileSync(filename, buffer);
        console.log(`📸 Screenshot saved: ${filename}`);
        return filename;
    },

    // Mouse actions
    async click(x, y) {
        console.log(`🖱️ Click at (${x}, ${y})`);
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },

    async hover(x, y) {
        console.log(`👆 Hover at (${x}, ${y})`);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    },

    async scroll(deltaY = 300) {
        console.log(`📜 Scroll ${deltaY > 0 ? 'down' : 'up'}`);
        await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 400, y: 300, deltaX: 0, deltaY });
    },

    // Keyboard
    async type(text) {
        console.log(`⌨️ Typing: "${text}"`);
        await send('Input.insertText', { text });
    },

    async press(key) {
        console.log(`⌨️ Press: ${key}`);
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key });
    },

    // DOM
    async getDocument() {
        return await send('DOM.getDocument');
    },

    async querySelector(selector) {
        const doc = await send('DOM.getDocument');
        const result = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
        return result.nodeId;
    },

    async getBoxModel(nodeId) {
        const result = await send('DOM.getBoxModel', { nodeId });
        const content = result.model.content;
        return { x: content[0], y: content[1], width: content[2] - content[0], height: content[5] - content[1] };
    },

    async clickSelector(selector) {
        const nodeId = await GOD.querySelector(selector);
        if (!nodeId) throw new Error(`Element not found: ${selector}`);
        const box = await GOD.getBoxModel(nodeId);
        await GOD.click(box.x + box.width / 2, box.y + box.height / 2);
    },

    // JavaScript execution
    async eval(expression) {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true });
        return result.result?.value;
    },

    // Get page info
    async getTitle() {
        return await GOD.eval('document.title');
    },

    async getUrl() {
        return await GOD.eval('window.location.href');
    },

    async getHtml() {
        return await GOD.eval('document.documentElement.outerHTML');
    },

    // Highlight element
    async highlight(selector) {
        const nodeId = await GOD.querySelector(selector);
        await send('Overlay.highlightNode', {
            highlightConfig: { contentColor: { r: 255, g: 0, b: 255, a: 0.3 } },
            nodeId
        });
    },

    // Wait
    async wait(ms) {
        console.log(`⏳ Waiting ${ms}ms...`);
        await new Promise(r => setTimeout(r, ms));
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// Interactive Mode
// ═══════════════════════════════════════════════════════════════════════════

async function interactive() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, r));

    console.log(`
🌐 BROWSIE - GOD MODE CDP Control
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Commands:
  goto <url>         Navigate to URL
  click <x> <y>      Click at coordinates
  click <selector>   Click element by selector
  hover <x> <y>      Hover at coordinates
  type <text>        Type text
  press <key>        Press key (Enter, Tab, etc)
  scroll <amount>    Scroll (positive=down)
  screenshot [name]  Take screenshot
  eval <js>          Run JavaScript
  title              Get page title
  url                Get current URL
  wait <ms>          Wait milliseconds
  exit               Exit browsie
`);

    while (true) {
        const input = await ask('\n🔮 browsie> ');
        const parts = input.trim().split(/\s+/);
        const cmd = parts[0]?.toLowerCase();
        const arg1 = parts[1];
        const arg2 = parts[2];

        try {
            switch (cmd) {
                case 'goto':
                    await GOD.goto(arg1);
                    break;
                case 'click':
                    if (arg2) await GOD.click(parseInt(arg1), parseInt(arg2));
                    else await GOD.clickSelector(arg1);
                    break;
                case 'hover':
                    await GOD.hover(parseInt(arg1), parseInt(arg2));
                    break;
                case 'type':
                    await GOD.type(parts.slice(1).join(' '));
                    break;
                case 'press':
                    await GOD.press(arg1);
                    break;
                case 'scroll':
                    await GOD.scroll(parseInt(arg1) || 300);
                    break;
                case 'screenshot':
                    await GOD.screenshot(arg1 || `screenshot_${Date.now()}.png`);
                    break;
                case 'eval':
                    const result = await GOD.eval(parts.slice(1).join(' '));
                    console.log('📤 Result:', result);
                    break;
                case 'title':
                    console.log('📄 Title:', await GOD.getTitle());
                    break;
                case 'url':
                    console.log('🔗 URL:', await GOD.getUrl());
                    break;
                case 'wait':
                    await GOD.wait(parseInt(arg1) || 1000);
                    break;
                case 'exit':
                case 'quit':
                    console.log('👋 Goodbye!');
                    rl.close();
                    process.exit(0);
                default:
                    if (cmd) console.log('❓ Unknown command. Type a command or "exit".');
            }
        } catch (e) {
            console.error('❌ Error:', e.message);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);
    const portIndex = args.indexOf('--port');
    const urlIndex = args.indexOf('--url');
    const noLaunch = args.includes('--no-launch');

    const port = portIndex >= 0 ? parseInt(args[portIndex + 1]) : DEFAULT_CDP_PORT;
    const startUrl = urlIndex >= 0 ? args[urlIndex + 1] : null;

    console.log(`🔗 Connecting to CDP on port ${port}...`);

    let targets;
    try {
        targets = await getTargets(port);
    } catch (e) {
        if (noLaunch) {
            console.error('❌ Browser not running. Start it with --remote-debugging-port=' + port);
            process.exit(1);
        }

        // Auto-launch browser
        console.log('🔍 No browser found. Launching...');
        await launchBrowser(port);
        targets = await getTargets(port);
    }

    const page = targets.find(t => t.type === 'page');

    if (!page) {
        console.error('❌ No browser page found.');
        process.exit(1);
    }

    console.log(`📄 Found page: ${page.title || page.url}`);
    ws = await connect(page.webSocketDebuggerUrl);
    console.log('✅ Connected to browser!\n');

    await GOD.enableAll();

    if (startUrl) {
        await GOD.goto(startUrl);
    }

    // Export GOD for programmatic use
    global.GOD = GOD;

    await interactive();
}

main();

export { GOD };
