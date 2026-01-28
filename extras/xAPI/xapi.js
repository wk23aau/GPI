/**
 * xAPI - CDP-Based Antigravity Control
 * 
 * Uses Chrome DevTools Protocol Input domain for native keyboard simulation.
 * Replaces HTTP API messaging with proven keyboard shortcuts.
 * 
 * Usage:
 *   import { AntigravityClient } from './xapi.js';
 *   const client = new AntigravityClient();
 *   await client.connect();
 *   await client.sendMessage('Hello world');
 *   await client.accept();
 */
import WebSocket from 'ws';
import http from 'http';

const CDP_PORT = 9222;

/**
 * AntigravityClient - CDP-based control for Antigravity
 */
export class AntigravityClient {
    constructor(port = CDP_PORT) {
        this.port = port;
        this.ws = null;
        this.id = 1;
        this.handlers = new Map();
        this.targetInfo = null;
    }

    // ═══════════════════════════════════════════════════════════════════
    // Connection
    // ═══════════════════════════════════════════════════════════════════

    async listTargets() {
        return new Promise((res, rej) => {
            http.get(`http://127.0.0.1:${this.port}/json/list`, r => {
                let d = '';
                r.on('data', c => d += c);
                r.on('end', () => res(JSON.parse(d)));
            }).on('error', rej);
        });
    }

    async connect(targetIndex = null) {
        const targets = await this.listTargets();

        // Auto-select main editor page if no index specified
        let target;
        if (targetIndex !== null) {
            target = targets[targetIndex];
        } else {
            // Find main editor page (contains "Antigravity" but not "Manager"/"Launchpad")
            target = targets.find(t =>
                t.type === 'page' &&
                t.title?.includes('Antigravity') &&
                !t.title?.includes('Manager') &&
                !t.title?.includes('Launchpad')
            ) || targets.find(t => t.type === 'page') || targets[0];
        }

        if (!target) {
            throw new Error('No CDP target found. Is Antigravity running with --remote-debugging-port=9222?');
        }

        this.targetInfo = target;
        this.ws = new WebSocket(target.webSocketDebuggerUrl);

        await new Promise((r, j) => {
            this.ws.on('open', r);
            this.ws.on('error', j);
        });

        this.ws.on('message', d => {
            const m = JSON.parse(d);
            if (m.id && this.handlers.has(m.id)) {
                this.handlers.get(m.id)(m);
                this.handlers.delete(m.id);
            }
        });

        await this.send('Runtime.enable');
        await this.send('Input.enable').catch(() => { });

        return target;
    }

    /**
     * Connect specifically to Manager target (index 0)
     * Use when user is focused on the Agent Manager preview window
     */
    async connectToManager() {
        const targets = await this.listTargets();
        const managerTarget = targets.find(t => t.title === 'Manager');

        if (!managerTarget) {
            throw new Error('Manager target not found');
        }

        this.targetInfo = managerTarget;
        this.ws = new WebSocket(managerTarget.webSocketDebuggerUrl);

        await new Promise((r, j) => {
            this.ws.on('open', r);
            this.ws.on('error', j);
        });

        this.ws.on('message', d => {
            const m = JSON.parse(d);
            if (m.id && this.handlers.has(m.id)) {
                this.handlers.get(m.id)(m);
                this.handlers.delete(m.id);
            }
        });

        await this.send('Runtime.enable');
        await this.send('Input.enable').catch(() => { });

        return managerTarget;
    }

    send(method, params = {}) {
        return new Promise((res, rej) => {
            const id = this.id++;
            const timeout = setTimeout(() => rej(new Error('CDP timeout')), 10000);
            this.handlers.set(id, m => {
                clearTimeout(timeout);
                m.error ? rej(m.error) : res(m.result);
            });
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

    close() {
        this.ws?.close();
    }

    // ═══════════════════════════════════════════════════════════════════
    // Native Keyboard Input
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Press a key with optional modifiers
     * @param {string} key - Key name (e.g., 'Enter', 'a', 'ArrowDown')
     * @param {number} modifiers - Bitmask: 1=Alt, 2=Ctrl, 4=Meta, 8=Shift
     */
    async pressKey(key, modifiers = 0) {
        const keyMap = {
            'Enter': { keyCode: 13, code: 'Enter' },
            'Tab': { keyCode: 9, code: 'Tab' },
            'Escape': { keyCode: 27, code: 'Escape' },
            'Backspace': { keyCode: 8, code: 'Backspace' },
            'ArrowDown': { keyCode: 40, code: 'ArrowDown' },
            'ArrowUp': { keyCode: 38, code: 'ArrowUp' },
            'ArrowLeft': { keyCode: 37, code: 'ArrowLeft' },
            'ArrowRight': { keyCode: 39, code: 'ArrowRight' },
            'a': { keyCode: 65, code: 'KeyA' },
            'b': { keyCode: 66, code: 'KeyB' },
            'l': { keyCode: 76, code: 'KeyL' },
            'i': { keyCode: 73, code: 'KeyI' },
            'j': { keyCode: 74, code: 'KeyJ' },
            'k': { keyCode: 75, code: 'KeyK' },
        };

        const kd = keyMap[key] || {
            keyCode: key.toUpperCase().charCodeAt(0),
            code: 'Key' + key.toUpperCase()
        };

        await this.send('Input.dispatchKeyEvent', {
            type: 'keyDown',
            key,
            code: kd.code,
            windowsVirtualKeyCode: kd.keyCode,
            nativeVirtualKeyCode: kd.keyCode,
            modifiers
        });

        await this.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key,
            code: kd.code,
            windowsVirtualKeyCode: kd.keyCode,
            nativeVirtualKeyCode: kd.keyCode,
            modifiers
        });
    }

    /**
     * Type text into focused element
     */
    async typeText(text) {
        await this.send('Input.insertText', { text });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Messaging API (replaces api.sendMessage)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Send a message to Antigravity chat
     * @param {string} message - Message text to send
     */
    async sendMessage(message) {
        // No focus needed - assumes input already focused (e.g. after newchat)
        await this.typeText(message);
        await new Promise(r => setTimeout(r, 50));
        await this.pressKey('Enter');
        return { ok: true, message: 'Message sent via CDP' };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Conversation Management
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Open a new chat (Ctrl+Shift+L)
     */
    async newChat() {
        await this.pressKey('l', 10); // Ctrl+Shift = 2+8 = 10
        return { ok: true, action: 'newChat' };
    }

    /**
     * Open conversation picker (Ctrl+Shift+A)
     */
    async openConversationPicker() {
        await this.pressKey('a', 10);
        return { ok: true, action: 'openConversationPicker' };
    }

    /**
     * Toggle/open chat panel (Ctrl+Alt+B)
     */
    async toggleChatPanel() {
        await this.pressKey('b', 3); // Ctrl+Alt = 2+1 = 3
        return { ok: true, action: 'toggleChatPanel' };
    }

    /**
     * Focus chat input - uses toggleChatPanel to ensure panel is open
     */
    async focusChat() {
        // Note: Ctrl+L may close panel, use toggleChatPanel + wait instead
        await this.toggleChatPanel();
        await new Promise(r => setTimeout(r, 300));
        return { ok: true, action: 'focusChat' };
    }

    /**
     * Trigger agent mode (Ctrl+Shift+I)
     */
    async triggerAgent() {
        await this.pressKey('i', 10);
        return { ok: true, action: 'triggerAgent' };
    }

    /**
     * Switch to a conversation by index in the picker
     * @param {number} index - 0-based index in picker list
     */
    async switchConversation(index) {
        await this.openConversationPicker();
        await new Promise(r => setTimeout(r, 300));

        for (let i = 0; i < index; i++) {
            await this.pressKey('ArrowDown');
            await new Promise(r => setTimeout(r, 50));
        }

        await this.pressKey('Enter');
        return { ok: true, action: 'switchConversation', index };
    }

    /**
     * List conversations by querying Manager page DOM
     * Note: Requires connecting to Manager target
     */
    async listConversations() {
        // Save current connection
        const currentTarget = this.targetInfo;

        try {
            // Find and connect to Manager target
            const targets = await this.listTargets();
            const managerTarget = targets.find(t => t.title === 'Manager');

            if (!managerTarget) {
                return { ok: false, error: 'Manager target not found' };
            }

            // Connect to Manager temporarily
            const managerWs = new WebSocket(managerTarget.webSocketDebuggerUrl);
            await new Promise((r, j) => {
                managerWs.on('open', r);
                managerWs.on('error', j);
            });

            // Query for conversation IDs
            const result = await new Promise((res) => {
                const id = Date.now();
                managerWs.on('message', d => {
                    const m = JSON.parse(d);
                    if (m.id === id) res(m.result?.result?.value);
                });
                managerWs.send(JSON.stringify({
                    id,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: `
                            Array.from(document.querySelectorAll('button'))
                                .filter(e => e.outerHTML?.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/))
                                .map(e => ({
                                    id: e.outerHTML.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/)?.[0],
                                    title: e.closest('div')?.textContent?.substring(0, 50)?.trim()
                                }))
                        `,
                        returnByValue: true
                    }
                }));
            });

            managerWs.close();
            return { ok: true, conversations: result || [] };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // Agent Actions (replaces api.acceptCommand, api.rejectCommand)
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Accept agent step (Alt+Enter)
     */
    async accept() {
        await this.pressKey('Enter', 1); // Alt = 1
        return { ok: true, action: 'accept' };
    }

    /**
     * Reject agent step (Alt+Shift+Backspace)
     */
    async reject() {
        await this.pressKey('Backspace', 9); // Alt+Shift = 1+8 = 9
        return { ok: true, action: 'reject' };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Hunk Navigation
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Navigate to next diff hunk (Alt+J)
     */
    async nextHunk() {
        await this.pressKey('j', 1);
        return { ok: true, action: 'nextHunk' };
    }

    /**
     * Navigate to previous diff hunk (Alt+K)
     */
    async prevHunk() {
        await this.pressKey('k', 1);
        return { ok: true, action: 'prevHunk' };
    }

    // ═══════════════════════════════════════════════════════════════════
    // Utility
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Press Escape to cancel/close
     */
    async escape() {
        await this.pressKey('Escape');
        return { ok: true, action: 'escape' };
    }

    /**
     * Press Tab
     */
    async tab() {
        await this.pressKey('Tab');
        return { ok: true, action: 'tab' };
    }

    /**
     * Get connection status
     */
    status() {
        return {
            connected: this.ws?.readyState === WebSocket.OPEN,
            port: this.port,
            target: this.targetInfo?.title || null
        };
    }
}

// Default export
export default AntigravityClient;
