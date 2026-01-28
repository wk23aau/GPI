/**
 * XOD Page Agent - Injectable script for 60fps in-page perception
 * 
 * This runs inside the browser page (via Page.addScriptToEvaluateOnNewDocument)
 * and streams deltas to the executor via a ring buffer.
 */

export const AGENT_SCRIPT = `
(function() {
    if (window.__XOD__) return; // Already injected
    
    const RING_SIZE = 500;
    const deltas = [];
    let deltaId = 0;
    let mousePos = { x: 0, y: 0 };
    let lastDigest = null;
    
    // ═══════════════════════════════════════════════════════════════════════
    // Ring Buffer
    // ═══════════════════════════════════════════════════════════════════════
    
    function pushDelta(type, payload) {
        const delta = {
            id: ++deltaId,
            t: performance.now(),
            type,
            ...payload
        };
        deltas.push(delta);
        if (deltas.length > RING_SIZE) deltas.shift();
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Mutation Observer - DOM Changes
    // ═══════════════════════════════════════════════════════════════════════
    
    const mo = new MutationObserver(mutations => {
        for (const m of mutations) {
            if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
                pushDelta('dom', {
                    action: m.addedNodes.length ? 'added' : 'removed',
                    target: m.target.tagName,
                    count: m.addedNodes.length + m.removedNodes.length
                });
            } else if (m.type === 'attributes') {
                pushDelta('attr', {
                    target: m.target.tagName,
                    attr: m.attributeName,
                    value: m.target.getAttribute(m.attributeName)
                });
            }
        }
    });
    
    mo.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class', 'disabled', 'hidden', 'aria-expanded', 'style']
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Resize Observer - Layout Changes
    // ═══════════════════════════════════════════════════════════════════════
    
    const watchedForResize = new Set();
    const ro = new ResizeObserver(entries => {
        for (const e of entries) {
            const r = e.contentRect;
            pushDelta('resize', {
                target: e.target.tagName,
                id: e.target.id || null,
                w: Math.round(r.width),
                h: Math.round(r.height)
            });
        }
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Focus Tracking
    // ═══════════════════════════════════════════════════════════════════════
    
    document.addEventListener('focusin', e => {
        pushDelta('focus', {
            target: e.target.tagName,
            id: e.target.id || null,
            name: e.target.name || null
        });
    });
    
    document.addEventListener('focusout', e => {
        pushDelta('blur', { target: e.target.tagName });
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Mouse Position Tracking (for glide origin)
    // ═══════════════════════════════════════════════════════════════════════
    
    document.addEventListener('mousemove', e => {
        mousePos = { x: e.clientX, y: e.clientY };
    }, { passive: true });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Visibility Watcher - Track specific elements
    // ═══════════════════════════════════════════════════════════════════════
    
    const watches = new Map(); // selector -> { visible, rect }
    
    function checkWatch(selector) {
        const el = document.querySelector(selector);
        if (!el) return { visible: false, rect: null };
        
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const visible = r.width > 0 && r.height > 0 &&
                        s.visibility !== 'hidden' &&
                        s.display !== 'none' &&
                        parseFloat(s.opacity || 1) > 0;
        
        return {
            visible,
            rect: visible ? { x: r.x, y: r.y, w: r.width, h: r.height } : null
        };
    }
    
    function updateWatches() {
        for (const [selector, prev] of watches) {
            const curr = checkWatch(selector);
            if (curr.visible !== prev.visible) {
                watches.set(selector, curr);
                pushDelta('visibility', {
                    selector,
                    visible: curr.visible,
                    rect: curr.rect
                });
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // rAF Loop - Continuous State Sampling
    // ═══════════════════════════════════════════════════════════════════════
    
    let frameCount = 0;
    function tick() {
        frameCount++;
        
        // Check watches every 2nd frame (30 fps effective)
        if (frameCount % 2 === 0) {
            updateWatches();
        }
        
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    
    // ═══════════════════════════════════════════════════════════════════════
    // Public API on window.__XOD__
    // ═══════════════════════════════════════════════════════════════════════
    
    window.__XOD__ = {
        // Get deltas since given ID
        drain(sinceId = 0) {
            const result = deltas.filter(d => d.id > sinceId);
            return { deltas: result, lastId: deltaId, mousePos };
        },
        
        // Get current page digest
        digest() {
            return {
                url: location.href,
                title: document.title,
                activeTag: document.activeElement?.tagName,
                activeId: document.activeElement?.id || null,
                scroll: { x: window.scrollX, y: window.scrollY },
                viewport: { w: window.innerWidth, h: window.innerHeight },
                mousePos
            };
        },
        
        // Watch a selector for visibility changes
        watch(selector) {
            watches.set(selector, { visible: false, rect: null });
            const initial = checkWatch(selector);
            watches.set(selector, initial);
            return initial;
        },
        
        // Unwatch a selector
        unwatch(selector) {
            watches.delete(selector);
        },
        
        // Get element bbox by selector
        bbox(selector) {
            const el = document.querySelector(selector);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width/2, cy: r.y + r.height/2 };
        },
        
        // Find clickable elements
        clickables() {
            const items = [];
            const sel = 'a, button, input, select, textarea, [role="button"], [onclick], [tabindex]';
            document.querySelectorAll(sel).forEach((el, i) => {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) {
                    items.push({
                        i,
                        tag: el.tagName,
                        text: (el.innerText || el.value || '').slice(0, 50),
                        x: Math.round(r.x + r.width/2),
                        y: Math.round(r.y + r.height/2)
                    });
                }
            });
            return items;
        },
        
        // Find element by text content
        find(text) {
            const lower = text.toLowerCase();
            const all = document.querySelectorAll('a, button, input, [role="button"], label, span, div, h1, h2, h3, p');
            for (const el of all) {
                const content = (el.innerText || el.value || el.placeholder || '').toLowerCase();
                if (content.includes(lower)) {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.height > 0) {
                        return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), text: el.innerText?.slice(0,50) };
                    }
                }
            }
            return null;
        }
    };
    
    console.log('[XOD] Page agent injected');
})();
`;
