/**
 * BROWSIE - Direct CDP API Controller
 * Pure WebSocket CDP - no overhead
 */

import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import readline from 'readline';
import { spawn, execSync } from 'child_process';

const PORT = 9223;
let ws, id = 1;

// ═══════════════════════════════════════════════════════════════════════════
// Direct CDP WebSocket
// ═══════════════════════════════════════════════════════════════════════════

const send = (method, params = {}) => new Promise((res, rej) => {
    const i = id++;
    const h = d => { const m = JSON.parse(d); if (m.id === i) { ws.off('message', h); m.error ? rej(m.error) : res(m.result); } };
    ws.on('message', h);
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { ws.off('message', h); rej(new Error('timeout')); }, 10000);
});

// ═══════════════════════════════════════════════════════════════════════════
// CDP API - Direct calls only
// ═══════════════════════════════════════════════════════════════════════════

const CDP = {
    // Navigation
    nav: url => send('Page.navigate', { url }),

    // Mouse
    move: (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }),
    down: (x, y) => send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }),
    up: (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }),
    click: async (x, y) => { await CDP.move(x, y); await CDP.down(x, y); await CDP.up(x, y); },

    // Keyboard
    type: text => send('Input.insertText', { text }),
    keyDown: key => send('Input.dispatchKeyEvent', { type: 'keyDown', key }),
    keyUp: key => send('Input.dispatchKeyEvent', { type: 'keyUp', key }),
    press: async key => { await CDP.keyDown(key); await CDP.keyUp(key); },

    // Screenshot
    shot: async name => {
        const { data } = await send('Page.captureScreenshot', { format: 'png', quality: 40 });
        fs.writeFileSync(name || 'shot.png', Buffer.from(data, 'base64'));
    },

    // JavaScript
    eval: async js => (await send('Runtime.evaluate', { expression: js, returnByValue: true })).result?.value,

    // DOM helpers
    find: sel => CDP.eval(`(()=>{const e=document.querySelector('${sel}');if(!e)return null;const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}})()`),

    // Scroll
    scroll: (y, x = 0) => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 500, y: 400, deltaX: x, deltaY: y })
};

// ═══════════════════════════════════════════════════════════════════════════
// Connect
// ═══════════════════════════════════════════════════════════════════════════

async function connect() {
    try {
        const res = await new Promise((r, j) => http.get(`http://127.0.0.1:${PORT}/json`, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => r(JSON.parse(d))); }).on('error', j));
        ws = new WebSocket(res.find(t => t.type === 'page')?.webSocketDebuggerUrl || res[0].webSocketDebuggerUrl);
        await new Promise(r => ws.on('open', r));
    } catch {
        execSync('taskkill /F /IM chrome.exe 2>nul', { stdio: 'ignore' });
        spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [`--remote-debugging-port=${PORT}`, '--window-size=1920,1080', '--no-first-run', 'about:blank'], { detached: true, stdio: 'ignore' });
        await new Promise(r => setTimeout(r, 2000));
        return connect();
    }
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Input.setIgnoreInputEvents', { ignore: false });
    console.log('✅ CDP');
}

// ═══════════════════════════════════════════════════════════════════════════
// REPL
// ═══════════════════════════════════════════════════════════════════════════

async function repl() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = () => {
        process.stdout.write('⚡ ');
        rl.once('line', async l => {
            const [c, ...a] = l.trim().split(/\s+/);
            try {
                switch (c) {
                    case 'g': await CDP.nav(a[0]); console.log('→'); break;
                    case 'c': await CDP.click(+a[0], +a[1]); console.log('✓'); break;
                    case 't': await CDP.type(a.join(' ')); console.log('⌨'); break;
                    case 'p': await CDP.press(a[0]); console.log('↵'); break;
                    case 's': await CDP.shot(a[0]); console.log('📸'); break;
                    case 'e': console.log(await CDP.eval(a.join(' '))); break;
                    case 'f': console.log(await CDP.find(a[0])); break;
                    case 'r': await CDP.scroll(+a[0]); console.log('↓'); break;
                    case 'q': process.exit(0);
                    default: console.log('g c t p s e f r q');
                }
            } catch (e) { console.log('!', e.message); }
            ask();
        });
    };
    ask();
}

// ═══════════════════════════════════════════════════════════════════════════

await connect();
const url = process.argv.find((_, i, a) => a[i - 1] === '--url');
if (url) await CDP.nav(url);
repl();
