/**
 * XOD Cursor Overlay - Canvas-based CAD-style crosshairs
 * 
 * Uses Canvas + requestAnimationFrame for 60fps smooth rendering.
 * Crosshairs are infinite lines that intersect at cursor position.
 */

export const OVERLAY_SCRIPT = `
(function() {
    // Clean up any legacy overlay elements from previous versions
    ['__xod_cursor__', '__xod_ripples__', '__xod_highlight__', '__xod_crosshairs__', '__xod_vline__', '__xod_hline__', '__xod_coords__', '__xod_canvas__', '__xod_hide_cursor__'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    
    // Reset the API to force re-injection
    delete window.__XOD_CURSOR__;
    delete window.__XOD_POS__;
    
    // ═══════════════════════════════════════════════════════════════════════
    // Global cursor position - set by executor via CDP
    // ═══════════════════════════════════════════════════════════════════════
    
    window.__XOD_POS__ = { x: 0, y: 0 };
    
    // ═══════════════════════════════════════════════════════════════════════
    // Canvas Overlay Setup
    // ═══════════════════════════════════════════════════════════════════════
    
    const canvas = document.createElement('canvas');
    canvas.id = '__xod_canvas__';
    const ctx = canvas.getContext('2d', { alpha: true });
    
    Object.assign(canvas.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: '100vw',
        height: '100vh',
        zIndex: '2147483647',
        pointerEvents: 'none',
        background: 'transparent'
    });
    
    function resizeCanvas() {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const w = window.innerWidth;
        const h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    window.addEventListener('resize', resizeCanvas, { passive: true });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Click Ripple State
    // ═══════════════════════════════════════════════════════════════════════
    
    let clickFlash = { x: 0, y: 0, until: 0 };
    const FLASH_MS = 200;
    
    // ═══════════════════════════════════════════════════════════════════════
    // Drawing Functions
    // ═══════════════════════════════════════════════════════════════════════
    
    function clear() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
    
    function drawCrosshairs(x, y) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        
        ctx.beginPath();
        // Horizontal line across entire viewport
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(window.innerWidth, y + 0.5);
        // Vertical line across entire viewport
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, window.innerHeight);
        ctx.stroke();
        
        // Intersection dot
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    function drawCursor(x, y) {
        // Draw arrow cursor
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 18);
        ctx.lineTo(x + 5, y + 14);
        ctx.lineTo(x + 9, y + 22);
        ctx.lineTo(x + 12, y + 21);
        ctx.lineTo(x + 8, y + 13);
        ctx.lineTo(x + 14, y + 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    function drawCoords(x, y) {
        const text = 'xod:' + x + ',' + y + ' vp:' + window.innerWidth + 'x' + window.innerHeight;
        ctx.font = '14px monospace';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        const metrics = ctx.measureText(text);
        const pad = 8;
        const tx = window.innerWidth - metrics.width - pad * 2 - 10;
        const ty = 10;
        
        // Background
        ctx.fillRect(tx, ty, metrics.width + pad * 2, 24);
        
        // Text
        ctx.fillStyle = '#0f0';
        ctx.fillText(text, tx + pad, ty + 17);
    }
    
    function drawClickFlash(now) {
        if (now > clickFlash.until) return;
        
        const t = 1 - (clickFlash.until - now) / FLASH_MS;
        const r = 8 + t * 24;
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 150, 255, ' + (1 - t) * 0.6 + ')';
        ctx.beginPath();
        ctx.arc(clickFlash.x, clickFlash.y, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Render Loop (60fps)
    // ═══════════════════════════════════════════════════════════════════════
    
    function frame(now) {
        const x = window.__XOD_POS__.x;
        const y = window.__XOD_POS__.y;
        
        clear();
        drawCrosshairs(x, y);
        drawCursor(x, y);
        drawCoords(x, y);
        drawClickFlash(now);
        
        requestAnimationFrame(frame);
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // Inject
    // ═══════════════════════════════════════════════════════════════════════
    
    function inject() {
        if (!document.body) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inject);
            } else {
                requestAnimationFrame(inject);
            }
            return;
        }
        
        // Hide native cursor
        const style = document.createElement('style');
        style.id = '__xod_hide_cursor__';
        style.textContent = '* { cursor: none !important; }';
        document.head.appendChild(style);
        
        document.body.appendChild(canvas);
        resizeCanvas();
        requestAnimationFrame(frame);
    }
    inject();
    
    // ═══════════════════════════════════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════════════════════════════════
    
    window.__XOD_CURSOR__ = {
        move(x, y) {
            window.__XOD_POS__.x = x;
            window.__XOD_POS__.y = y;
        },
        
        click(x, y) {
            clickFlash.x = x;
            clickFlash.y = y;
            clickFlash.until = performance.now() + FLASH_MS;
        },
        
        highlight(rect) {
            // TODO: Add highlight support if needed
        },
        
        hide() {
            canvas.style.display = 'none';
        },
        
        show() {
            canvas.style.display = 'block';
        }
    };
    
    console.log('[XOD] Canvas overlay injected');
})();
`;

/**
 * Update cursor position via CDP
 */
export async function moveCursor(send, x, y) {
    await send('Runtime.evaluate', {
        expression: `window.__XOD_CURSOR__?.move(${x}, ${y})`,
        returnByValue: true
    });
}

/**
 * Show click ripple via CDP
 */
export async function clickRipple(send, x, y) {
    await send('Runtime.evaluate', {
        expression: `window.__XOD_CURSOR__?.click(${x}, ${y})`,
        returnByValue: true
    });
}

/**
 * Highlight an element by rect
 */
export async function highlightRect(send, rect) {
    if (rect) {
        await send('Runtime.evaluate', {
            expression: `window.__XOD_CURSOR__?.highlight({x:${rect.x},y:${rect.y},w:${rect.w},h:${rect.h}})`,
            returnByValue: true
        });
    } else {
        await send('Runtime.evaluate', {
            expression: `window.__XOD_CURSOR__?.highlight(null)`,
            returnByValue: true
        });
    }
}
