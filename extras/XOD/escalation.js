/**
 * XOD Escalation - When to ask the High-Intelligence Model
 * 
 * The HIM (Claude/Gemini/GPT) is too slow for the 30 Hz loop.
 * We only escalate on specific triggers.
 */

export class Escalation {
    constructor() {
        this.triggers = [];
        this.onEscalate = null; // Callback when escalation needed

        // Tracking for trigger detection
        this.failureCount = 0;
        this.lastNavigation = 0;
        this.stuckTicks = 0;
        this.lastAction = null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Built-in Trigger Conditions
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Repeated action failures
     * When the same action fails 3+ times
     */
    checkRepeatedFailures(action, success) {
        if (!success) {
            if (this.lastAction === action.type) {
                this.failureCount++;
            } else {
                this.failureCount = 1;
                this.lastAction = action.type;
            }

            if (this.failureCount >= 3) {
                this._escalate('repeated_failure', {
                    action,
                    failures: this.failureCount,
                    reason: `Action "${action.type}" failed ${this.failureCount} times`
                });
            }
        } else {
            this.failureCount = 0;
        }
    }

    /**
     * Navigation detected
     * Major page change requires re-planning
     */
    checkNavigation(oldUrl, newUrl) {
        if (oldUrl !== newUrl) {
            const now = Date.now();
            // Debounce - don't escalate if just navigated
            if (now - this.lastNavigation > 2000) {
                this.lastNavigation = now;
                this._escalate('navigation', {
                    from: oldUrl,
                    to: newUrl,
                    reason: 'Page navigation detected'
                });
            }
        }
    }

    /**
     * Stuck detection
     * No progress for N ticks - only when actions are pending
     */
    checkStuck(progressMade, hasPendingActions = false) {
        if (progressMade || !hasPendingActions) {
            this.stuckTicks = 0;
        } else {
            this.stuckTicks++;
            if (this.stuckTicks >= 300) { // ~10 seconds at 30 Hz
                this._escalate('stuck', {
                    ticks: this.stuckTicks,
                    reason: 'No progress detected for 10 seconds with pending actions'
                });
                this.stuckTicks = 0;
            }
        }
    }

    /**
     * Ambiguous UI state
     * Can't determine what to do next
     */
    escalateAmbiguous(context) {
        this._escalate('ambiguous', {
            ...context,
            reason: 'UI state is ambiguous, need guidance'
        });
    }

    /**
     * Goal phase transition
     * Current goal completed, need next goal
     */
    escalateGoalComplete(goal, result) {
        this._escalate('goal_complete', {
            goal,
            result,
            reason: 'Goal completed, awaiting next goal'
        });
    }

    /**
     * Unexpected modal/captcha/auth
     * Blocking elements that need human-level decision
     */
    escalateBlocker(type, details) {
        this._escalate('blocker', {
            type, // 'captcha', 'auth', 'modal', 'paywall'
            details,
            reason: `Blocking element detected: ${type}`
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Escalation Handler
    // ═══════════════════════════════════════════════════════════════════════

    _escalate(type, context) {
        const escalation = {
            type,
            timestamp: Date.now(),
            ...context
        };

        console.log(`[XOD] Escalating to HIM: ${type} - ${context.reason}`);

        if (this.onEscalate) {
            this.onEscalate(escalation);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HIM Message Format
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Create a brief for the HIM
     * This is what gets sent to Claude/Gemini/GPT
     */
    createBrief(state, escalation, recentDeltas = []) {
        return {
            // Current state (minimal)
            url: state.url,
            title: state.title,
            activeElement: state.activeElement,
            viewport: state.viewport,

            // Why we're asking
            escalation: {
                type: escalation.type,
                reason: escalation.reason
            },

            // Recent changes (last 20 deltas)
            recentDeltas: recentDeltas.slice(-20),

            // Request format
            expectedResponse: {
                plan: '[ { action, target, params } ]',
                guards: '[ selectors to watch for failure ]',
                snapshotRegions: '[ optional regions to screenshot ]'
            }
        };
    }
}

/**
 * Default escalation setup
 */
export function createEscalation(onEscalate) {
    const esc = new Escalation();
    esc.onEscalate = onEscalate;
    return esc;
}
