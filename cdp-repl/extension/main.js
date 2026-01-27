/**
 * CDP WorldState - Main World Script
 * Injected into page's main JavaScript world
 * 
 * Push-based: MutationObserver streams UI deltas, no round-trips
 */

(() => {
    // Skip if already loaded
    if (window.__cdp) return;

    // ═══════════════════════════════════════════════════════════════
    // WORLD STATE - Always fresh, no queries needed
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
        state: () => ({ ...WorldState, uiMapCount: WorldState.uiMap.length }),
        ui: () => WorldState.uiMap,
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
    // VISIBLE CURSOR - Human-like jittering trajectory
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
        // Default arrow cursor using SVG
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

    // Move cursor with jittering trajectory
    function moveTo(targetX, targetY, durationMs = 800) {
        return new Promise((resolve) => {
            if (isMoving) { resolve({ status: 'busy' }); return; }
            isMoving = true;
            createCursor();

            const startX = cursorPos.x || 100;
            const startY = cursorPos.y || 100;
            const steps = 8 + Math.floor(Math.random() * 5); // 8-12 steps
            const stepTime = durationMs / steps;
            let step = 0;

            function animate() {
                step++;
                const progress = step / steps;
                // Ease-out curve
                const ease = 1 - Math.pow(1 - progress, 3);

                // Base position
                let x = startX + (targetX - startX) * ease;
                let y = startY + (targetY - startY) * ease;

                // Add jitter (decreasing as we approach target)
                const jitter = (1 - progress) * 8;
                x += (Math.random() - 0.5) * jitter;
                y += (Math.random() - 0.5) * jitter;

                updateCursorPosition(Math.round(x), Math.round(y));

                if (step < steps) {
                    setTimeout(animate, stepTime);
                } else {
                    // Final snap to exact target
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
        world: WorldState,
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

        v: '1.1.0'
    };

    scanUI();
    console.log('[CDP WorldState] Ready:', WorldState.uiMap.length, 'elements, cursor enabled');
})();
