/**
 * CDP Full Protocol - Main World Script
 * 
 * FIXES ALL COORDINATION ISSUES:
 * 1. State survives navigation (rehydrated from background)
 * 2. Protocol fields for causality (EPOCH, ACTION_ID, ACKs)
 * 3. Single writer rules enforced
 * 4. Lock mechanism for atomic operations
 */

(() => {
    // Skip if already loaded
    if (window.__cdp) return;

    // ═══════════════════════════════════════════════════════════════
    // PROTOCOL STATE - Persisted across navigations
    // ═══════════════════════════════════════════════════════════════

    // Rehydrate from bootstrap (injected by background.js)
    const bootstrapState = window.__cdp_coord_bootstrap || {};
    delete window.__cdp_coord_bootstrap;

    const Protocol = {
        // Navigation tracking
        EPOCH: bootstrapState.EPOCH || Date.now(),

        // Action causality
        ACTION_ID: bootstrapState.ACTION_ID || 0,

        // Agent status (idle | ready | executing | analyzing)
        EXEC_STATUS: bootstrapState.EXEC_STATUS || 'idle',
        VISION_STATUS: bootstrapState.VISION_STATUS || 'idle',

        // Plans
        EXEC_PLAN: bootstrapState.EXEC_PLAN || null,
        VISION_PLAN: bootstrapState.VISION_PLAN || null,

        // Acknowledgments (agents confirm seeing each other's actions)
        EXEC_ACK: bootstrapState.EXEC_ACK || 0,
        VISION_ACK: bootstrapState.VISION_ACK || 0,

        // Last writer tracking
        LAST_MUTATION_BY: bootstrapState.LAST_MUTATION_BY || null,
        LAST_MUTATION_TS: Date.now(),

        // Lock for atomic operations (null | 'exec' | 'vision')
        LOCK: bootstrapState.LOCK || null,
        LOCK_TS: 0
    };

    // ═══════════════════════════════════════════════════════════════
    // WORLD STATE - Fresh on each page (UI, network, etc)
    // ═══════════════════════════════════════════════════════════════

    const WorldState = {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        uiMap: [],
        networkInflight: 0,
        errors: [],
        toasts: [],
        focusedElement: null,
        ts: Date.now()
    };

    // ═══════════════════════════════════════════════════════════════
    // PROTOCOL METHODS - Safe coordination
    // ═══════════════════════════════════════════════════════════════

    const ProtocolAPI = {
        // Executor writes
        execWrite(updates) {
            const allowed = ['EXEC_STATUS', 'EXEC_PLAN', 'EXEC_ACK', 'ACTION_ID', 'LOCK'];
            for (const key of Object.keys(updates)) {
                if (allowed.includes(key)) {
                    Protocol[key] = updates[key];
                }
            }
            Protocol.LAST_MUTATION_BY = 'exec';
            Protocol.LAST_MUTATION_TS = Date.now();
            this._persist();
            return Protocol;
        },

        // Vision writes
        visionWrite(updates) {
            const allowed = ['VISION_STATUS', 'VISION_PLAN', 'VISION_ACK'];
            for (const key of Object.keys(updates)) {
                if (allowed.includes(key)) {
                    Protocol[key] = updates[key];
                }
            }
            Protocol.LAST_MUTATION_BY = 'vision';
            Protocol.LAST_MUTATION_TS = Date.now();
            this._persist();
            return Protocol;
        },

        // Increment action ID (executor only, before each action)
        nextAction() {
            Protocol.ACTION_ID++;
            Protocol.LAST_MUTATION_BY = 'exec';
            Protocol.LAST_MUTATION_TS = Date.now();
            this._persist();
            return Protocol.ACTION_ID;
        },

        // Lock acquisition (returns true if acquired)
        acquireLock(agent) {
            const now = Date.now();
            // Lock expires after 10 seconds
            if (Protocol.LOCK && Protocol.LOCK !== agent && (now - Protocol.LOCK_TS) < 10000) {
                return false;
            }
            Protocol.LOCK = agent;
            Protocol.LOCK_TS = now;
            this._persist();
            return true;
        },

        // Release lock
        releaseLock(agent) {
            if (Protocol.LOCK === agent) {
                Protocol.LOCK = null;
                this._persist();
            }
            return Protocol;
        },

        // Check if navigation happened (EPOCH changed)
        checkEpoch(knownEpoch) {
            return Protocol.EPOCH !== knownEpoch;
        },

        // Get full protocol state
        get() {
            return { ...Protocol };
        },

        // Persist to background (async, fire-and-forget)
        _persist() {
            try {
                chrome.runtime?.sendMessage?.({
                    type: 'UPDATE_COORD_STATE',
                    updates: {
                        EPOCH: Protocol.EPOCH,
                        ACTION_ID: Protocol.ACTION_ID,
                        EXEC_STATUS: Protocol.EXEC_STATUS,
                        VISION_STATUS: Protocol.VISION_STATUS,
                        EXEC_PLAN: Protocol.EXEC_PLAN,
                        VISION_PLAN: Protocol.VISION_PLAN,
                        EXEC_ACK: Protocol.EXEC_ACK,
                        VISION_ACK: Protocol.VISION_ACK,
                        LAST_MUTATION_BY: Protocol.LAST_MUTATION_BY,
                        LOCK: Protocol.LOCK
                    }
                });
            } catch (e) {
                // Extension context may not be available
            }
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // UI MAP - Scan visible interactables
    // ═══════════════════════════════════════════════════════════════

    function scanUI() {
        const selectors = 'a,button,[role=button],[onclick],input,textarea,[contenteditable],select,[tabindex]:not([tabindex="-1"])';
        const elements = document.querySelectorAll(selectors);
        const map = [];

        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);

            if (rect.width < 5 || rect.height < 5) continue;
            if (style.visibility === 'hidden' || style.display === 'none') continue;
            if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
            if (rect.right < 0 || rect.left > window.innerWidth) continue;

            map.push({
                tag: el.tagName.toLowerCase(),
                type: el.type || el.role || el.getAttribute('role') || '',
                text: (el.textContent || el.value || el.placeholder || el.ariaLabel || '').slice(0, 40).trim(),
                id: el.id || null,
                x: Math.round(rect.left + rect.width / 2),
                y: Math.round(rect.top + rect.height / 2),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
            });
        }

        WorldState.uiMap = map;
        WorldState.url = location.href;
        WorldState.title = document.title;
        WorldState.readyState = document.readyState;
        WorldState.ts = Date.now();
    }

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

    const Helpers = {
        find: (text) => {
            const lower = text.toLowerCase();
            return WorldState.uiMap.find(el => el.text.toLowerCase().includes(lower));
        },
        findAll: (text) => {
            const lower = text.toLowerCase();
            return WorldState.uiMap.filter(el => el.text.toLowerCase().includes(lower));
        },
        clickCoords: (text) => {
            const el = Helpers.find(text);
            return el ? { x: el.x, y: el.y } : null;
        },
        state: () => ({
            ...WorldState,
            uiMapCount: WorldState.uiMap.length,
            protocol: ProtocolAPI.get()
        }),
        ui: () => WorldState.uiMap,
        protocol: () => ProtocolAPI.get(),
        ssName: (prefix = 'ss') => `${prefix}-${Date.now()}.jpg`,
        hasElement: (text) => !!Helpers.find(text),
        focused: () => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            const rect = el.getBoundingClientRect();
            return { tag: el.tagName.toLowerCase(), id: el.id || null, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        },
        pageText: (maxLen = 2000) => document.body?.innerText?.slice(-maxLen) || '',
        isIdle: () => WorldState.networkInflight === 0 && document.readyState === 'complete'
    };

    // ═══════════════════════════════════════════════════════════════
    // OBSERVERS
    // ═══════════════════════════════════════════════════════════════

    let debounceTimer;
    const debouncedScan = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(scanUI, 100);
    };

    const observer = new MutationObserver(debouncedScan);

    function startObserving() {
        if (!document.body) return;
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class', 'hidden', 'disabled']
        });
        scanUI();
    }

    if (document.body) startObserving();
    else document.addEventListener('DOMContentLoaded', startObserving);

    // Focus tracking
    document.addEventListener('focusin', (e) => {
        WorldState.focusedElement = e.target.tagName?.toLowerCase();
        WorldState.ts = Date.now();
    });

    // Error capture
    window.addEventListener('error', (e) => {
        WorldState.errors.push({ msg: e.message?.slice(0, 100), ts: Date.now() });
        if (WorldState.errors.length > 10) WorldState.errors.shift();
    });

    // ═══════════════════════════════════════════════════════════════
    // VISIBLE CURSOR
    // ═══════════════════════════════════════════════════════════════

    let cursorEl = null;
    let cursorPos = { x: 0, y: 0 };
    let isMoving = false;

    function createCursor() {
        if (cursorEl) return cursorEl;
        cursorEl = document.createElement('div');
        cursorEl.id = '__cdp_cursor';
        cursorEl.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 999999;
            transform: translate(0, 0);
            transition: none;
            font-size: 24px;
            line-height: 1;
            filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.5));
        `;
        cursorEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="white" stroke="black" stroke-width="1.5"/>
        </svg>`;
        document.body.appendChild(cursorEl);
        return cursorEl;
    }

    function updateCursorPosition(x, y) {
        if (!cursorEl) createCursor();
        cursorPos = { x, y };
        cursorEl.style.left = x + 'px';
        cursorEl.style.top = y + 'px';
    }

    function moveTo(targetX, targetY, durationMs = 800) {
        return new Promise((resolve) => {
            if (isMoving) { resolve({ status: 'busy' }); return; }
            isMoving = true;
            createCursor();

            const startX = cursorPos.x || 100;
            const startY = cursorPos.y || 100;
            const steps = 8 + Math.floor(Math.random() * 5);
            const stepTime = durationMs / steps;
            let step = 0;

            function animate() {
                step++;
                const progress = step / steps;
                const ease = 1 - Math.pow(1 - progress, 3);

                let x = startX + (targetX - startX) * ease;
                let y = startY + (targetY - startY) * ease;

                const jitter = (1 - progress) * 8;
                x += (Math.random() - 0.5) * jitter;
                y += (Math.random() - 0.5) * jitter;

                updateCursorPosition(Math.round(x), Math.round(y));

                if (step < steps) {
                    setTimeout(animate, stepTime);
                } else {
                    updateCursorPosition(targetX, targetY);
                    isMoving = false;
                    resolve({ status: 'done', x: targetX, y: targetY, steps });
                }
            }

            animate();
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // EXPOSE TO WINDOW
    // ═══════════════════════════════════════════════════════════════

    window.__cdp = {
        // World state (page-specific)
        world: WorldState,

        // Protocol state (persisted)
        protocol: Protocol,

        // Protocol API (safe writes)
        p: ProtocolAPI,

        // Helpers
        ...Helpers,
        scan: () => { scanUI(); return WorldState.uiMap.length; },

        // Cursor controls
        cursor: {
            show: () => { createCursor(); return 'visible'; },
            hide: () => { if (cursorEl) cursorEl.remove(); cursorEl = null; return 'hidden'; },
            pos: () => cursorPos,
            set: (x, y) => { updateCursorPosition(x, y); return cursorPos; },
            isMoving: () => isMoving
        },
        moveTo: moveTo,

        v: '2.0.0'
    };

    scanUI();
    console.log('[CDP FullProtocol] Ready:', WorldState.uiMap.length, 'elements, EPOCH:', Protocol.EPOCH, 'ACTION_ID:', Protocol.ACTION_ID);
})();
