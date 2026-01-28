/**
 * XOD Background Service Worker
 * 
 * Coordinates between content scripts and external CDP connections.
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'xod_ready') {
        console.log('[XOD] Agent ready on tab:', sender.tab?.id, sender.tab?.url);
    }

    if (message.type === 'xod_delta') {
        // Could forward deltas to a WebSocket server here
        // For now, just log
    }

    return true;
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        console.log('[XOD] Tab loaded:', tabId, tab.url);
    }
});

console.log('[XOD] Background service worker started');
