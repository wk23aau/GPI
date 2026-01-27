import api from '../../api.js';

const port = api.discoverPort();
const config = api.loadConfig();
const cascadeId = process.argv[2] || '792452c4-6cf0-495d-9960-4cd375b53b99';

console.log('Fetching trajectory for:', cascadeId);
const result = await api.getTrajectory(port, config.csrfToken, cascadeId);

// Print trajectory steps
const steps = result.data?.trajectory?.steps || [];
console.log('Total steps:', steps.length);

for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type?.includes('RUN_COMMAND')) {
        console.log(`\n=== Step ${i} (RUN_COMMAND) ===`);
        console.log(JSON.stringify(step, null, 2));
    }
}
