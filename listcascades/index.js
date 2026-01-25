/**
 * GPI List Cascades - Get all conversations from local storage
 * 
 * Reads from: ~/.gemini/antigravity/conversations/*.pb
 * 
 * Usage: node index.js
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

function getConversationsPath() {
    return path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');
}

async function main() {
    const convPath = getConversationsPath();

    if (!fs.existsSync(convPath)) {
        console.error('❌ Conversations folder not found');
        console.log(`   Expected: ${convPath}`);
        process.exit(1);
    }

    // Read .pb files
    const files = fs.readdirSync(convPath).filter(f => f.endsWith('.pb'));

    // Sort by modified time (newest first)
    const sorted = files.map(f => {
        const filePath = path.join(convPath, f);
        const stats = fs.statSync(filePath);
        return { name: f, mtime: stats.mtime, size: stats.size };
    }).sort((a, b) => b.mtime - a.mtime);

    console.log(`📋 Found ${sorted.length} conversations:\n`);

    for (const f of sorted) {
        const cascadeId = f.name.replace('.pb', '');
        const size = (f.size / 1024).toFixed(1);
        const date = f.mtime.toLocaleDateString();
        const time = f.mtime.toLocaleTimeString();

        console.log(`📌 ${cascadeId}`);
        console.log(`   ${size} KB | ${date} ${time}`);
        console.log('');
    }
}

main().catch(console.error);
