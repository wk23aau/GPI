/**
 * GPI SaveChat - Backup conversations and brain artifacts
 * 
 * Saves all conversations and artifacts to a zip file with a restore script.
 * 
 * Usage:
 *   node index.js                     # Backup all conversations
 *   node index.js <cascadeId>         # Backup specific conversation
 *   node index.js --list              # List available conversations
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Paths
const CONVERSATIONS_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');
const BRAIN_PATH = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const OUTPUT_DIR = path.join(process.cwd(), '..', 'backups');  // GPI/backups folder

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get all conversations
function getConversations() {
    if (!fs.existsSync(CONVERSATIONS_PATH)) return [];
    return fs.readdirSync(CONVERSATIONS_PATH)
        .filter(f => f.endsWith('.pb'))
        .map(f => {
            const filePath = path.join(CONVERSATIONS_PATH, f);
            const stats = fs.statSync(filePath);
            return {
                cascadeId: f.replace('.pb', ''),
                file: f,
                path: filePath,
                size: stats.size,
                modified: stats.mtime
            };
        })
        .sort((a, b) => b.modified - a.modified);
}

// Get brain artifacts for a cascade
function getBrainArtifacts(cascadeId) {
    const brainDir = path.join(BRAIN_PATH, cascadeId);
    if (!fs.existsSync(brainDir)) return [];

    const files = [];
    function walk(dir) {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stats = fs.statSync(itemPath);
            if (stats.isDirectory()) {
                walk(itemPath);
            } else {
                files.push({
                    path: itemPath,
                    relativePath: path.relative(brainDir, itemPath),
                    size: stats.size
                });
            }
        }
    }
    walk(brainDir);
    return files;
}

// Create restore script
function createRestoreScript(cascadeIds) {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
        return `@echo off
REM GPI SaveChat Restore Script
REM Run this to restore conversations and brain artifacts

set CONVERSATIONS_PATH=%USERPROFILE%\\.gemini\\antigravity\\conversations
set BRAIN_PATH=%USERPROFILE%\\.gemini\\antigravity\\brain

echo Restoring GPI backup...

REM Create directories if needed
if not exist "%CONVERSATIONS_PATH%" mkdir "%CONVERSATIONS_PATH%"
if not exist "%BRAIN_PATH%" mkdir "%BRAIN_PATH%"

REM Copy conversations
echo Restoring conversations...
xcopy /E /Y "conversations\\*" "%CONVERSATIONS_PATH%\\"

REM Copy brain artifacts
echo Restoring brain artifacts...
xcopy /E /Y "brain\\*" "%BRAIN_PATH%\\"

echo.
echo ✅ Restore complete!
echo Conversations: %CONVERSATIONS_PATH%
echo Brain: %BRAIN_PATH%
pause
`;
    } else {
        return `#!/bin/bash
# GPI SaveChat Restore Script
# Run this to restore conversations and brain artifacts

CONVERSATIONS_PATH="$HOME/.gemini/antigravity/conversations"
BRAIN_PATH="$HOME/.gemini/antigravity/brain"

echo "Restoring GPI backup..."

# Create directories if needed
mkdir -p "$CONVERSATIONS_PATH"
mkdir -p "$BRAIN_PATH"

# Copy conversations
echo "Restoring conversations..."
cp -r conversations/* "$CONVERSATIONS_PATH/"

# Copy brain artifacts
echo "Restoring brain artifacts..."
cp -r brain/* "$BRAIN_PATH/"

echo ""
echo "✅ Restore complete!"
echo "Conversations: $CONVERSATIONS_PATH"
echo "Brain: $BRAIN_PATH"
`;
    }
}

// Create backup
async function createBackup(selectedIds = null) {
    const conversations = getConversations();

    if (conversations.length === 0) {
        console.log('❌ No conversations found');
        return;
    }

    // Filter if specific IDs provided
    const toBackup = selectedIds
        ? conversations.filter(c => selectedIds.includes(c.cascadeId))
        : conversations;

    if (toBackup.length === 0) {
        console.log('❌ No matching conversations found');
        return;
    }

    // Create timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `gpi-backup-${timestamp}`;
    const backupDir = path.join(OUTPUT_DIR, backupName);
    const conversationsDir = path.join(backupDir, 'conversations');
    const brainDir = path.join(backupDir, 'brain');

    // Create directories
    fs.mkdirSync(conversationsDir, { recursive: true });
    fs.mkdirSync(brainDir, { recursive: true });

    console.log(`\n📦 Creating backup: ${backupName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    let totalSize = 0;
    let fileCount = 0;

    // Copy conversations
    for (const conv of toBackup) {
        const destPath = path.join(conversationsDir, conv.file);
        fs.copyFileSync(conv.path, destPath);
        totalSize += conv.size;
        fileCount++;
        console.log(`📄 ${conv.cascadeId.slice(0, 8)}... (${(conv.size / 1024).toFixed(1)} KB)`);

        // Copy brain artifacts
        const artifacts = getBrainArtifacts(conv.cascadeId);
        if (artifacts.length > 0) {
            const cascadeBrainDir = path.join(brainDir, conv.cascadeId);
            fs.mkdirSync(cascadeBrainDir, { recursive: true });

            for (const artifact of artifacts) {
                const destArtifact = path.join(cascadeBrainDir, artifact.relativePath);
                fs.mkdirSync(path.dirname(destArtifact), { recursive: true });
                fs.copyFileSync(artifact.path, destArtifact);
                totalSize += artifact.size;
                fileCount++;
            }
            console.log(`   🧠 ${artifacts.length} brain artifact(s)`);
        }
    }

    // Create restore script
    const scriptName = process.platform === 'win32' ? 'restore.bat' : 'restore.sh';
    const scriptPath = path.join(backupDir, scriptName);
    fs.writeFileSync(scriptPath, createRestoreScript(toBackup.map(c => c.cascadeId)));
    if (process.platform !== 'win32') {
        fs.chmodSync(scriptPath, '755');
    }

    // Create manifest
    const manifest = {
        created: new Date().toISOString(),
        conversations: toBackup.map(c => ({
            cascadeId: c.cascadeId,
            modified: c.modified.toISOString(),
            sizeKB: (c.size / 1024).toFixed(1)
        })),
        totalFiles: fileCount,
        totalSizeKB: (totalSize / 1024).toFixed(1)
    };
    fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Create zip
    const zipPath = `${backupDir}.zip`;
    console.log(`\n📦 Creating zip: ${path.basename(zipPath)}`);

    try {
        if (process.platform === 'win32') {
            execSync(`powershell Compress-Archive -Path "${backupDir}\\*" -DestinationPath "${zipPath}" -Force`, { stdio: 'pipe' });
        } else {
            execSync(`cd "${OUTPUT_DIR}" && zip -r "${backupName}.zip" "${backupName}"`, { stdio: 'pipe' });
        }

        // Remove directory, keep zip
        fs.rmSync(backupDir, { recursive: true });

        const zipStats = fs.statSync(zipPath);
        console.log(`\n✅ Backup complete!`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📁 Location: ${zipPath}`);
        console.log(`📊 Size: ${(zipStats.size / 1024).toFixed(1)} KB`);
        console.log(`📝 Files: ${fileCount}`);
        console.log(`💬 Conversations: ${toBackup.length}`);
        console.log(`\n💡 To restore: Extract zip and run restore.${process.platform === 'win32' ? 'bat' : 'sh'}`);

    } catch (e) {
        console.log(`\n⚠️ Zip creation failed, backup saved as folder: ${backupDir}`);
    }
}

// List conversations
function listConversations() {
    const conversations = getConversations();

    if (conversations.length === 0) {
        console.log('❌ No conversations found');
        return;
    }

    console.log(`\n📋 Found ${conversations.length} conversation(s):\n`);

    for (const conv of conversations.slice(0, 20)) {
        const artifacts = getBrainArtifacts(conv.cascadeId);
        const date = conv.modified.toLocaleDateString();
        const time = conv.modified.toLocaleTimeString();
        const size = (conv.size / 1024).toFixed(1);

        console.log(`📌 ${conv.cascadeId}`);
        console.log(`   ${size} KB | ${date} ${time}`);
        if (artifacts.length > 0) {
            console.log(`   🧠 ${artifacts.length} brain artifact(s)`);
        }
        console.log('');
    }

    if (conversations.length > 20) {
        console.log(`... and ${conversations.length - 20} more`);
    }
}

// Main
async function main() {
    const args = process.argv.slice(2);

    console.log(`\n💾 GPI SaveChat - Backup & Restore\n`);

    if (args.includes('--list') || args.includes('-l')) {
        listConversations();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage:');
        console.log('  node index.js                     Backup all conversations');
        console.log('  node index.js <cascadeId>         Backup specific conversation');
        console.log('  node index.js id1 id2 id3         Backup multiple conversations');
        console.log('  node index.js --list              List available conversations');
        console.log('  node index.js --help              Show this help');
        console.log('\nOutput: Creates zip in ../backups/ with restore script');
    } else if (args.length > 0 && !args[0].startsWith('--')) {
        // Backup specific conversations
        await createBackup(args);
    } else {
        // Backup all
        await createBackup();
    }
}

main().catch(console.error);
