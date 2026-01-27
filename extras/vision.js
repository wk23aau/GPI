/**
 * Vision-First CDP - Optimized for AI vision analysis
 * Portrait viewport, 5% JPEG quality, multi-touch support
 */
import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';

const PORT = 9223;
const WIDTH = 412;  // Pixel 5 width
const HEIGHT = 915; // Pixel 5 height

class Vision {
    constructor() { this.ws = null; this.id = 1; this.handlers = new Map(); }

    async connect() {
        const targets = await new Promise((resolve, reject) => {
            http.get(`http://127.0.0.1:${PORT}/json`, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });
        this.ws = new WebSocket(targets[0].webSocketDebuggerUrl);
        await new Promise(r => this.ws.on('open', r));
        this.ws.on('message', d => {
            const m = JSON.parse(d);
            if (m.id && this.handlers.has(m.id)) { this.handlers.get(m.id)(m); this.handlers.delete(m.id); }
        });
        await this.send('Page.enable');
        await this.send('Runtime.enable');
        await this.send('Input.setIgnoreInputEvents', { ignore: false });
        // Set mobile viewport
        await this.send('Emulation.setDeviceMetricsOverride', {
            width: WIDTH, height: HEIGHT, deviceScaleFactor: 2.625, mobile: true,
            screenWidth: WIDTH, screenHeight: HEIGHT
        });
        await this.send('Emulation.setTouchEmulationEnabled', { enabled: true });
        return this;
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.handlers.set(id, m => m.error ? reject(m.error) : resolve(m.result));
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    close() { this.ws?.close(); }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE VISION METHODS
    // ═══════════════════════════════════════════════════════════════════════

    async screenshot(path = 'extras/view.jpg') {
        const { data } = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 5 });
        fs.writeFileSync(path, Buffer.from(data, 'base64'));
        return path;
    }

    async nav(url) {
        await this.send('Page.navigate', { url });
        await new Promise(r => setTimeout(r, 2000)); // Wait for load
    }

    async tap(x, y) {
        await this.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x, y }]
        });
        await new Promise(r => setTimeout(r, 50));
        await this.send('Input.dispatchTouchEvent', {
            type: 'touchEnd', touchPoints: []
        });
    }

    async doubleTap(x, y) {
        await this.tap(x, y);
        await new Promise(r => setTimeout(r, 100));
        await this.tap(x, y);
    }

    async longPress(x, y, duration = 500) {
        await this.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x, y }]
        });
        await new Promise(r => setTimeout(r, duration));
        await this.send('Input.dispatchTouchEvent', {
            type: 'touchEnd', touchPoints: []
        });
    }

    async swipe(x1, y1, x2, y2, steps = 10) {
        await this.send('Input.dispatchTouchEvent', {
            type: 'touchStart', touchPoints: [{ x: x1, y: y1 }]
        });
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            await this.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [{ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t }]
            });
            await new Promise(r => setTimeout(r, 20));
        }
        await this.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }

    async type(text) {
        await this.send('Input.insertText', { text });
    }

    async key(key, code, keyCode) {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode });
    }

    async enter() { await this.key('Enter', 'Enter', 13); }

    async eval(js) {
        const r = await this.send('Runtime.evaluate', { expression: js, returnByValue: true });
        return r?.result?.value;
    }

    async info() {
        return this.eval('({ url: location.href, title: document.title })');
    }
}

export default Vision;

// CLI
if (process.argv[1]?.endsWith('vision.js')) {
    const v = new Vision();
    try {
        await v.connect();
        const [, , cmd, a1, a2, a3, a4] = process.argv;
        switch (cmd) {
            case 'nav': await v.nav(a1); console.log('NAV:', a1); break;
            case 'ss': console.log(await v.screenshot()); break;
            case 'tap': await v.tap(+a1, +a2); console.log('TAP:', a1, a2); break;
            case 'dtap': await v.doubleTap(+a1, +a2); console.log('DTAP:', a1, a2); break;
            case 'long': await v.longPress(+a1, +a2, +a3 || 500); console.log('LONG:', a1, a2); break;
            case 'swipe': await v.swipe(+a1, +a2, +a3, +a4); console.log('SWIPE'); break;
            case 'type': await v.type(a1); console.log('TYPE:', a1); break;
            case 'enter': await v.enter(); console.log('ENTER'); break;
            case 'eval': console.log(await v.eval(a1)); break;
            case 'info': console.log(await v.info()); break;
            default: console.log('Commands: nav URL, ss, tap X Y, dtap X Y, long X Y [ms], swipe X1 Y1 X2 Y2, type TEXT, enter, eval JS, info');
        }
    } catch (e) { console.error('ERR:', e.message); }
    finally { v.close(); }
}
