/**
 * GPI - Gravity Protocol Interface
 * Clean Antigravity Chat API
 * 
 * Verified working format decoded from Antigravity traffic.
 */

import { execSync } from 'child_process';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LS = '/exa.language_server_pb.LanguageServerService';

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

export function loadConfig() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return null;

    const env = {};
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...val] = trimmed.split('=');
        if (key && val.length) env[key.trim()] = val.join('=').trim();
    }

    return {
        csrfToken: env.CSRF_TOKEN || null,
        cascadeId: env.CASCADE_ID || null
    };
}

export function saveConfig(csrfToken, cascadeId = null) {
    const envPath = path.join(__dirname, '.env');
    let content = `# GPI Configuration\nCSRF_TOKEN=${csrfToken}\n`;
    if (cascadeId) content += `CASCADE_ID=${cascadeId}\n`;
    fs.writeFileSync(envPath, content);
}

// ═══════════════════════════════════════════════════════════════════════════
// Port Discovery
// ═══════════════════════════════════════════════════════════════════════════

export function discoverPort() {
    try {
        const netstat = execSync('netstat -ano', { encoding: 'utf-8' });
        const tasklist = execSync('tasklist /FI "IMAGENAME eq language_server_windows_x64.exe" /FO CSV', { encoding: 'utf-8' });
        const m = tasklist.match(/"language_server_windows_x64\.exe","(\d+)"/);
        if (!m) return null;

        for (const line of netstat.split('\n')) {
            if (line.includes('LISTENING') && line.includes(m[1])) {
                const p = line.match(/127\.0\.0\.1:(\d+)/);
                if (p) return parseInt(p[1], 10);
            }
        }
    } catch { }
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Client
// ═══════════════════════════════════════════════════════════════════════════

export async function post(port, csrfToken, endpoint, body) {
    return new Promise((resolve, reject) => {
        const jsonBody = JSON.stringify(body);

        const req = https.request({
            hostname: '127.0.0.1',
            port,
            path: `${LS}/${endpoint}`,
            method: 'POST',
            headers: {
                'x-codeium-csrf-token': csrfToken,
                'connect-protocol-version': '1',
                'content-type': 'application/json',
                'Origin': 'vscode-file://vscode-app'
            },
            rejectUnauthorized: false,
            timeout: 30000
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const raw = Buffer.concat(chunks).toString();
                let data;
                try { data = JSON.parse(raw); } catch { data = raw; }
                resolve({
                    ok: res.statusCode === 200,
                    status: res.statusCode,
                    data
                });
            });
        });

        req.on('error', reject);
        req.write(jsonBody);
        req.end();
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// API Functions
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send a message to a cascade conversation
 * Uses the verified JSON format decoded from Antigravity traffic
 */
export async function sendMessage(port, csrfToken, cascadeId, message) {
    return post(port, csrfToken, 'SendUserCascadeMessage', {
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
                            autoExecutionPolicy: 'CASCADE_COMMANDS_AUTO_EXECUTION_OFF'
                        }
                    },
                    notifyUser: {
                        artifactReviewMode: 'ARTIFACT_REVIEW_MODE_ALWAYS'
                    }
                },
                requestedModel: {
                    model: 'MODEL_PLACEHOLDER_M12'
                }
            }
        }
    });
}

/**
 * Get conversation history
 */
export async function getTrajectory(port, csrfToken, cascadeId) {
    return post(port, csrfToken, 'GetCascadeTrajectory', { cascadeId });
}

/**
 * Start a new cascade conversation
 */
export async function startCascade(port, csrfToken) {
    return post(port, csrfToken, 'StartCascade', {
        metadata: {
            ideName: 'antigravity',
            locale: 'en',
            ideVersion: '1.15.8',
            extensionName: 'antigravity'
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Protobuf Encoding (for HandleCascadeUserInteraction)
// ═══════════════════════════════════════════════════════════════════════════

function encodeVarint(value) {
    const bytes = [];
    while (value > 127) {
        bytes.push((value & 0x7F) | 0x80);
        value >>>= 7;
    }
    bytes.push(value);
    return Buffer.from(bytes);
}

function encodeString(fieldNum, str) {
    const tag = Buffer.from([(fieldNum << 3) | 2]);
    const data = Buffer.from(str, 'utf-8');
    return Buffer.concat([tag, encodeVarint(data.length), data]);
}

function encodeInt(fieldNum, value) {
    return Buffer.concat([Buffer.from([(fieldNum << 3) | 0]), encodeVarint(value)]);
}

function encodeNested(fieldNum, nested) {
    const tag = Buffer.from([(fieldNum << 3) | 2]);
    return Buffer.concat([tag, encodeVarint(nested.length), nested]);
}

/**
 * POST with proto content type
 */
export async function postProto(port, csrfToken, endpoint, protoBody) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: '127.0.0.1',
            port,
            path: `${LS}/${endpoint}`,
            method: 'POST',
            headers: {
                'x-codeium-csrf-token': csrfToken,
                'connect-protocol-version': '1',
                'content-type': 'application/proto',
                'Origin': 'vscode-file://vscode-app'
            },
            rejectUnauthorized: false,
            timeout: 30000
        }, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                resolve({
                    ok: res.statusCode === 200,
                    status: res.statusCode,
                    data: Buffer.concat(chunks)
                });
            });
        });

        req.on('error', reject);
        req.write(protoBody);
        req.end();
    });
}

/**
 * Accept a pending command (HandleCascadeUserInteraction)
 * 
 * @param {number} port - Language Server port
 * @param {string} csrfToken - CSRF token
 * @param {string} cascadeId - Cascade ID
 * @param {string} trajectoryId - Trajectory ID (from GetCascadeTrajectory)
 * @param {number} stepIndex - Step index of the command
 * @param {string} command - The command text to accept
 */
export async function acceptCommand(port, csrfToken, cascadeId, trajectoryId, stepIndex, command) {
    const trajectoryInfo = Buffer.concat([
        encodeString(1, trajectoryId),
        encodeInt(2, stepIndex),
    ]);

    const actionDetails = Buffer.concat([
        encodeInt(1, 1),  // action_type = 1 (accept)
        encodeString(2, command),
        encodeString(3, command),
    ]);

    const protoBody = Buffer.concat([
        encodeString(4, cascadeId),
        encodeNested(2, trajectoryInfo),
        encodeNested(5, actionDetails),
    ]);

    return postProto(port, csrfToken, 'HandleCascadeUserInteraction', protoBody);
}

/**
 * Reject a pending command
 */
export async function rejectCommand(port, csrfToken, cascadeId, trajectoryId, stepIndex) {
    const trajectoryInfo = Buffer.concat([
        encodeString(1, trajectoryId),
        encodeInt(2, stepIndex),
    ]);

    const actionDetails = Buffer.concat([
        encodeInt(1, 2),  // action_type = 2 (reject)
    ]);

    const protoBody = Buffer.concat([
        encodeString(4, cascadeId),
        encodeNested(2, trajectoryInfo),
        encodeNested(5, actionDetails),
    ]);

    return postProto(port, csrfToken, 'HandleCascadeUserInteraction', protoBody);
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Export
// ═══════════════════════════════════════════════════════════════════════════

/**
 * List all cascades (conversations) from local storage
 */
export function listCascades() {
    const convPath = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');

    if (!fs.existsSync(convPath)) {
        return { ok: false, error: 'Conversations folder not found' };
    }

    const files = fs.readdirSync(convPath).filter(f => f.endsWith('.pb'));

    const cascades = files.map(f => {
        const filePath = path.join(convPath, f);
        const stats = fs.statSync(filePath);
        return {
            cascadeId: f.replace('.pb', ''),
            modified: stats.mtime.toISOString(),
            sizeKB: (stats.size / 1024).toFixed(1)
        };
    }).sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return { ok: true, data: { cascades, count: cascades.length } };
}

export default {
    loadConfig,
    saveConfig,
    discoverPort,
    post,
    postProto,
    sendMessage,
    getTrajectory,
    startCascade,
    acceptCommand,
    rejectCommand,
    listCascades
};

