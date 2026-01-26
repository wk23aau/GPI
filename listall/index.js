/**
 * GPI List All - Get all conversations from server
 * 
 * Usage: node index.js
 */

import api from '../api.js';

async function main() {
    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port) {
        console.error('❌ Antigravity not running');
        process.exit(1);
    }

    if (!config?.csrfToken) {
        console.error('❌ Missing CSRF_TOKEN in .env');
        process.exit(1);
    }

    console.log(`🔗 Port: ${port}\n`);

    const result = await api.getAllCascadeTrajectories(port, config.csrfToken);

    if (!result.ok) {
        console.error(`❌ Failed: ${result.status}`);
        process.exit(1);
    }

    const summaries = result.data?.trajectorySummaries || {};
    const ids = Object.keys(summaries);

    if (ids.length === 0) {
        console.log('📭 No conversations found');
        return;
    }

    console.log(`📋 Found ${ids.length} conversation(s):\n`);

    for (const id of ids) {
        const t = summaries[id];
        const summary = t?.taskInfo?.taskName || 'No summary';
        const steps = t?.numSteps || 0;
        const modified = t?.lastModifiedTime ? new Date(parseInt(t.lastModifiedTime)).toLocaleString() : 'Unknown';

        console.log(`📌 ${id}`);
        console.log(`   💬 "${summary}"`);
        console.log(`   📊 ${steps} steps`);
        console.log(`   🕐 ${modified}\n`);
    }
}

main().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
