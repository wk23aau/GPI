/**
 * XOD Executor - The 30 Hz tick loop engine
 * 
 * This is the heart of XOD. It runs continuously at 30-120 Hz,
 * never blocking on models or slow operations.
 */

import { glide, bezier, click, type, key, sleep } from './input.js';
import { moveCursor, clickRipple, highlightRect } from './overlay.js';

export class Executor {
    constructor(cdp) {
        this.cdp = cdp;
        this.running = false;
        this.tickRate = 33; // ms (30 Hz)
        this.lastDeltaId = 0;

        // Frame state - the canonical world model
        this.state = {
            url: '',
            title: '',
            activeElement: null,
            mousePos: { x: 0, y: 0 },
            viewport: { w: 0, h: 0 },
            scroll: { x: 0, y: 0 },
            loading: false,
            watches: new Map(),
            lastClickFailed: false
        };

        // Escalation handler (set by main)
        this.escalation = null;
        this.lastUrl = '';

        // Action queue with priorities
        this.actionQueue = [];
        this.actionBudgetMs = 20; // Max ms per tick for actions

        // Reflexes (fast local rules)
        this.reflexes = [];

        // Event handlers
        this.onDelta = null;
        this.onReflex = null;
        this.onStateChange = null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Tick Loop
    // ═══════════════════════════════════════════════════════════════════════

    start() {
        if (this.running) return;
        this.running = true;
        this._tick();
        console.log(`[XOD] Executor started @ ${Math.round(1000 / this.tickRate)} Hz`);
    }

    stop() {
        this.running = false;
        console.log('[XOD] Executor stopped');
    }

    async _tick() {
        if (!this.running) return;

        const tickStart = Date.now();

        try {
            // 0. Check CDP connection
            if (!this.cdp.connected) {
                console.warn('[XOD] CDP disconnected, stopping executor');
                this.stop();
                return;
            }

            // 1. Drain deltas from page agent
            await this._drainDeltas();

            // 2. Check for navigation (escalation trigger)
            if (this.escalation && this.state.url !== this.lastUrl) {
                this.escalation.checkNavigation(this.lastUrl, this.state.url);
                this.lastUrl = this.state.url;
            }

            // 3. Check reflexes (fast local rules)
            await this._checkReflexes();

            // 4. Execute queued actions (budget limited)
            const actionExecuted = await this._executeActions();

            // 5. Check for stuck state (escalation trigger)
            if (this.escalation) {
                this.escalation.checkStuck(actionExecuted, this.actionQueue.length > 0);
            }

        } catch (err) {
            console.error('[XOD] Tick error:', err.message);
        }

        // Schedule next tick
        const tickDuration = Date.now() - tickStart;
        const nextDelay = Math.max(1, this.tickRate - tickDuration);
        setTimeout(() => this._tick(), nextDelay);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Delta Draining
    // ═══════════════════════════════════════════════════════════════════════

    async _drainDeltas() {
        const result = await this.cdp.eval(`window.__XOD__?.drain(${this.lastDeltaId})`);
        if (!result || !result.deltas) return;

        this.lastDeltaId = result.lastId;
        this.state.mousePos = result.mousePos;

        for (const delta of result.deltas) {
            // Update state based on delta type
            if (delta.type === 'visibility') {
                this.state.watches.set(delta.selector, {
                    visible: delta.visible,
                    rect: delta.rect
                });
            }

            // Notify listeners
            if (this.onDelta) this.onDelta(delta);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Reflexes (Fast Local Rules)
    // ═══════════════════════════════════════════════════════════════════════

    addReflex(name, condition, action) {
        this.reflexes.push({ name, condition, action });
    }

    async _checkReflexes() {
        for (const reflex of this.reflexes) {
            if (reflex.condition(this.state)) {
                console.log(`[XOD] Reflex triggered: ${reflex.name}`);
                await reflex.action(this);
                if (this.onReflex) this.onReflex(reflex.name);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Action Queue
    // ═══════════════════════════════════════════════════════════════════════

    enqueue(action, priority = 0) {
        this.actionQueue.push({ ...action, priority });
        this.actionQueue.sort((a, b) => b.priority - a.priority);
    }

    async _executeActions() {
        const budgetStart = Date.now();
        let executed = false;

        while (this.actionQueue.length > 0) {
            if (Date.now() - budgetStart > this.actionBudgetMs) break;

            const action = this.actionQueue.shift();
            try {
                await this._executeAction(action);
                executed = true;
                this.state.lastClickFailed = false;

                // Report success to escalation
                if (this.escalation) {
                    this.escalation.checkRepeatedFailures(action, true);
                }
            } catch (err) {
                console.error(`[XOD] Action ${action.type} failed:`, err.message);
                this.state.lastClickFailed = (action.type === 'click');

                // Report failure to escalation
                if (this.escalation) {
                    this.escalation.checkRepeatedFailures(action, false);
                }
            }
        }
        return executed;
    }

    async _executeAction(action) {
        const send = (method, params) => this.cdp.send(method, params);

        switch (action.type) {
            case 'glide':
                await glide(send, action.from, action.to, action.steps, action.ms);
                await moveCursor(send, action.to.x, action.to.y);
                this.state.mousePos = action.to;
                break;

            case 'bezier':
                await bezier(send, action.from, action.to, action.steps, action.ms);
                await moveCursor(send, action.to.x, action.to.y);
                this.state.mousePos = action.to;
                break;

            case 'click':
                await click(send, action.x, action.y, action.button || 'left');
                await clickRipple(send, action.x, action.y);
                break;

            case 'type':
                await type(send, action.text);
                break;

            case 'key':
                await key(send, action.key);
                break;

            case 'highlight':
                await highlightRect(send, action.rect);
                break;

            case 'watch':
                await this.cdp.eval(`window.__XOD__?.watch("${action.selector}")`);
                break;

            case 'scroll':
                await send('Input.dispatchMouseEvent', {
                    type: 'mouseWheel',
                    x: this.state.mousePos.x,
                    y: this.state.mousePos.y,
                    deltaX: action.deltaX || 0,
                    deltaY: action.deltaY || 0
                });
                break;

            default:
                console.warn(`[XOD] Unknown action type: ${action.type}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // High-Level Commands
    // ═══════════════════════════════════════════════════════════════════════

    async glideTo(x, y, steps = 25, ms = 140) {
        const send = (method, params) => this.cdp.send(method, params);
        const from = this.state.mousePos;
        const to = { x, y };

        // Execute glide directly (not queued)
        await glide(send, from, to, steps, ms);
        await moveCursor(send, to.x, to.y);
        this.state.mousePos = to;
    }

    async bezierTo(x, y, steps = 30, ms = 180) {
        const send = (method, params) => this.cdp.send(method, params);
        const from = this.state.mousePos;
        const to = { x, y };

        // Execute bezier curve directly (not queued)
        await bezier(send, from, to, steps, ms);
        await moveCursor(send, to.x, to.y);
        this.state.mousePos = to;
    }

    async clickAt(x, y) {
        // Enqueue glide first
        this.enqueue({
            type: 'glide',
            from: this.state.mousePos,
            to: { x, y },
            steps: 25,
            ms: 140
        }, 10);

        // Enqueue click with slightly lower priority so glide completes first
        this.enqueue({ type: 'click', x, y }, 9);
    }

    async typeText(text) {
        this.enqueue({ type: 'type', text }, 5);
    }

    async pressKey(keyName) {
        this.enqueue({ type: 'key', key: keyName }, 5);
    }

    async watch(selector) {
        this.enqueue({ type: 'watch', selector }, 1);
    }

    async highlight(rect) {
        this.enqueue({ type: 'highlight', rect }, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // State Queries
    // ═══════════════════════════════════════════════════════════════════════

    async refreshDigest() {
        const digest = await this.cdp.eval(`window.__XOD__?.digest()`);
        if (digest) {
            this.state.url = digest.url;
            this.state.title = digest.title;
            this.state.activeElement = { tag: digest.activeTag, id: digest.activeId };
            this.state.viewport = digest.viewport;
            this.state.scroll = digest.scroll;
            this.state.mousePos = digest.mousePos;
        }
        return this.state;
    }

    async getClickables() {
        return await this.cdp.eval(`window.__XOD__?.clickables()`);
    }

    async findByText(text) {
        return await this.cdp.eval(`window.__XOD__?.find("${text.replace(/"/g, '\\"')}")`);
    }

    async getBbox(selector) {
        return await this.cdp.eval(`window.__XOD__?.bbox("${selector.replace(/"/g, '\\"')}")`);
    }
}
