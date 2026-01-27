/**
 * World State - Shared state file for Vision/Executor coordination
 * 
 * Vision updates this after every Executor action.
 * Executor reads latest before acting.
 * History tracked like git commits.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, 'world.json');

// Initialize empty world state
export function init() {
    const state = {
        current: {
            url: '',
            title: '',
            uiCount: 0,
            ui: [],
            ts: Date.now()
        },
        history: [],
        lastAction: null
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return state;
}

// Vision: Update world state after scanning
export function updateState(cdpState, action = null) {
    let state;
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE));
    } catch {
        state = init();
    }

    // Push current to history (like git commit)
    if (state.current.url) {
        state.history.push({
            ...state.current,
            action: state.lastAction
        });
        // Keep last 20 states
        if (state.history.length > 20) state.history.shift();
    }

    // Update current
    state.current = {
        url: cdpState.url,
        title: cdpState.title,
        uiCount: cdpState.uiMapCount || cdpState.uiMap?.length || 0,
        ui: cdpState.uiMap || [],
        ts: Date.now()
    };
    state.lastAction = action;

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return state;
}

// Executor: Read current state
export function getState() {
    try {
        return JSON.parse(fs.readFileSync(STATE_FILE));
    } catch {
        return init();
    }
}

// Get changes between last two states (like git diff)
export function getDiff() {
    const state = getState();
    if (state.history.length === 0) return null;

    const prev = state.history[state.history.length - 1];
    const curr = state.current;

    return {
        urlChanged: prev.url !== curr.url,
        titleChanged: prev.title !== curr.title,
        uiCountDelta: curr.uiCount - prev.uiCount,
        newUrl: curr.url,
        newTitle: curr.title,
        action: state.lastAction
    };
}

// Pretty print current state
export function summary() {
    const state = getState();
    const diff = getDiff();
    return {
        url: state.current.url,
        title: state.current.title,
        elements: state.current.uiCount,
        historyLength: state.history.length,
        lastAction: state.lastAction,
        changes: diff
    };
}
