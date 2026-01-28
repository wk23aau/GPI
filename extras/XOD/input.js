/**
 * XOD Input Module - Smooth mouse and keyboard dispatch
 * 
 * Implements human-like input: glide paths, corridors, proper key sequences.
 */

/**
 * Smooth mouse glide from one point to another
 * @param {Function} send - CDP send function
 * @param {Object} from - {x, y} start position
 * @param {Object} to - {x, y} end position  
 * @param {number} steps - Number of micro-moves (default 25)
 * @param {number} totalMs - Total duration in ms (default 140)
 */
export async function glide(send, from, to, steps = 25, totalMs = 140) {
    const delay = totalMs / steps;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        // Ease-out curve for natural deceleration
        const ease = 1 - Math.pow(1 - t, 2);

        const x = Math.round(from.x + (to.x - from.x) * ease);
        const y = Math.round(from.y + (to.y - from.y) * ease);

        await send('Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x,
            y,
            buttons: 0
        });

        await sleep(delay);
    }

    return to;
}

/**
 * Menu-safe corridor path (for hover submenus that collapse diagonally)
 * Moves: down first, then horizontal, then to target
 * @param {Function} send - CDP send function
 * @param {Object} from - {x, y} current position
 * @param {Object} menuRect - {x, y, w, h} submenu bounding box
 */
export async function corridor(send, from, menuRect) {
    // Point 1: Drop down to menu top
    const p1 = { x: from.x, y: menuRect.y + 10 };
    await glide(send, from, p1, 15, 80);

    // Point 2: Move horizontally into menu
    const p2 = { x: menuRect.x + 20, y: p1.y };
    await glide(send, p1, p2, 15, 80);

    // Point 3: Down to center of first item
    const p3 = { x: p2.x, y: menuRect.y + 30 };
    await glide(send, p2, p3, 10, 50);

    return p3;
}

/**
 * Click at position (press + release)
 * @param {Function} send - CDP send function
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} button - 'left', 'right', 'middle'
 */
export async function click(send, x, y, button = 'left') {
    await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button,
        clickCount: 1
    });

    await sleep(50);

    await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button
    });
}

/**
 * Double click at position
 */
export async function doubleClick(send, x, y) {
    await click(send, x, y);
    await sleep(80);
    await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 2
    });
    await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left'
    });
}

/**
 * Insert text (for input fields)
 * @param {Function} send - CDP send function
 * @param {string} text - Text to type
 */
export async function type(send, text) {
    await send('Input.insertText', { text });
}

/**
 * Press a key with proper keyDown/keyUp sequence
 * @param {Function} send - CDP send function
 * @param {string} key - Key name (e.g., 'Enter', 'Tab', 'Escape')
 */
export async function key(send, keyName) {
    const keyMap = {
        'Enter': { code: 'Enter', keyCode: 13 },
        'Tab': { code: 'Tab', keyCode: 9 },
        'Escape': { code: 'Escape', keyCode: 27 },
        'Backspace': { code: 'Backspace', keyCode: 8 },
        'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
        'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
        'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
        'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
        'Space': { code: 'Space', keyCode: 32, key: ' ' }
    };

    const info = keyMap[keyName] || { code: keyName, keyCode: 0 };

    await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: info.key || keyName,
        code: info.code,
        windowsVirtualKeyCode: info.keyCode
    });

    await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: info.key || keyName,
        code: info.code
    });
}

/**
 * Press key with modifiers (Ctrl, Alt, Shift)
 * Uses explicit press/release for each modifier
 */
export async function keyWithModifiers(send, keyName, modifiers = {}) {
    const { ctrl, alt, shift } = modifiers;

    // Press modifiers
    if (ctrl) await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Control', code: 'ControlLeft' });
    if (alt) await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Alt', code: 'AltLeft' });
    if (shift) await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft' });

    // Press the key
    await key(send, keyName);

    // Release modifiers in reverse
    if (shift) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft' });
    if (alt) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Alt', code: 'AltLeft' });
    if (ctrl) await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Control', code: 'ControlLeft' });
}

/**
 * Scroll by delta
 */
export async function scroll(send, x, y, deltaX, deltaY) {
    await send('Input.dispatchMouseEvent', {
        type: 'mouseWheel',
        x,
        y,
        deltaX,
        deltaY
    });
}

// Utility
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

export { sleep };
