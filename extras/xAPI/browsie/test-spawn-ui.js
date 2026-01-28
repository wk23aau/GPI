// Test the /spawn-ui endpoint (Focus → Ctrl+Shift+L → Paste → Enter)

const task = "Say hello and then run: echo test";

console.log('Testing /spawn-ui endpoint...');
fetch('http://localhost:3000/spawn-ui', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task })
})
    .then(r => r.json())
    .then(data => console.log('Spawn-UI result:', JSON.stringify(data, null, 2)))
    .catch(err => console.error('Error:', err.message));
