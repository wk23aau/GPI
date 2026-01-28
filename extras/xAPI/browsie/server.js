/**
 * Browsie Server - Browser Automation UI Backend
 * 
 * Express + WebSocket server for real-time browser automation control.
 * Integrates with CDP for Chrome automation and Cascade API for agent control.
 */
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import WebSocket from 'ws';
import http from 'http';

// Import GPI Cascade API for focus-free chat control
import api from '../../../api.js';

// Import window focus helper for accept/reject keys
import windowFocus from './window-focus.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const BROWSER_CDP_PORT = 9333;  // External Chrome browser
const ANTIGRAVITY_CDP_PORT = 9222;  // Antigravity IDE

// State
let currentTask = null;
let browserCdpWs = null;      // CDP to external browser
let antigravityCdpWs = null;  // CDP to Antigravity for chat control
let antigravityCdpId = 1;
let clients = new Set();

// ═══════════════════════════════════════════════════════════════════
// Express Server
// ═══════════════════════════════════════════════════════════════════

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = createServer(app);
const wss = new WebSocketServer({ server });

// ═══════════════════════════════════════════════════════════════════
// WebSocket - Real-time Updates
// ═══════════════════════════════════════════════════════════════════

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('📱 Client connected');

    // Send current state
    ws.send(JSON.stringify({
        type: 'status',
        task: currentTask,
        browserConnected: browserCdpWs?.readyState === WebSocket.OPEN,
        antigravityConnected: antigravityCdpWs?.readyState === WebSocket.OPEN
    }));

    ws.on('close', () => {
        clients.delete(ws);
        console.log('📱 Client disconnected');
    });
});

function broadcast(data) {
    const msg = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
// Browser CDP Connection (port 9333)
// ═══════════════════════════════════════════════════════════════════

async function listBrowserTargets() {
    return new Promise((res) => {
        http.get(`http://127.0.0.1:${BROWSER_CDP_PORT}/json/list`, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => {
                try { res(JSON.parse(d)); }
                catch { res([]); }
            });
        }).on('error', () => res([]));
    });
}

async function connectToBrowser(targetIndex = 0) {
    const targets = await listBrowserTargets();
    if (!targets.length) {
        throw new Error('No browser CDP targets available');
    }

    const target = targets[targetIndex] || targets[0];
    broadcast({ type: 'log', message: `Browser CDP: ${target.title}` });

    browserCdpWs = new WebSocket(target.webSocketDebuggerUrl);

    await new Promise((r, j) => {
        browserCdpWs.on('open', r);
        browserCdpWs.on('error', j);
        setTimeout(() => j(new Error('Browser CDP timeout')), 5000);
    });

    browserCdpWs.on('message', data => {
        const msg = JSON.parse(data);
        // Only broadcast important events, not all CDP traffic
        if (msg.method && !msg.method.includes('Runtime.consoleAPI')) {
            broadcast({ type: 'browserCdp', data: msg });
        }
    });

    await sendBrowserCdp('Runtime.enable');
    await sendBrowserCdp('Page.enable');

    broadcast({ type: 'connected', target: target.title, type2: 'browser' });
    return target;
}

let browserCdpId = 1;
async function sendBrowserCdp(method, params = {}) {
    if (!browserCdpWs || browserCdpWs.readyState !== WebSocket.OPEN) {
        throw new Error('Browser CDP not connected');
    }

    return new Promise((res, rej) => {
        const id = browserCdpId++;
        const handler = (data) => {
            const msg = JSON.parse(data);
            if (msg.id === id) {
                browserCdpWs.off('message', handler);
                msg.error ? rej(msg.error) : res(msg.result);
            }
        };
        browserCdpWs.on('message', handler);
        browserCdpWs.send(JSON.stringify({ id, method, params }));
        setTimeout(() => rej(new Error('Browser CDP timeout')), 10000);
    });
}

// ═══════════════════════════════════════════════════════════════════
// Antigravity CDP Connection (port 9222) - for creating chats
// ═══════════════════════════════════════════════════════════════════

async function listAntigravityTargets() {
    return new Promise((res) => {
        http.get(`http://127.0.0.1:${ANTIGRAVITY_CDP_PORT}/json/list`, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => {
                try { res(JSON.parse(d)); }
                catch { res([]); }
            });
        }).on('error', () => res([]));
    });
}

async function connectToAntigravity() {
    const targets = await listAntigravityTargets();
    // Find the Manager target for sending keyboard events
    const managerTarget = targets.find(t => t.title === 'Manager');

    if (!managerTarget) {
        broadcast({ type: 'log', message: 'No Antigravity Manager target found' });
        return null;
    }

    broadcast({ type: 'log', message: `Antigravity CDP: ${managerTarget.title}` });

    antigravityCdpWs = new WebSocket(managerTarget.webSocketDebuggerUrl);

    await new Promise((r, j) => {
        antigravityCdpWs.on('open', r);
        antigravityCdpWs.on('error', j);
        setTimeout(() => j(new Error('Antigravity CDP timeout')), 5000);
    });

    await sendAntigravityCdp('Runtime.enable');
    await sendAntigravityCdp('Input.enable');

    broadcast({ type: 'connected', target: 'Antigravity', type2: 'antigravity' });
    return managerTarget;
}

async function sendAntigravityCdp(method, params = {}) {
    if (!antigravityCdpWs || antigravityCdpWs.readyState !== WebSocket.OPEN) {
        throw new Error('Antigravity CDP not connected');
    }

    return new Promise((res, rej) => {
        const id = antigravityCdpId++;
        const handler = (data) => {
            const msg = JSON.parse(data);
            if (msg.id === id) {
                antigravityCdpWs.off('message', handler);
                msg.error ? rej(msg.error) : res(msg.result);
            }
        };
        antigravityCdpWs.on('message', handler);
        antigravityCdpWs.send(JSON.stringify({ id, method, params }));
        setTimeout(() => rej(new Error('Antigravity CDP timeout')), 10000);
    });
}

// Keyboard input to Antigravity (like xAPI)
async function pressAntigravityKey(key, modifiers = 0) {
    const keyMap = {
        'Enter': { keyCode: 13, code: 'Enter' },
        'l': { keyCode: 76, code: 'KeyL' },
        'Escape': { keyCode: 27, code: 'Escape' },
    };
    const kd = keyMap[key] || { keyCode: key.charCodeAt(0), code: 'Key' + key.toUpperCase() };

    await sendAntigravityCdp('Input.dispatchKeyEvent', {
        type: 'keyDown', key, code: kd.code,
        windowsVirtualKeyCode: kd.keyCode, nativeVirtualKeyCode: kd.keyCode, modifiers
    });
    await sendAntigravityCdp('Input.dispatchKeyEvent', {
        type: 'keyUp', key, code: kd.code,
        windowsVirtualKeyCode: kd.keyCode, nativeVirtualKeyCode: kd.keyCode, modifiers
    });
}

async function typeToAntigravity(text) {
    await sendAntigravityCdp('Input.insertText', { text });
}

async function createNewChatAndSendTask(task) {
    try {
        // Use focus-free Cascade API
        broadcast({ type: 'log', message: 'Discovering Antigravity language server port...' });

        // Get port and config
        const port = api.discoverPort();
        if (!port) {
            throw new Error('Could not find Antigravity language server. Is Antigravity running?');
        }
        broadcast({ type: 'log', message: `Found language server on port ${port}` });

        // Load config for CSRF token
        const config = api.loadConfig();
        if (!config.csrfToken) {
            throw new Error('No CSRF token found. Please start a chat in Antigravity first to generate one.');
        }

        // Start new cascade (chat)
        broadcast({ type: 'log', message: 'Starting new cascade conversation...' });
        const cascadeResult = await api.startCascade(port, config.csrfToken);

        if (!cascadeResult.ok) {
            throw new Error(`Failed to start cascade: ${JSON.stringify(cascadeResult)}`);
        }

        const cascadeId = cascadeResult.data?.cascadeId;
        if (!cascadeId) {
            throw new Error('No cascade ID returned');
        }
        broadcast({ type: 'log', message: `Created cascade: ${cascadeId}` });

        // Send the task message
        broadcast({ type: 'log', message: 'Sending task to agent...' });
        const sendResult = await api.sendMessage(port, config.csrfToken, cascadeId, task);

        if (!sendResult.ok) {
            throw new Error(`Failed to send message: ${JSON.stringify(sendResult)}`);
        }

        broadcast({ type: 'log', message: '✅ Task sent to Antigravity agent (focus-free)!' });
        return {
            ok: true,
            cascadeId,
            port,
            message: 'Task sent successfully'
        };
    } catch (err) {
        broadcast({ type: 'error', message: `Failed to create chat: ${err.message}` });
        return { ok: false, error: err.message };
    }
}

async function captureScreenshot() {
    try {
        const result = await sendCdp('Page.captureScreenshot', {
            format: 'jpeg',
            quality: 60
        });
        return result?.data;
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// Focus-Free Browser Automation (no window focus required)
// ═══════════════════════════════════════════════════════════════════

async function navigateTo(url) {
    broadcast({ type: 'log', message: `Navigating to: ${url}` });
    await sendCdp('Page.navigate', { url });
    // Wait for page load
    await new Promise(r => setTimeout(r, 2000));
    const screenshot = await captureScreenshot();
    if (screenshot) broadcast({ type: 'screenshot', data: screenshot });
    return { ok: true };
}

async function clickElement(selector) {
    broadcast({ type: 'log', message: `Clicking: ${selector}` });
    const result = await sendCdp('Runtime.evaluate', {
        expression: `
            (function() {
                const el = document.querySelector('${selector}');
                if (el) {
                    el.click();
                    return { ok: true, text: el.textContent?.slice(0, 50) };
                }
                return { ok: false, error: 'Element not found' };
            })()
        `,
        returnByValue: true,
        awaitPromise: true
    });
    return result?.result?.value;
}

async function typeInElement(selector, text) {
    broadcast({ type: 'log', message: `Typing in: ${selector}` });
    const result = await sendCdp('Runtime.evaluate', {
        expression: `
            (function() {
                const el = document.querySelector('${selector}');
                if (el) {
                    el.focus();
                    el.value = '${text.replace(/'/g, "\\'")}';
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    return { ok: true };
                }
                return { ok: false, error: 'Element not found' };
            })()
        `,
        returnByValue: true
    });
    return result?.result?.value;
}

async function evalJS(expression) {
    broadcast({ type: 'log', message: `Eval: ${expression.slice(0, 50)}...` });
    const result = await sendCdp('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true
    });
    return result?.result?.value;
}

async function getPageContent() {
    const result = await sendCdp('Runtime.evaluate', {
        expression: `JSON.stringify({
            url: location.href,
            title: document.title,
            text: document.body?.innerText?.slice(0, 5000)
        })`,
        returnByValue: true
    });
    return JSON.parse(result?.result?.value || '{}');
}

// ═══════════════════════════════════════════════════════════════════
// Chrome Launcher
// ═══════════════════════════════════════════════════════════════════

function launchChrome(url = 'about:blank') {
    return new Promise((resolve) => {
        broadcast({ type: 'log', message: `Launching Chrome with CDP on port ${CDP_PORT}...` });

        // Use cmd /c to avoid PowerShell argument parsing issues
        exec(`cmd /c "start chrome --remote-debugging-port=${CDP_PORT} --user-data-dir=C:/temp/browsie-chrome ${url}"`,
            (err) => {
                if (err) {
                    broadcast({ type: 'error', message: 'Failed to launch Chrome' });
                }
                // Give Chrome time to start
                setTimeout(resolve, 3000);
            }
        );
    });
}

// ═══════════════════════════════════════════════════════════════════
// Task Execution
// ═══════════════════════════════════════════════════════════════════

async function executeTask(task) {
    currentTask = { text: task, status: 'starting', startedAt: Date.now() };
    broadcast({ type: 'task', task: currentTask });

    try {
        // Check if Chrome is running with CDP
        let targets = await listCdpTargets();

        if (!targets.length) {
            broadcast({ type: 'log', message: 'No CDP targets found, launching Chrome...' });
            await launchChrome('https://google.com');
            targets = await listCdpTargets();
        }

        if (!targets.length) {
            throw new Error('Could not connect to Chrome. Please start Chrome with --remote-debugging-port=9222');
        }

        // Connect to first page target
        const pageTarget = targets.find(t => t.type === 'page') || targets[0];
        await connectToCdp(targets.indexOf(pageTarget));

        currentTask.status = 'connected';
        broadcast({ type: 'task', task: currentTask });

        // Get initial screenshot
        const screenshot = await captureScreenshot();
        if (screenshot) {
            broadcast({ type: 'screenshot', data: screenshot });
        }

        // Get page info
        const pageInfo = await sendCdp('Runtime.evaluate', {
            expression: 'JSON.stringify({ url: location.href, title: document.title })',
            returnByValue: true
        });
        broadcast({ type: 'page', data: JSON.parse(pageInfo.result.value) });

        currentTask.status = 'ready';
        broadcast({ type: 'task', task: currentTask });
        broadcast({ type: 'log', message: `Ready! Task: ${task}` });

        // Periodic screenshots
        const screenshotInterval = setInterval(async () => {
            if (currentTask?.status === 'ready' || currentTask?.status === 'running') {
                const ss = await captureScreenshot();
                if (ss) broadcast({ type: 'screenshot', data: ss });
            } else {
                clearInterval(screenshotInterval);
            }
        }, 2000);

    } catch (err) {
        currentTask.status = 'error';
        currentTask.error = err.message;
        broadcast({ type: 'error', message: err.message });
    }
}

// ═══════════════════════════════════════════════════════════════════
// API Endpoints
// ═══════════════════════════════════════════════════════════════════

app.post('/task', async (req, res) => {
    const { task } = req.body;
    if (!task) {
        return res.status(400).json({ error: 'Task required' });
    }

    executeTask(task);
    res.json({ ok: true, message: 'Task started' });
});

app.get('/status', (req, res) => {
    res.json({
        task: currentTask,
        browserConnected: browserCdpWs?.readyState === WebSocket.OPEN,
        antigravityConnected: antigravityCdpWs?.readyState === WebSocket.OPEN
    });
});

app.post('/command', async (req, res) => {
    const { method, params } = req.body;
    try {
        const result = await sendBrowserCdp(method, params || {});
        res.json({ ok: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Spawn a new Antigravity agent with a task
app.post('/spawn', async (req, res) => {
    const { task } = req.body;
    if (!task) {
        return res.status(400).json({ error: 'Task required' });
    }
    const result = await createNewChatAndSendTask(task);
    res.json(result);
});

// Spawn via UI (Focus → Ctrl+Shift+L → Paste → Enter)
// Use this when you want the new chat to be the active chat for accepts
app.post('/spawn-ui', async (req, res) => {
    const { task } = req.body;
    if (!task) {
        return res.status(400).json({ error: 'Task required' });
    }
    try {
        broadcast({ type: 'log', message: 'Creating chat via UI...' });
        const result = await windowFocus.createChatAndSend(task);
        if (result.ok) {
            broadcast({ type: 'log', message: '✅ Chat created via UI - this is now the active chat' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accept pending action (focus Antigravity, open chat by ID, Alt+Enter)
app.post('/accept', async (req, res) => {
    const { cascadeId } = req.body;
    try {
        if (cascadeId) {
            broadcast({ type: 'log', message: `Opening chat ${cascadeId.slice(0, 8)}... and accepting` });
            const result = await windowFocus.focusAcceptChat(cascadeId);
            if (result.ok) {
                broadcast({ type: 'log', message: '✅ Accept sent to specific chat (Alt+Enter)' });
            }
            res.json(result);
        } else {
            broadcast({ type: 'log', message: 'Focusing Antigravity and accepting active chat...' });
            const result = await windowFocus.focusAndAccept();
            if (result.ok) {
                broadcast({ type: 'log', message: '✅ Accept sent (Alt+Enter)' });
            }
            res.json(result);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reject pending action (focus Antigravity + Alt+Shift+Backspace)
app.post('/reject', async (req, res) => {
    try {
        broadcast({ type: 'log', message: 'Focusing Antigravity and rejecting...' });
        const result = await windowFocus.focusAndReject();
        if (result.ok) {
            broadcast({ type: 'log', message: '❌ Reject sent (Alt+Shift+Backspace)' });
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/screenshot', async (req, res) => {
    try {
        const data = await captureScreenshot();
        if (data) {
            res.json({ ok: true, data });
        } else {
            res.status(500).json({ error: 'No screenshot available' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Focus-free automation endpoints
app.post('/navigate', async (req, res) => {
    const { url } = req.body;
    try {
        const result = await navigateTo(url);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/click', async (req, res) => {
    const { selector } = req.body;
    try {
        const result = await clickElement(selector);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/type', async (req, res) => {
    const { selector, text } = req.body;
    try {
        const result = await typeInElement(selector, text);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/eval', async (req, res) => {
    const { expression } = req.body;
    try {
        const result = await evalJS(expression);
        res.json({ ok: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/content', async (req, res) => {
    try {
        const content = await getPageContent();
        res.json({ ok: true, content });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════

server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🌐 Browsie Server                                            ║
║  http://localhost:${PORT}                                       ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
