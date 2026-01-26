/**
 * GPI SendMessage with Config Example
 * 
 * Demonstrates using newly discovered proto fields
 * 
 * Usage: node examples/send-with-config.js <cascadeId>
 */

import api from '../api.js';

async function main() {
    const cascadeId = process.argv[2];

    if (!cascadeId) {
        console.log('GPI - Send with Advanced Config\n');
        console.log('Usage: node examples/send-with-config.js <cascadeId>\n');
        console.log('Demonstrates using discovered proto fields for fine control.');
        process.exit(1);
    }

    const port = api.discoverPort();
    const config = api.loadConfig();

    if (!port || !config?.csrfToken) {
        console.error('❌ Setup required: Antigravity running + CSRF_TOKEN in .env');
        process.exit(1);
    }

    console.log('🔗 Port:', port);
    console.log('📍 Cascade:', cascadeId);
    console.log('');

    // Example 1: Limit token usage to avoid quota issues
    console.log('═'.repeat(60));
    console.log('Example 1: Limited Token Usage');
    console.log('═'.repeat(60));
    console.log('Setting maxNumChatInputTokens to 2000 to conserve quota\n');

    const result1 = await api.sendMessage(
        port,
        config.csrfToken,
        cascadeId,
        'What is 2+2?',
        { maxNumChatInputTokens: 2000 }
    );

    console.log(result1.ok ? '✅ Sent with token limit' : '❌ Failed');
    console.log('');

    // Example 2: Disable browser features
    console.log('═'.repeat(60));
    console.log('Example 2: Disable Browser');
    console.log('═'.repeat(60));
    console.log('Setting browserJsExecutionEnabled=false for security\n');

    const result2 = await api.sendMessage(
        port,
        config.csrfToken,
        cascadeId,
        'Can you help me with a task?',
        {
            browserJsExecutionEnabled: false,
            maxBrowserInteractions: 0
        }
    );

    console.log(result2.ok ? '✅ Sent without browser' : '❌ Failed');
    console.log('');

    // Example 3: Resume from specific trajectory point
    console.log('═'.repeat(60));
    console.log('Example 3: Resume from Trajectory Point');
    console.log('═'.repeat(60));
    console.log('Setting trajectoryStartIndex=5 to resume\n');

    const result3 = await api.sendMessage(
        port,
        config.csrfToken,
        cascadeId,
        'Continue from where we left off',
        { trajectoryStartIndex: 5 }
    );

    console.log(result3.ok ? '✅ Sent with resume point' : '❌ Failed');
    console.log('');

    // Example 4: Use retry for reliability
    console.log('═'.repeat(60));
    console.log('Example 4: Send with Auto-Retry');
    console.log('═'.repeat(60));
    console.log('Using sendWithRetry for better reliability\n');

    try {
        const result4 = await api.sendWithRetry(
            port,
            config.csrfToken,
            cascadeId,
            'This will retry if it fails'
        );

        console.log(result4.ok ? '✅ Sent with retry protection' : '❌ Failed after retries');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log('✅ Examples complete!');
    console.log('═'.repeat(60));
}

main().catch(console.error);
