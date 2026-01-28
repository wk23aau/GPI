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
    // Valid CSS selectors only
    selectors: [
        'button[id*="accept"]',
        'button[class*="accept"]',
        'button[class*="consent"]',
        '[id*="cookie"] button',
        '[class*="cookie"] button'
    ],
    // Text patterns to match (case-insensitive)
    textPatterns: ['accept', 'i agree', 'got it', 'allow', 'ok', 'consent'],

    condition(state) {
        // Check for cookie-related elements being visible
        return state.watches.get('[class*="cookie"]')?.visible ||
            state.watches.get('[id*="cookie"]')?.visible;
    },
    async action(executor) {
        const patterns = this.textPatterns;
        const sels = this.selectors;
        const result = await executor.cdp.eval(`
            (function() {
                const sels = ${JSON.stringify(sels)};
                const patterns = ${JSON.stringify(patterns)};
                
                // First try CSS selectors
                for (const sel of sels) {
                    try {
                        const el = document.querySelector(sel);
                        if (el) {
                            const r = el.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0) {
                                return { x: r.x + r.width/2, y: r.y + r.height/2 };
                            }
                        }
                    } catch(e) {}
                }
                
                // Then try text matching on buttons
                const buttons = document.querySelectorAll('button, [role="button"], a[class*="btn"]');
                for (const btn of buttons) {
                    const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
                    for (const pattern of patterns) {
                        if (text.includes(pattern)) {
                            const r = btn.getBoundingClientRect();
                            if (r.width > 0 && r.height > 0) {
                                return { x: r.x + r.width/2, y: r.y + r.height/2 };
                            }
                        }
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
        // Check actual watched selectors
        return state.watches.get('[role="dialog"]')?.visible ||
            state.watches.get('.modal')?.visible ||
            state.watches.get('[class*="modal"]')?.visible;
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
    executor.watch('[id*="cookie"]');
    executor.watch('[role="dialog"]');
    executor.watch('.modal');
    executor.watch('[class*="modal"]');

    // Register the reflex handlers
    executor.addReflex(cookieBanner.name,
        (state) => cookieBanner.condition(state),
        (exec) => cookieBanner.action(exec)
    );
    executor.addReflex(modalEscape.name,
        (state) => modalEscape.condition(state),
        (exec) => modalEscape.action(exec)
    );
    executor.addReflex(loadingWait.name,
        (state) => loadingWait.condition(state),
        (exec) => loadingWait.action(exec)
    );

    console.log('[XOD] Default reflexes configured');
}
