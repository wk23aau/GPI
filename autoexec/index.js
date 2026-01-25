/**
 * GPI AutoExec - Send messages with configurable auto-execution settings
 * 
 * Control whether commands run automatically or require approval.
 *
 * Usage:
 *   node index.js <cascadeId> "message"                 # Default (manual approval)
 *   node index.js <cascadeId> "message" --auto          # Auto-execute safe commands
 *   node index.js <cascadeId> "message" --turbo         # Auto-execute ALL commands (dangerous!)
 *   node index.js <cascadeId> "message" --model M13     # Use specific model
 */

import api from '../api.js';

// Execution policies
const POLICIES = {
    'off': 'CASCADE_COMMANDS_AUTO_EXECUTION_OFF',         // Manual approval
    'auto': 'CASCADE_COMMANDS_AUTO_EXECUTION_SAFE_ONLY',  // Auto-run safe commands
    'turbo': 'CASCADE_COMMANDS_AUTO_EXECUTION_ALL'        // Auto-run everything (dangerous!)
};

// Available models (discovered from traffic)
const MODELS = {
    'M12': 'MODEL_PLACEHOLDER_M12',     // Default model
    'M13': 'MODEL_PLACEHOLDER_M13',     // Newer model
    'opus': 'claude-opus-4-20250514',   // Claude Opus 4.5
    'sonnet': 'claude-3-5-sonnet-20241022'
};

async function sendWithConfig(port, csrfToken, cascadeId, message, execPolicy, model) {
    const body = {
        cascadeId,
        items: [{ text: message }],
        metadata: {
            ideName: 'antigravity',
            locale: 'en',
            ideVersion: '1.15.8',
            extensionName: 'antigravity'
        },
        cascadeConfig: {
            plannerConfig: {
                conversational: {
                    plannerMode: 'CONVERSATIONAL_PLANNER_MODE_DEFAULT',
                    agenticMode: true
                },
                toolConfig: {
                    runCommand: {
                        autoCommandConfig: {
                            autoExecutionPolicy: execPolicy
                        }
                    },
                    notifyUser: {
                        artifactReviewMode: 'ARTIFACT_REVIEW_MODE_ALWAYS'
                    }
                },
                requestedModel: {
                    model: model
                }
            }
        }
    };

    return await api.post(port, csrfToken, 'SendUserCascadeMessage', body);
}

async function main() {
    const args = process.argv.slice(2);
    const cascadeId = args[0];

    if (!cascadeId || cascadeId.startsWith('--')) {
        console.log('GPI AutoExec - Send messages with configurable auto-execution\n');
        console.log('Usage:');
        console.log('  node index.js <cascadeId> "message"              # Manual approval (default)');
        console.log('  node index.js <cascadeId> "message" --auto       # Auto-run safe commands');
        console.log('  node index.js <cascadeId> "message" --turbo      # Auto-run ALL (dangerous!)');
        console.log('  node index.js <cascadeId> "message" --model M13  # Use specific model');
        console.log('\nModels: M12 (default), M13, opus, sonnet');
        console.log('\n⚠️ WARNING: --turbo will run ANY command without asking!');
        process.exit(1);
    }

    // Find message (first non-flag argument after cascadeId)
    let message = '';
    for (let i = 1; i < args.length; i++) {
        if (!args[i].startsWith('--')) {
            message = args[i];
            break;
        }
    }

    if (!message) {
        console.error('❌ No message provided');
        process.exit(1);
    }

    // Parse flags
    const hasAuto = args.includes('--auto');
    const hasTurbo = args.includes('--turbo');
    const modelIndex = args.indexOf('--model');
    const modelArg = modelIndex >= 0 ? args[modelIndex + 1] : 'M12';

    // Determine execution policy
    let policy = 'off';
    if (hasTurbo) policy = 'turbo';
    else if (hasAuto) policy = 'auto';

    const execPolicy = POLICIES[policy];
    const model = MODELS[modelArg] || MODELS['M12'];

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
    console.log(`📝 Message: "${message.substring(0, 50)}..."`);
    console.log(`📌 Execution: ${policy.toUpperCase()}`);
    console.log(`🤖 Model: ${modelArg}`);

    if (policy === 'turbo') {
        console.log('\n⚠️ ⚠️ ⚠️  TURBO MODE - Commands will run automatically! ⚠️ ⚠️ ⚠️\n');
    }

    const result = await sendWithConfig(port, config.csrfToken, cascadeId, message, execPolicy, model);

    if (result.ok) {
        console.log('\n✅ Message sent with custom config!');
    } else {
        console.log(`\n❌ Failed: Status ${result.status}`);
        console.log(result.data);
    }
}

main().catch(console.error);
