/**
 * Test IPC command execution for new chat
 */
import WebSocket from 'ws';
import http from 'http';

const PORT = 9222;

async function listTargets() {
    return new Promise((res) => {
        http.get(`http://127.0.0.1:${PORT}/json/list`, r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
        }).on('error', () => res([]));
    });
}

async function connectAndEval(targetIndex, js) {
    const targets = await listTargets();
    const target = targets[targetIndex];
    if (!target) throw new Error('Target not found');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });

    let id = 1;
    const send = (method, params = {}) => new Promise((res, rej) => {
        const reqId = id++;
        const timeout = setTimeout(() => rej(new Error('Timeout')), 5000);
        ws.on('message', function handler(data) {
            const m = JSON.parse(data);
            if (m.id === reqId) {
                clearTimeout(timeout);
                ws.off('message', handler);
                m.error ? rej(m.error) : res(m.result);
            }
        });
        ws.send(JSON.stringify({ id: reqId, method, params }));
    });

    await send('Runtime.enable');
    const result = await send('Runtime.evaluate', {
        expression: js,
        returnByValue: true,
        awaitPromise: true
    });

    ws.close();
    return result?.result?.value;
}

// Try to execute command via IPC
const ipcCommandTest = `
(async function() {
    try {
        // Try to invoke command execution via IPC
        // VSCode uses 'vscode:executeCommand' channel
        const result = await vscode.ipcRenderer.invoke('vscode:executeCommand', 
            'workbench.action.chat.newChat'  // or 'cascade.newChat'
        );
        return JSON.stringify({ success: true, result });
    } catch (e) {
        return JSON.stringify({ success: false, error: e.message, stack: e.stack?.slice(0, 200) });
    }
})()
`;

console.log('🔍 Testing IPC command execution...\n');

try {
    const result = await connectAndEval(1, ipcCommandTest);
    console.log('Result:', result);
} catch (err) {
    console.error('Error:', err.message);
}
