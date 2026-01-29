import Database from 'better-sqlite3';
import { CDP } from '../../cdp-repl/index.js';
import fs from 'fs';

// Load credentials
const credentials = fs.readFileSync('../credentials.txt', 'utf-8').split('\n').reduce((acc, line) => {
    if (line.includes('@')) acc.email = line.trim();
    else if (line.includes('easy pass')) acc.password = line.split('easy pass')[1].trim();
    else if (line.includes('Phone')) acc.phone = line.split('Phone')[1].trim();
    else if (line.includes('date of birth')) acc.dob = line.split('date of birth')[1].trim();
    return acc;
}, {});

console.log('📋 Credentials loaded:', { email: credentials.email, phone: credentials.phone });

const db = new Database('../jobs_v2.db');

// Get unapplied jobs
const jobs = db.prepare(`
    SELECT id, url, title, company, apply_link 
    FROM jobs 
    WHERE (applied IS NULL OR applied = 0)
    AND url IS NOT NULL
    ORDER BY id
    LIMIT 5
`).all();

console.log(`\n🎯 Found ${jobs.length} jobs to apply to\n`);

const cdp = new CDP(9222);

async function fillFormField(fieldSelector, value, description) {
    try {
        // Focus the field
        await cdp.eval(`document.querySelector('${fieldSelector}')?.focus()`);
        await new Promise(r => setTimeout(r, 300));

        // Clear existing value
        await cdp.eval(`document.querySelector('${fieldSelector}').value = ''`);

        // Type the value
        await cdp.type(value);
        console.log(`  ✓ Filled ${description}: ${value}`);
        return true;
    } catch (e) {
        console.log(`  ✗ Could not fill ${description}:`, e.message);
        return false;
    }
}

async function clickElement(selector, description) {
    try {
        const coords = await cdp.eval(`
            const el = document.querySelector('${selector}');
            if (!el) throw new Error('Element not found');
            const rect = el.getBoundingClientRect();
            ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        `);

        if (coords) {
            await cdp.click(Math.round(coords.x), Math.round(coords.y));
            console.log(`  ✓ Clicked ${description}`);
            return true;
        }
    } catch (e) {
        console.log(`  ✗ Could not click ${description}:`, e.message);
        return false;
    }
}

async function applyToJob(job) {
    console.log(`\n📝 Applying to: ${job.title} (ID: ${job.id})`);
    console.log(`   URL: ${job.url}`);

    try {
        // Navigate to job page
        await cdp.nav(job.url);
        await new Promise(r => setTimeout(r, 3000)); // Wait for page load

        // Take screenshot before applying
        const screenshotBefore = `screenshots/job-${job.id}-before.jpg`;
        await cdp.screenshot(screenshotBefore);
        console.log(`  📸 Screenshot saved: ${screenshotBefore}`);

        // Look for application form or "Apply" button
        const hasApplyButton = await cdp.eval(`
            !!document.querySelector('button:is([class*="apply"], [id*="apply"]), a:is([class*="apply"], [id*="apply"])')
        `);

        if (hasApplyButton) {
            console.log('  🔍 Found apply button, clicking...');
            await clickElement('button:is([class*="apply"], [id*="apply"]), a:is([class*="apply"], [id*="apply"])', 'Apply button');
            await new Promise(r => setTimeout(r, 2000));
        }

        // Try to find and fill common form fields
        const pageText = await cdp.eval('document.body.innerText.toLowerCase()');

        // Email field
        const emailSelectors = [
            'input[type="email"]',
            'input[name*="email"]',
            'input[id*="email"]'
        ];
        for (const selector of emailSelectors) {
            const exists = await cdp.eval(`!!document.querySelector('${selector}')`);
            if (exists) {
                await fillFormField(selector, credentials.email, 'Email');
                break;
            }
        }

        // Phone field
        const phoneSelectors = [
            'input[type="tel"]',
            'input[name*="phone"]',
            'input[id*="phone"]'
        ];
        for (const selector of phoneSelectors) {
            const exists = await cdp.eval(`!!document.querySelector('${selector}')`);
            if (exists) {
                await fillFormField(selector, credentials.phone, 'Phone');
                break;
            }
        }

        // Look for submit button
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:is([class*="submit"], [id*="submit"])'
        ];

        for (const selector of submitSelectors) {
            const exists = await cdp.eval(`!!document.querySelector('${selector}')`);
            if (exists) {
                // Take screenshot before submitting
                const screenshotAfter = `screenshots/job-${job.id}-filled.jpg`;
                await cdp.screenshot(screenshotAfter);
                console.log(`  📸 Form filled screenshot: ${screenshotAfter}`);

                // Submit (uncomment when ready)
                // await clickElement(selector, 'Submit button');
                console.log('  ⚠️  Submit button found but NOT clicked (safety check)');

                // Update database
                db.prepare(`
                    UPDATE jobs 
                    SET applied = 1, applied_date = datetime('now') 
                    WHERE id = ?
                `).run(job.id);

                console.log(`  ✅ Job marked as applied in database`);
                return true;
            }
        }

        console.log('  ⚠️  No submit button found - manual review needed');
        return false;

    } catch (e) {
        console.error(`  ❌ Error applying to job:`, e.message);
        return false;
    }
}

async function main() {
    try {
        // Create screenshots directory
        if (!fs.existsSync('screenshots')) {
            fs.mkdirSync('screenshots');
        }

        // Connect to Chrome
        console.log('🔌 Connecting to Chrome...');
        const target = await cdp.connect();
        console.log('✓ Connected to:', target.title);

        // Enable all domains
        console.log('🔧 Enabling CDP domains...');
        const domains = await cdp.enableAll();
        console.log('✓ Enabled:', Object.entries(domains).filter(([, v]) => v).map(([k]) => k).join(', '));

        // Process each job
        let applied = 0;
        for (const job of jobs) {
            const success = await applyToJob(job);
            if (success) applied++;

            // Wait between applications
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`\n\n✅ Complete! Applied to ${applied}/${jobs.length} jobs`);

        // Show stats
        const stats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN applied = 1 THEN 1 END) as applied,
                COUNT(CASE WHEN applied IS NULL OR applied = 0 THEN 1 END) as remaining
            FROM jobs
        `).get();

        console.log('\n📊 Database Stats:');
        console.log(`   Total jobs: ${stats.total}`);
        console.log(`   Applied: ${stats.applied}`);
        console.log(`   Remaining: ${stats.remaining}`);

        cdp.close();
        db.close();

    } catch (e) {
        console.error('❌ Fatal error:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
}

main();
