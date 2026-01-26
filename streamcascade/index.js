/**
 * GPI Stream Cascade - Get real-time streaming updates from a cascade
 * 
 * Endpoint: /exa.language_server_pb.LanguageServerService/StreamCascadeReactiveUpdates
 * 
 * Uses Connect protocol with protobuf encoding.
 * 
 * Usage:
 *   node index.js <cascadeId>              # Stream updates
 *   node index.js <cascadeId> <duration>   # Stream for N seconds (default: 10)
 *   node index.js <cascadeId> --raw        # Show all chunks
 */

import api from '../api.js';
import https from 'https';

const LS = '/exa.language_server_pb.LanguageServerService';

// Connect envelope: flags(1) + length(4 big-endian) + proto
function connectEnvelope(protoData, flags = 0) {
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(protoData.length, 0);
    return Buffer.concat([Buffer.from([flags]), lenBuf, protoData]);
}

function encodeVarint(n) {
    const bytes = [];
    while (n > 127) {
        bytes.push((n & 0x7F) | 0x80);
        n >>>= 7;
    }
    bytes.push(n);
    return Buffer.from(bytes);
}

function encodeString(field, value) {
    const data = Buffer.from(value, 'utf-8');
    return Buffer.concat([
        Buffer.from([(field << 3) | 2]),
        encodeVarint(data.length),
        data
    ]);
}

function encodeBool(field, value) {
    return Buffer.from([(field << 3) | 0, value ? 1 : 0]);
}

async function streamCascade(port, csrfToken, cascadeId, duration = 10, showRaw = false, showThinking = false, liveOnly = false) {
    return new Promise((resolve) => {
        // Build protobuf request
        const proto = Buffer.concat([
            encodeBool(1, true),                          // subscribe = true
            encodeString(2, cascadeId),                   // cascadeId
            encodeString(3, 'chat-client-trajectories')   // channel
        ]);

        const payload = connectEnvelope(proto);

        console.log(`📡 Streaming from ${cascadeId}...`);
        console.log(`   Duration: ${duration}s`);
        console.log('─'.repeat(60));

        const chunks = [];
        let textBuffer = '';
        let streamStartTime = Date.now();
        const skipMs = liveOnly ? 2000 : 0; // Skip first 2s for live mode

        const req = https.request({
            hostname: '127.0.0.1',
            port,
            path: `${LS}/StreamCascadeReactiveUpdates`,
            method: 'POST',
            headers: {
                'Connect-Protocol-Version': '1',
                'Content-Type': 'application/connect+proto',
                'x-codeium-csrf-token': csrfToken,
                'Origin': 'vscode-file://vscode-app'
            },
            rejectUnauthorized: false,
            timeout: (duration + 5) * 1000
        }, res => {
            console.log(`   Status: ${res.statusCode}\n`);

            res.on('data', chunk => {
                chunks.push(chunk);

                if (showRaw) {
                    console.log(`[Chunk ${chunks.length}] ${chunk.length} bytes`);
                }

                // Skip initial history burst in live mode
                if (liveOnly && (Date.now() - streamStartTime < skipMs)) {
                    return;
                }

                // Extract readable text from protobuf
                const raw = chunk.toString('latin1');

                // Look for thinking content specifically
                if (showThinking) {
                    // Better thinking extraction
                    const raw2 = chunk.toString('utf8');

                    // Multiple patterns to catch thinking
                    const patterns = [
                        /"thinking"\s*:\s*"([^"]{30,})"/,
                        /thinking[:\s]+([A-Z][a-z].{30,}?)(?=\s{3}|\\n|$)/,
                    ];

                    for (const pattern of patterns) {
                        const match = raw2.match(pattern);
                        if (match) {
                            let text = match[1]
                                .replace(/\\n/g, ' ')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '')
                                .replace(/\s+/g, ' ')
                                .replace(/[^\x20-\x7E]/g, '')
                                .trim();

                            // Skip if too short, looks like code, or already seen
                            if (text.length < 30) continue;
                            if (text.includes('console.log') || text.includes('function')) continue;
                            if (text.includes('CORTEX_') || text.includes('toolu_')) continue;
                            if (text.includes('import ') || text.includes('export ')) continue;
                            if (textBuffer.includes(text.substring(0, 40))) continue;

                            // Clean up and display
                            text = text.substring(0, 300);
                            console.log(`\n💭 ${text}`);
                            textBuffer += text.substring(0, 40);
                            break;
                        }
                    }
                    return;
                }

                const matches = raw.match(/[\x20-\x7E]{15,}/g) || [];

                for (const text of matches) {
                    // Filter out tokens, UUIDs, and base64
                    if (!text.match(/^[A-Za-z0-9+/=_-]{30,}$/) &&
                        !text.match(/^[0-9a-f-]{36}$/) &&
                        !text.includes('toolu_vrtx_')) {

                        // Detect step types
                        if (text.includes('CORTEX_STEP_TYPE_')) {
                            const type = text.match(/CORTEX_STEP_TYPE_([A-Z_]+)/)?.[1];
                            if (type && type !== 'PLANNER_RESPONSE') {
                                console.log(`\n📌 [${type}]`);
                            }
                        } else if (!textBuffer.includes(text)) {
                            // New text content
                            process.stdout.write(text.slice(0, 100));
                            textBuffer += text;
                        }
                    }
                }
            });

            res.on('end', () => {
                console.log('\n' + '─'.repeat(60));
                console.log(`✅ Stream complete: ${chunks.length} chunks`);
                resolve(chunks);
            });
        });

        req.on('error', e => {
            console.log('❌ Error:', e.message);
            resolve(chunks);
        });

        req.write(payload);
        req.end();

        // Timeout
        setTimeout(() => {
            console.log('\n⏱️ Timeout reached');
            req.destroy();
        }, duration * 1000);
    });
}

async function main() {
    const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
    const cascadeId = args[0];
    const duration = parseInt(args[1]) || 10;
    const showRaw = process.argv.includes('--raw');

    if (!cascadeId) {
        console.log('GPI Stream Cascade - Real-time streaming updates\n');
        console.log('Usage:');
        console.log('  node index.js <cascadeId>              # Stream for 10 seconds');
        console.log('  node index.js <cascadeId> <duration>   # Stream for N seconds');
        console.log('  node index.js <cascadeId> --raw        # Show all chunks');
        console.log('  node index.js <cascadeId> --thinking    # Show thinking only');
        console.log('  node index.js <cascadeId> --live         # Skip history, new data only');
        console.log('\nThis shows the AI response as it generates in real-time.');
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

    const showThinking = process.argv.includes('--thinking');
    const liveOnly = process.argv.includes('--live');
    await streamCascade(port, config.csrfToken, cascadeId, duration, showRaw, showThinking, liveOnly);
}

main().catch(console.error);
