// apply-job.mjs - Automates job applications using Puppeteer
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// User credentials
const USER_INFO = {
    fullName: 'Waseem Raza Khan',
    email: 'waseemrazakhansqa@gmail.com',
    phone: '+447404132345',
    location: 'London, UK',
    linkedIn: 'https://linkedin.com/in/waseemrazakhan',
    availableImmediately: true,
    rightToWork: true
};

const CV_DIR = 'C:\\Users\\wk23aau\\OneDrive - University of Hertfordshire\\001 MyData\\0 applications\\QA\\AI';

async function applyToYopeso() {
    console.log('🚀 Starting Yopeso application automation...');

    const browser = await puppeteer.launch({
        headless: false, // Show browser so user can watch
        defaultViewport: { width: 1280, height: 900 }
    });

    const page = await browser.newPage();

    try {
        // Navigate to job posting
        console.log('📄 Navigating to Yopeso job posting...');
        await page.goto('https://yopeso.recruitee.com/o/infrastructure-automation-engineer-on-prem-1', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for page to load
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: path.join(__dirname, 'output', 'yopeso-1-job-page.png') });
        console.log('📸 Screenshot saved: yopeso-1-job-page.png');

        // Click Apply button
        console.log('🔘 Clicking Apply button...');
        const applyButton = await page.$('a[href*="apply"], button.apply-button, [data-testid="apply-button"], .job-apply-btn, a.apply');
        if (applyButton) {
            await applyButton.click();
            await page.waitForTimeout(3000);
        } else {
            // Try finding by text content
            await page.evaluate(() => {
                const links = Array.from(document.querySelectorAll('a, button'));
                const applyLink = links.find(el => el.textContent.toLowerCase().includes('apply'));
                if (applyLink) applyLink.click();
            });
            await page.waitForTimeout(3000);
        }

        await page.screenshot({ path: path.join(__dirname, 'output', 'yopeso-2-apply-form.png') });
        console.log('📸 Screenshot saved: yopeso-2-apply-form.png');

        // Fill form fields
        console.log('📝 Filling application form...');

        // Wait for form to be visible
        await page.waitForTimeout(2000);

        // Fill name fields
        const nameSelectors = ['input[name*="name" i]', 'input[placeholder*="name" i]', '#name', '#full-name', '#first-name'];
        for (const selector of nameSelectors) {
            const input = await page.$(selector);
            if (input) {
                await input.click({ clickCount: 3 });
                await input.type(USER_INFO.fullName);
                break;
            }
        }

        // Fill email
        const emailSelectors = ['input[type="email"]', 'input[name*="email" i]', 'input[placeholder*="email" i]'];
        for (const selector of emailSelectors) {
            const input = await page.$(selector);
            if (input) {
                await input.click({ clickCount: 3 });
                await input.type(USER_INFO.email);
                break;
            }
        }

        // Fill phone
        const phoneSelectors = ['input[type="tel"]', 'input[name*="phone" i]', 'input[placeholder*="phone" i]'];
        for (const selector of phoneSelectors) {
            const input = await page.$(selector);
            if (input) {
                await input.click({ clickCount: 3 });
                await input.type(USER_INFO.phone);
                break;
            }
        }

        // Upload CV
        console.log('📎 Uploading CV...');
        const cvPath = path.join(CV_DIR, 'Yopeso_Infrastructure.pdf');
        const fileInputs = await page.$$('input[type="file"]');
        if (fileInputs.length > 0) {
            await fileInputs[0].uploadFile(cvPath);
            console.log('✅ CV uploaded successfully');
        } else {
            console.log('⚠️ No file input found, may need manual upload');
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(__dirname, 'output', 'yopeso-3-form-filled.png') });
        console.log('📸 Screenshot saved: yopeso-3-form-filled.png');

        console.log('✅ Form filled! Ready for review and submission.');
        console.log('👆 Please review the form in the browser and click Submit when ready.');

        // Keep browser open for user to review and submit
        console.log('\n⏳ Browser will stay open for 60 seconds for you to review and submit...');
        await page.waitForTimeout(60000);

    } catch (error) {
        console.error('❌ Error during application:', error.message);
        await page.screenshot({ path: path.join(__dirname, 'output', 'yopeso-error.png') });
    } finally {
        await browser.close();
    }
}

// Run the application
applyToYopeso();
