/**
 * CDP WorldState - Background Service Worker
 * Injects content script into MAIN world for every page
 */

// Inject on navigation
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.startsWith('http')) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['main.js'],
                world: 'MAIN'
            });
            console.log('[CDP WorldState] Injected into tab', tabId);
        } catch (e) {
            console.log('[CDP WorldState] Injection failed:', e.message);
        }
    }
});

// Also inject on extension load for existing tabs
chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, (tabs) => {
    tabs.forEach(async (tab) => {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['main.js'],
                world: 'MAIN'
            });
        } catch (e) { /* ignore */ }
    });
});

console.log('[CDP WorldState] Background ready');
