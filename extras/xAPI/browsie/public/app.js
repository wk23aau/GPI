/**
 * Browsie Frontend Application
 * WebSocket client for real-time browser automation updates
 */

const WS_URL = `ws://${location.host}`;
let ws = null;

// DOM Elements
const statusEl = document.getElementById('status');
const taskInput = document.getElementById('taskInput');
const sendBtn = document.getElementById('sendBtn');
const logOutput = document.getElementById('logOutput');
const preview = document.getElementById('preview');
const noPreview = document.getElementById('noPreview');
const pageInfo = document.getElementById('pageInfo');

// ═══════════════════════════════════════════════════════════════════
// WebSocket Connection
// ═══════════════════════════════════════════════════════════════════

function connect() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        updateStatus('connected');
        log('Connected to Browsie server', 'success');
    };

    ws.onclose = () => {
        updateStatus('disconnected');
        log('Disconnected from server', 'error');
        // Reconnect after 2 seconds
        setTimeout(connect, 2000);
    };

    ws.onerror = () => {
        log('WebSocket error', 'error');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data);
    };
}

// ═══════════════════════════════════════════════════════════════════
// Message Handlers
// ═══════════════════════════════════════════════════════════════════

function handleMessage(data) {
    switch (data.type) {
        case 'log':
            log(data.message);
            break;
        case 'error':
            log(data.message, 'error');
            break;
        case 'connected':
            log(`Connected to CDP: ${data.target}`, 'success');
            break;
        case 'screenshot':
            updatePreview(data.data);
            break;
        case 'page':
            updatePageInfo(data.data);
            break;
        case 'task':
            updateTaskStatus(data.task);
            break;
        case 'cdp':
            // CDP messages can be verbose, log selectively
            if (data.data?.method) {
                log(`CDP: ${data.data.method}`);
            }
            break;
        case 'status':
            if (data.connected) {
                updateStatus('connected');
            }
            break;
    }
}

// ═══════════════════════════════════════════════════════════════════
// UI Updates
// ═══════════════════════════════════════════════════════════════════

function updateStatus(status) {
    statusEl.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
    statusEl.className = `status ${status}`;
}

function log(message, type = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${time}]</span> ${escapeHtml(message)}`;

    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updatePreview(base64Data) {
    preview.src = `data:image/jpeg;base64,${base64Data}`;
    preview.style.display = 'block';
    noPreview.style.display = 'none';
}

function updatePageInfo(data) {
    pageInfo.innerHTML = `<strong>${data.title || 'Untitled'}</strong> - ${data.url}`;
}

function updateTaskStatus(task) {
    if (task) {
        log(`Task status: ${task.status}`);
    }
}

// ═══════════════════════════════════════════════════════════════════
// Task Submission
// ═══════════════════════════════════════════════════════════════════

async function submitTask() {
    const task = taskInput.value.trim();
    if (!task) {
        log('Please enter a task', 'error');
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Starting...';

    try {
        const response = await fetch('/task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task })
        });

        const result = await response.json();

        if (result.ok) {
            log('Task submitted successfully', 'success');
        } else {
            log(`Error: ${result.error}`, 'error');
        }
    } catch (err) {
        log(`Failed to submit task: ${err.message}`, 'error');
    }

    sendBtn.disabled = false;
    sendBtn.textContent = '▶ Execute Task';
}

// ═══════════════════════════════════════════════════════════════════
// Event Listeners
// ═══════════════════════════════════════════════════════════════════

sendBtn.addEventListener('click', submitTask);

taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        submitTask();
    }
});

// ═══════════════════════════════════════════════════════════════════
// Initialize
// ═══════════════════════════════════════════════════════════════════

connect();
log('Browsie initialized. Enter a task and click Execute.');
