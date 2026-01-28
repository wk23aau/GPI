/**
 * XOD Cursor Overlay - Visual cursor for demos and debugging
 * 
 * Injectable script that draws a fake cursor, click ripples, and highlights.
 */

export const OVERLAY_SCRIPT = `
(function() {
    if (window.__XOD_CURSOR__) return;
    
    // ═══════════════════════════════════════════════════════════════════════
    // Cursor Element
    // ═══════════════════════════════════════════════════════════════════════
    
    const cursor = document.createElement('div');
    cursor.id = '__xod_cursor__';
    cursor.innerHTML = \`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 2L19 12L12 13L9 21L5 2Z" fill="#000" stroke="#fff" stroke-width="1.5"/>
        </svg>
    \`;
    Object.assign(cursor.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '24px',
        height: '24px',
        pointerEvents: 'none',
        zIndex: '999999',
        transform: 'translate(-2px, -2px)',
        transition: 'none'
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Click Ripple Container
    // ═══════════════════════════════════════════════════════════════════════
    
    const rippleContainer = document.createElement('div');
    rippleContainer.id = '__xod_ripples__';
    Object.assign(rippleContainer.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '999998',
        overflow: 'hidden'
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Target Highlight
    // ═══════════════════════════════════════════════════════════════════════
    
    const highlight = document.createElement('div');
    highlight.id = '__xod_highlight__';
    Object.assign(highlight.style, {
        position: 'fixed',
        border: '2px solid #00ff88',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: '999997',
        display: 'none',
        boxShadow: '0 0 10px rgba(0,255,136,0.5)'
    });
    
    // ═══════════════════════════════════════════════════════════════════════
    // Inject
    // ═══════════════════════════════════════════════════════════════════════
    
    document.body.appendChild(rippleContainer);
    document.body.appendChild(highlight);
    document.body.appendChild(cursor);
    
    // ═══════════════════════════════════════════════════════════════════════
    // Animation Styles
    // ═══════════════════════════════════════════════════════════════════════
    
    const style = document.createElement('style');
    style.textContent = \`
        @keyframes xod-ripple {
            0% { transform: scale(0); opacity: 0.6; }
            100% { transform: scale(2); opacity: 0; }
        }
        .xod-ripple {
            position: absolute;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: rgba(0, 150, 255, 0.4);
            animation: xod-ripple 0.4s ease-out forwards;
            pointer-events: none;
        }
    \`;
    document.head.appendChild(style);
    
    // ═══════════════════════════════════════════════════════════════════════
    // Public API
    // ═══════════════════════════════════════════════════════════════════════
    
    window.__XOD_CURSOR__ = {
        move(x, y) {
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
        },
        
        click(x, y) {
            // Create ripple
            const ripple = document.createElement('div');
            ripple.className = 'xod-ripple';
            ripple.style.left = (x - 20) + 'px';
            ripple.style.top = (y - 20) + 'px';
            rippleContainer.appendChild(ripple);
            
            // Remove after animation
            setTimeout(() => ripple.remove(), 500);
        },
        
        highlight(rect) {
            if (!rect) {
                highlight.style.display = 'none';
                return;
            }
            Object.assign(highlight.style, {
                display: 'block',
                left: rect.x + 'px',
                top: rect.y + 'px',
                width: rect.w + 'px',
                height: rect.h + 'px'
            });
        },
        
        hide() {
            cursor.style.display = 'none';
            highlight.style.display = 'none';
        },
        
        show() {
            cursor.style.display = 'block';
        }
    };
    
    console.log('[XOD] Cursor overlay injected');
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
