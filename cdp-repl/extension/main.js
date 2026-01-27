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
    // EXPOSE TO WINDOW
    // ═══════════════════════════════════════════════════════════════

    window.__cdp = {
        world: WorldState,
        ...Helpers,
        scan: () => { scanUI(); return WorldState.uiMap.length; },
        v: '1.0.0'
    };

    scanUI();
    console.log('[CDP WorldState] Ready:', WorldState.uiMap.length, 'elements');
})();
