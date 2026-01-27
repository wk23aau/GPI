/**
 * Vision Agent - Screenshot Analyzer
 * Captures screenshots and updates world.json with visual analysis
 */
import CDP from './cdp.js';
import { updateState, getState } from './world.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_PATH = path.join(__dirname, 'vision.jpg');

async function main() {
    const cdp = new CDP(9222);

    console.log('Vision Agent starting...');

    try {
        const target = await cdp.connect();
        console.log('Connected:', target.title);
        await cdp.enableAll();

        let lastTs = 0;
        let loopCount = 0;

        while (true) {
            loopCount++;

            try {
                // Get current browser state via extension
                const state = await cdp.eval('typeof __cdp !== "undefined" ? __cdp.state() : null');

                if (state && state.ts > lastTs) {
                    lastTs = state.ts;

                    // Capture screenshot at 25% quality
                    await cdp.screenshot(SCREENSHOT_PATH, 25);
                    console.log(`[${new Date().toISOString()}] Screenshot captured`);

                    // Update world.json with state + screenshot path
                    const worldState = {
                        url: state.url || '',
                        title: state.title || '',
                        uiMap: state.uiMap || [],
                        uiMapCount: state.uiMapCount || 0,
                        visionAnalysis: {
                            screenshot: SCREENSHOT_PATH,
                            timestamp: new Date().toISOString(),
                            loopCount
                        }
                    };

                    updateState(worldState, 'screenshot-capture');
                    console.log(`Updated world.json: ${state.url}`);
                } else if (!state) {
                    // Extension not loaded, just get basic info
                    const url = await cdp.eval('location.href');
                    const title = await cdp.eval('document.title');

                    await cdp.screenshot(SCREENSHOT_PATH, 25);

                    updateState({
                        url,
                        title,
                        uiMap: [],
                        uiMapCount: 0,
                        visionAnalysis: {
                            screenshot: SCREENSHOT_PATH,
                            timestamp: new Date().toISOString(),
                            note: 'CDP extension not loaded - basic capture only'
                        }
                    }, 'basic-screenshot');

                    console.log(`[Basic] Screenshot: ${url}`);
                }
            } catch (err) {
                console.error('Loop error:', err.message);
            }

            // Wait before next capture
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (err) {
        console.error('Failed to connect:', err.message);
        process.exit(1);
    }
}

main();
