/**
 * GPI Retry - Retry a cascade after an error
 * 
 * When a cascade has an error (like "Agent terminated due to error"),
 * this module can resend the last user message or send a retry prompt.
 * 
 * Endpoint: /exa.language_server_pb.LanguageServerService/SendUserCascadeMessage
 * 
 * Usage:
 *   node index.js <cascadeId>                    # Retry with default message
 *   node index.js <cascadeId> "Custom message"   # Retry with custom message
 *   node index.js <cascadeId> --last             # Retry with last user message
 */

import api from '../api.js';

// Default retry messages
const RETRY_PROMPTS = [
    "Please continue where you left off.",
    "Please try again.",
    "Continue",
];

async function getLastUserMessage(port, csrfToken, cascadeId) {
    const result = await api.getTrajectory(port, csrfToken, cascadeId);
    if (!result.ok || !result.data?.trajectory?.steps) {
        return null;
    }

    const steps = result.data.trajectory.steps;
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i].type === 'CORTEX_STEP_TYPE_USER_INPUT' && steps[i].userInput?.query) {
            return steps[i].userInput.query;
        }
    }
    return null;
}

async function main() {
    const cascadeId = process.argv[2];
    const useLast = process.argv.includes('--last');
    let message = process.argv.slice(3).filter(a => !a.startsWith('--')).join(' ');

    if (!cascadeId || cascadeId.startsWith('--')) {
        console.log('GPI Retry - Retry a cascade after an error\n');
        console.log('Usage:');
        console.log('  node index.js <cascadeId>                    # Retry with "Continue"');
        console.log('  node index.js <cascadeId> "Custom message"   # Retry with custom message');
        console.log('  node index.js <cascadeId> --last             # Retry with last user message');
        process.exit(1);
    }

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

    console.log(`🔗 Port: ${port}`);
    console.log(`📍 Cascade: ${cascadeId}`);

    // Determine what message to send
    if (useLast) {
        console.log('🔍 Getting last user message...');
        message = await getLastUserMessage(port, config.csrfToken, cascadeId);
        if (!message) {
            console.log('⚠️ No previous user message found, using default');
            message = RETRY_PROMPTS[0];
        }
    } else if (!message) {
        message = RETRY_PROMPTS[0];
    }

    console.log(`🔄 Retry message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"\n`);

    try {
        const result = await api.sendMessage(port, config.csrfToken, cascadeId, message);

        if (result.ok) {
            console.log('✅ Retry sent successfully!');
            console.log('\nThe AI should now continue or try again.');
        } else {
            console.log(`❌ Failed: Status ${result.status}`);
            console.log(result.data);
        }
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

main().catch(console.error);
