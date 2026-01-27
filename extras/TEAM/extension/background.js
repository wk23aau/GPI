/**
 * CDP Full Protocol - Background Service Worker
 * 
 * FIXES:
 * 1. Early injection at document_start (not complete)
 * 2. Persists coordination state via chrome.storage.session
 * 3. Rehydrates state on navigation
 * 4. Tracks EPOCH for navigation detection
 */

// Default coordination state (survives navigation)
const DEFAULT_COORD_STATE = {
    EPOCH: 0,
    ACTION_ID: 0,
    EXEC_STATUS: 'idle',
    VISION_STATUS: 'idle',
    EXEC_PLAN: null,
    VISION_PLAN: null,
    EXEC_ACK: 0,
    VISION_ACK: 0,
    LAST_MUTATION_BY: null,
    LOCK: null
};

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
    await chrome.storage.session.set({ coordState: DEFAULT_COORD_STATE });
    console.log('[FullProtocol] Initialized coordination state');
});

// Inject early - use document_start timing via scripting API
async function injectMainScript(tabId, isNavigation = false) {
    try {
        // Get current coordination state
        const { coordState } = await chrome.storage.session.get('coordState');
        const state = coordState || DEFAULT_COORD_STATE;

        // If navigation, increment EPOCH
        if (isNavigation) {
            state.EPOCH++;
            await chrome.storage.session.set({ coordState: state });
        }

        // Inject the main script with coordination state
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (coordState) => {
                // Store for rehydration
                window.__cdp_coord_bootstrap = coordState;
            },
            args: [state],
            world: 'MAIN',
            injectImmediately: true  // As early as possible
        });

        // Then inject the main script
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['main.js'],
            world: 'MAIN',
            injectImmediately: true
        });

        console.log('[FullProtocol] Injected into tab', tabId, 'EPOCH:', state.EPOCH);
    } catch (e) {
        // Ignore errors for non-injectable pages
        if (!e.message.includes('Cannot access')) {
            console.log('[FullProtocol] Injection failed:', e.message);
        }
    }
}

// Listen for navigation starts (earlier than complete)
chrome.webNavigation?.onCommitted?.addListener(async (details) => {
    // Only main frame navigations
    if (details.frameId === 0 && details.url.startsWith('http')) {
        await injectMainScript(details.tabId, true);
    }
});

// Fallback: inject on complete if webNavigation not available
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
        // Check if already injected
        try {
            const [result] = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => !!window.__cdp,
                world: 'MAIN'
            });
            if (!result.result) {
                await injectMainScript(tabId, false);
            }
        } catch (e) {
            // Try injection anyway
            await injectMainScript(tabId, false);
        }
    }
});

// Inject into existing tabs on startup
chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => injectMainScript(tab.id, false));
});

// Message handler for coordination state updates from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_COORD_STATE') {
        chrome.storage.session.get('coordState', ({ coordState }) => {
            const newState = { ...coordState, ...message.updates };
            chrome.storage.session.set({ coordState: newState });
            sendResponse({ success: true, state: newState });
        });
        return true; // Keep channel open for async response
    }

    if (message.type === 'GET_COORD_STATE') {
        chrome.storage.session.get('coordState', ({ coordState }) => {
            sendResponse(coordState || DEFAULT_COORD_STATE);
        });
        return true;
    }

    if (message.type === 'RESET_COORD_STATE') {
        const newState = { ...DEFAULT_COORD_STATE, EPOCH: Date.now() };
        chrome.storage.session.set({ coordState: newState });
        sendResponse(newState);
        return true;
    }
});

console.log('[FullProtocol] Background ready - early injection enabled');
