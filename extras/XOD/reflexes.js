/**
 * XOD Reflexes - Fast local decision rules
 * 
 * These run in the 30 Hz loop and react instantly to patterns.
 * They handle common scenarios without waiting for HIM.
 */

/**
 * Cookie banner dismissal reflex
 * Detects common cookie consent patterns and clicks accept
 */
export const cookieBanner = {
    name: 'cookie-banner',
    selectors: [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[class*="consent"]',
        '[id*="cookie"] button',
        '[class*="cookie"] button',
        'button:contains("Accept")',
        'button:contains("I agree")',
        'button:contains("Got it")'
    ],
    condition(state) {
        return state.watches.get('__cookie_banner__')?.visible;
    },
    async action(executor) {
        const result = await executor.cdp.eval(`
            (function() {
                const sels = ${JSON.stringify(this.selectors)};
                for (const sel of sels) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const r = el.getBoundingClientRect();
                        if (r.width > 0) return { x: r.x + r.width/2, y: r.y + r.height/2 };
                    }
                }
                return null;
            })()
        `);
        if (result) {
            await executor.clickAt(result.x, result.y);
        }
    }
};

/**
 * Scroll into view reflex
 * When click fails because element is out of viewport, scroll to it
 */
export const scrollIntoView = {
    name: 'scroll-into-view',
    targetSelector: null,

    condition(state) {
        // Triggered when we have a target that's not in viewport
        return this.targetSelector && state.lastClickFailed;
    },

    async action(executor) {
        await executor.cdp.eval(`
            document.querySelector("${this.targetSelector}")?.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            })
        `);
        await new Promise(r => setTimeout(r, 300));
    }
};

/**
 * Modal escape reflex
 * Press Escape when a modal blocks the page
 */
export const modalEscape = {
    name: 'modal-escape',
    selectors: [
        '[role="dialog"]',
        '.modal',
        '[class*="modal"]',
        '[class*="overlay"]'
    ],

    condition(state) {
        return state.watches.get('__modal__')?.visible;
    },

    async action(executor) {
        await executor.pressKey('Escape');
    }
};

/**
 * Hover menu follow reflex
 * When submenu appears, immediately glide to it
 */
export const hoverMenuFollow = {
    name: 'hover-menu-follow',
    submenuSelector: null,

    condition(state) {
        const watch = state.watches.get(this.submenuSelector);
        return watch?.visible && watch?.rect;
    },

    async action(executor) {
        const watch = executor.state.watches.get(this.submenuSelector);
        if (watch?.rect) {
            // Glide into submenu using corridor path
            const target = {
                x: watch.rect.x + 20,
                y: watch.rect.y + 20
            };
            await executor.glideTo(target.x, target.y, 20, 100);
        }
    }
};

/**
 * Loading wait reflex  
 * Pause actions while page is loading
 */
export const loadingWait = {
    name: 'loading-wait',

    condition(state) {
        return state.loading;
    },

    async action(executor) {
        // Just skip this tick - don't execute actions
        executor.actionQueue = executor.actionQueue.filter(a => a.priority > 50);
    }
};

/**
 * Setup default reflexes on an executor
 */
export function setupDefaultReflexes(executor) {
    // Watch for common patterns
    executor.watch('[class*="cookie"]');
    executor.watch('[role="dialog"]');
    executor.watch('.modal');

    // Note: Cookie banner and modal reflexes need the page agent
    // to detect visibility first. These are patterns, actual detection
    // happens via the watch system.

    console.log('[XOD] Default reflexes configured');
}
