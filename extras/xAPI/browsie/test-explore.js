import http from 'http';

const message = `Use the CDP REPL to explore the internet. Follow these steps:

1. First run __cdp.state() to see current page state
2. Navigate to Google: Page.navigate {"url":"https://www.google.com"}
3. Wait 2 seconds, then run __cdp.ui() to see clickable elements
4. Find the search box using __cdp.find("Search") or look for textarea in ui() output
5. Click on the search box coordinates using:
   Input.dispatchMouseEvent {"type":"mousePressed","x":X,"y":Y,"button":"left","clickCount":1}
   Input.dispatchMouseEvent {"type":"mouseReleased","x":X,"y":Y,"button":"left"}
6. Type the search query: Input.insertText {"text":"latest tech news 2026"}
7. Press Enter: 
   Input.dispatchKeyEvent {"type":"keyDown","key":"Enter","code":"Enter","windowsVirtualKeyCode":13}
   Input.dispatchKeyEvent {"type":"keyUp","key":"Enter","code":"Enter"}
8. Wait for results, then run __cdp.ui() again to see the search results
9. Report what you found

Remember: All commands go into the cdp> prompt using send_command_input. Never use run_command or browser_subagent.`;

const postData = JSON.stringify({ task: message });

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/spawn-ui',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Spawn result:', JSON.parse(data));
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(postData);
req.end();
