// Quick screenshot capture
import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';

const targets = await new Promise(r => http.get('http://127.0.0.1:9222/json', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
}));

const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise(r => ws.on('open', r));

let id = 1, h = new Map();
ws.on('message', d => { const m = JSON.parse(d); if (m.id && h.has(m.id)) { h.get(m.id)(m); h.delete(m.id); } });

const cdp = (m, p = {}) => new Promise(r => { h.set(id, r); ws.send(JSON.stringify({ id: id++, method: m, params: p })); });

await cdp('Page.enable');
const ssResult = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 50 });
fs.writeFileSync('extras/final-chat.jpg', Buffer.from(ssResult.result.data, 'base64'));

const response = await cdp('Runtime.evaluate', {
    expression: 'document.body.innerText',
    returnByValue: true
});
console.log('Page text (last 1000 chars):');
console.log(response.result?.value?.slice(-1000));

ws.close();
console.log('\nScreenshot saved: extras/final-chat.jpg');
