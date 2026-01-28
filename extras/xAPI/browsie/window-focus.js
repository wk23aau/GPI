/**
 * Window Focus Helper - Node.js equivalent of Python pyautogui/win32gui
 * Uses VBScript for window management and keyboard input
 * No native dependencies required!
 */

import { exec } from 'child_process';
import fs from 'fs';
import http from 'http';
import WebSocket from 'ws';

// ═══════════════════════════════════════════════════════════════════
// Window Focus (using AppActivate)
// ═══════════════════════════════════════════════════════════════════

/**
 * Focus a window by partial title match using VBScript AppActivate
 */
export function focusWindow(titlePattern) {
    return new Promise((resolve, reject) => {
        // Use VBScript's AppActivate which is simpler and more reliable
        const vbsCode = `
Set WshShell = WScript.CreateObject("WScript.Shell")
WshShell.AppActivate "${titlePattern}"
`;
        const vbsFile = `${process.env.TEMP}\\focus_${Date.now()}.vbs`;

        // Write VBS file
        fs.writeFileSync(vbsFile, vbsCode);

        exec(`cscript //nologo "${vbsFile}"`, { encoding: 'utf-8' }, (err, stdout, stderr) => {
            try { fs.unlinkSync(vbsFile); } catch { }

            if (err) {
                resolve({ ok: false, error: err.message });
            } else {
                resolve({ ok: true });
            }
        });
    });
}

/**
 * Focus Antigravity window
 */
export async function focusAntigravity() {
    return focusWindow('Antigravity');
}

// ═══════════════════════════════════════════════════════════════════
// Keyboard Input (using VBScript SendKeys)
// ═══════════════════════════════════════════════════════════════════

/**
 * Send keyboard input using VBScript SendKeys
 * 
 * Key syntax:
 * - {ENTER}, {TAB}, {BACKSPACE}, {ESC}
 * - % = Alt, ^ = Ctrl, + = Shift
 * - %{ENTER} = Alt+Enter
 * - %+{BACKSPACE} = Alt+Shift+Backspace
 */
export function sendKeys(keys) {
    return new Promise((resolve, reject) => {
        const vbsCode = `
Set WshShell = WScript.CreateObject("WScript.Shell")
WScript.Sleep 100
WshShell.SendKeys "${keys}"
`;
        const vbsFile = `${process.env.TEMP}\\keys_${Date.now()}.vbs`;

        fs.writeFileSync(vbsFile, vbsCode);

        exec(`cscript //nologo "${vbsFile}"`, { encoding: 'utf-8' }, (err, stdout, stderr) => {
            try { fs.unlinkSync(vbsFile); } catch { }

            if (err) {
                resolve({ ok: false, error: err.message });
            } else {
                resolve({ ok: true });
            }
        });
    });
}

/**
 * Accept action (Alt+Enter)
 */
export async function accept() {
    return sendKeys('%{ENTER}');
}

/**
 * Reject action (Alt+Shift+Backspace)  
 */
export async function reject() {
    return sendKeys('%+{BACKSPACE}');
}

/**
 * New chat (Ctrl+Shift+L)
 */
export async function newChat() {
    return sendKeys('^+l');
}

/**
 * Focus chat and accept - combines window focus with accept action
 */
export async function focusAndAccept() {
    const focusResult = await focusAntigravity();
    if (!focusResult.ok) {
        return { ok: false, error: 'Could not focus Antigravity window' };
    }
    // Delay to ensure focus is established
    await new Promise(r => setTimeout(r, 200));
    return accept();
}

/**
 * Focus and reject - combines window focus with reject action
 */
export async function focusAndReject() {
    const focusResult = await focusAntigravity();
    if (!focusResult.ok) {
        return { ok: false, error: 'Could not focus Antigravity window' };
    }
    await new Promise(r => setTimeout(r, 200));
    return reject();
}

// ═══════════════════════════════════════════════════════════════════
// Create Chat and Send (Focus → New Chat → Type → Send)
// ═══════════════════════════════════════════════════════════════════

/**
 * Focus Antigravity, create new chat, type message, and send
 * This ensures the new chat is the active one for subsequent accepts
 */
export async function createChatAndSend(message) {
    // 1. Focus Antigravity window
    const focusResult = await focusAntigravity();
    if (!focusResult.ok) {
        return { ok: false, error: 'Could not focus Antigravity window' };
    }
    await new Promise(r => setTimeout(r, 300));

    // 2. Create new chat (Ctrl+Shift+L)
    await newChat();
    await new Promise(r => setTimeout(r, 500));

    // 3. Type the message using clipboard (more reliable for long text)
    await typeViaClipboard(message);
    await new Promise(r => setTimeout(r, 200));

    // 4. Send (Enter)
    await sendKeys('{ENTER}');

    return { ok: true, message: 'Chat created and message sent via UI' };
}

/**
 * Type text via clipboard (more reliable for long messages)
 */
export function typeViaClipboard(text) {
    return new Promise((resolve, reject) => {
        // Write text to temp file, then copy to clipboard and paste
        const tempFile = `${process.env.TEMP}\\paste_${Date.now()}.txt`;
        fs.writeFileSync(tempFile, text, 'utf8');

        const vbsCode = `
Set WshShell = WScript.CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
Set file = fso.OpenTextFile("${tempFile.replace(/\\/g, '\\\\')}", 1)
text = file.ReadAll
file.Close

' Copy to clipboard using HTML object
Set objHTML = CreateObject("htmlfile")
objHTML.ParentWindow.ClipboardData.SetData "text", text

WScript.Sleep 100
WshShell.SendKeys "^v"
`;
        const vbsFile = `${process.env.TEMP}\\paste_${Date.now()}.vbs`;
        fs.writeFileSync(vbsFile, vbsCode);

        exec(`cscript //nologo "${vbsFile}"`, { encoding: 'utf-8' }, (err, stdout, stderr) => {
            try { fs.unlinkSync(vbsFile); } catch { }
            try { fs.unlinkSync(tempFile); } catch { }

            if (err) {
                resolve({ ok: false, error: err.message });
            } else {
                resolve({ ok: true });
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════════
// Open Chat by ID via CDP
// ═══════════════════════════════════════════════════════════════════

/**
 * Open a specific chat by cascade ID using CDP
 * This finds the chat in the sidebar and clicks it
 */
export async function openChatById(cascadeId) {
    return new Promise((resolve, reject) => {
        // Get CDP targets
        http.get('http://127.0.0.1:9222/json/list', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    const targets = JSON.parse(data);
                    const target = targets.find(t => t.type === 'page') || targets[0];

                    if (!target) {
                        resolve({ ok: false, error: 'No CDP target found' });
                        return;
                    }

                    // Connect to CDP
                    const ws = new WebSocket(target.webSocketDebuggerUrl);
                    let msgId = 1;

                    ws.on('open', () => {
                        // Execute JS to find and click chat by ID
                        const js = `
                            (function() {
                                // Look for chat entries in sidebar
                                const entries = document.querySelectorAll('[data-conversation-id], [data-cascade-id]');
                                for (const entry of entries) {
                                    const id = entry.dataset?.conversationId || entry.dataset?.cascadeId;
                                    if (id && id.includes('${cascadeId.slice(0, 8)}')) {
                                        entry.click();
                                        return 'clicked: ' + id;
                                    }
                                }
                                // Try via history panel
                                const historyItems = document.querySelectorAll('.chat-history-item, .conversation-item');
                                for (const item of historyItems) {
                                    if (item.textContent.includes('${cascadeId.slice(0, 8)}')) {
                                        item.click();
                                        return 'clicked history item';
                                    }
                                }
                                return 'chat not found in sidebar';
                            })()
                        `;

                        ws.send(JSON.stringify({
                            id: msgId++,
                            method: 'Runtime.evaluate',
                            params: { expression: js, returnByValue: true }
                        }));

                        ws.on('message', (msg) => {
                            const response = JSON.parse(msg.toString());
                            if (response.id) {
                                ws.close();
                                resolve({
                                    ok: true,
                                    result: response.result?.result?.value || response.result
                                });
                            }
                        });

                        // Timeout after 3 seconds
                        setTimeout(() => {
                            ws.close();
                            resolve({ ok: false, error: 'Timeout' });
                        }, 3000);
                    });

                    ws.on('error', (err) => {
                        resolve({ ok: false, error: err.message });
                    });

                } catch (err) {
                    resolve({ ok: false, error: err.message });
                }
            });
        }).on('error', (err) => {
            resolve({ ok: false, error: 'CDP not available: ' + err.message });
        });
    });
}

/**
 * Focus chat and accept - opens chat by ID then sends accept keys
 */
export async function focusAcceptChat(cascadeId) {
    // First focus Antigravity
    const focusResult = await focusAntigravity();
    if (!focusResult.ok) {
        return { ok: false, error: 'Could not focus Antigravity' };
    }

    await new Promise(r => setTimeout(r, 300));

    // Try to open the specific chat via CDP
    if (cascadeId) {
        const openResult = await openChatById(cascadeId);
        console.log('Open chat result:', openResult);
        await new Promise(r => setTimeout(r, 500));
    }

    // Send accept
    return accept();
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

export default {
    focusWindow,
    focusAntigravity,
    sendKeys,
    accept,
    reject,
    newChat,
    focusAndAccept,
    focusAndReject,
    openChatById,
    focusAcceptChat,
    createChatAndSend,
    typeViaClipboard
};
