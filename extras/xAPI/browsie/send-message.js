// Send follow-up message to existing cascade
import api from '../../../api.js';

const cascadeId = "21f6699f-1fdc-4764-86a8-f8a0b541f796";
const message = "Use REPL directly";

const port = api.discoverPort();
const config = api.loadConfig();

console.log('Sending message to cascade:', cascadeId);
api.sendMessage(port, config.csrfToken, cascadeId, message)
    .then(result => console.log('Result:', JSON.stringify(result, null, 2)))
    .catch(err => console.error('Error:', err.message));
