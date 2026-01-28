// Test the /accept endpoint with specific cascadeId

const cascadeId = "21f6699f-1fdc-4764-86a8-f8a0b541f796";

console.log('Testing /accept with cascadeId:', cascadeId.slice(0, 8) + '...');
fetch('http://localhost:3000/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cascadeId })
})
    .then(r => r.json())
    .then(data => console.log('Accept result:', JSON.stringify(data, null, 2)))
    .catch(err => console.error('Accept error:', err.message));
