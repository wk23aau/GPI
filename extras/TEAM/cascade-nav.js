/**
 * Cascade Navigation Automation Script
 * Inject this into Antigravity via CDP REPL for conversation navigation
 * 
 * Usage in cascade> REPL:
 *   1. Copy contents of this file
 *   2. Paste into cascade> prompt
 *   3. Use: __nav.next(), __nav.prev(), __nav.list(), __nav.open(id)
 */

// Cascade Navigation Helper
window.__nav = {
    // Navigate to next file/conversation
    next: () => {
        const btn = document.querySelector('.next-file');
        if (btn) { btn.click(); return 'Navigated to next'; }
        // Fallback: keyboard shortcut
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'l', code: 'KeyL', altKey: true, bubbles: true
        }));
        return 'Sent Alt+L';
    },

    // Navigate to previous file/conversation
    prev: () => {
        const btn = document.querySelector('.previous-file');
        if (btn) { btn.click(); return 'Navigated to previous'; }
        // Fallback: keyboard shortcut
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'h', code: 'KeyH', altKey: true, bubbles: true
        }));
        return 'Sent Alt+H';
    },

    // Show edited files / center action
    center: () => {
        const btn = document.querySelector('.center-button');
        if (btn) { btn.click(); return 'Opened file view'; }
        return 'Center button not found';
    },

    // Focus cascade input
    focus: () => {
        const input = document.querySelector('[class*="cascade"] textarea, [class*="chat"] textarea');
        if (input) { input.focus(); return 'Focused input'; }
        return 'Input not found';
    },

    // Click cascade bar to open/toggle panel
    toggle: () => {
        const bar = document.querySelector('.cascade-bar');
        if (bar) { bar.click(); return 'Toggled cascade panel'; }
        return 'Cascade bar not found';
    },

    // List visible conversations/items in panel
    list: () => {
        const items = document.querySelectorAll('[class*="agent"] [role="listitem"], [class*="conversation"] li, [class*="history"] [role="option"]');
        if (items.length === 0) {
            // Try alternative selectors for conversation list
            const altItems = document.querySelectorAll('.monaco-list-row, .tree-row');
            return Array.from(altItems).map((e, i) => ({
                index: i,
                text: e.textContent?.substring(0, 50),
                className: e.className.split(' ')[0]
            })).slice(0, 20);
        }
        return Array.from(items).map((e, i) => ({
            index: i,
            text: e.textContent?.substring(0, 50)
        }));
    },

    // Open command palette with specific command
    command: (cmd) => {
        // Trigger command palette (Ctrl+Shift+P)
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'P', code: 'KeyP', ctrlKey: true, shiftKey: true, bubbles: true
        }));
        setTimeout(() => {
            const input = document.querySelector('.quick-input-box input');
            if (input) {
                input.value = cmd;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, 200);
        return 'Opening command palette with: ' + cmd;
    },

    // Open chat history / conversation picker (Ctrl+Shift+A)
    history: () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'a', code: 'KeyA', ctrlKey: true, shiftKey: true, bubbles: true
        }));
        return 'Opening conversation picker (Ctrl+Shift+A)';
    },

    // Open NEW chat conversation (Ctrl+Shift+L)
    newChat: () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'l', code: 'KeyL', ctrlKey: true, shiftKey: true, bubbles: true
        }));
        return 'Opening new conversation (Ctrl+Shift+L)';
    },

    // Get current panel state
    state: () => {
        return {
            cascadeBar: !!document.querySelector('.cascade-bar'),
            cascadePanelOpen: !!document.querySelector('.cascade-panel-open'),
            prevButton: !!document.querySelector('.previous-file'),
            nextButton: !!document.querySelector('.next-file'),
            centerButton: document.querySelector('.center-button')?.textContent || 'N/A',
            agentPanel: !!document.querySelector('[id*="agent"]')
        };
    },

    // Send a message to the chat
    send: (message) => {
        const textarea = document.querySelector('textarea[placeholder*="Ask"], textarea[class*="input"]');
        if (!textarea) return 'Chat input not found';

        textarea.focus();
        textarea.value = message;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        // Try to find and click send button
        setTimeout(() => {
            const sendBtn = document.querySelector('[aria-label*="Send"], button[class*="send"]');
            if (sendBtn) sendBtn.click();
            else {
                // Fallback: press Enter
                textarea.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', bubbles: true
                }));
            }
        }, 100);
        return 'Sending message: ' + message.substring(0, 30) + '...';
    },

    // Help
    help: () => console.log(`
🧭 Cascade Navigation Commands:
  __nav.next()       - Go to next file/conversation
  __nav.prev()       - Go to previous file/conversation  
  __nav.center()     - Open file view (center button)
  __nav.toggle()     - Toggle cascade panel
  __nav.focus()      - Focus chat input
  __nav.list()       - List visible items
  __nav.command(cmd) - Open command palette with command
  __nav.newChat()    - Start new chat
  __nav.history()    - Open chat history
  __nav.state()      - Get current panel state
  __nav.send(msg)    - Send a chat message
  __nav.help()       - Show this help
`) || 'Help shown'
};

// Shortcut functions
window.__next = () => __nav.next();
window.__prev = () => __nav.prev();
window.__send = (msg) => __nav.send(msg);
window.__state = () => __nav.state();

console.log('✅ Cascade Navigation helpers loaded!');
console.log('   Type __nav.help() for available commands');
'🧭 Navigation ready!'
